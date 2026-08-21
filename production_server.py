from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import re
import time
from typing import Optional

import uvicorn
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse, Response

import campus_ai
import campus_media
import campus_ops_extension
import campus_platform
import campus_platform_hardening
import campus_semantics
import campus_voice
import ota_updates
import server
import update_campaign
from campus_ai import router as campus_ai_router
from campus_media import router as campus_media_router
from campus_ops_extension import router as campus_ops_router
from campus_platform import router as campus_platform_router
from campus_platform_hardening import router as campus_platform_hardening_router
from campus_semantics import router as campus_semantics_router
from campus_voice import router as campus_voice_router
from institution_content_workflow import router as institution_content_router
from institution_studio import router as institution_studio_router
from update_campaign import router as update_campaign_router

app = server.app
app.include_router(institution_content_router)
app.include_router(update_campaign_router)
# Exact security-hardened routes are registered first so Starlette resolves them
# before their backward-compatible implementations in campus_platform.
app.include_router(campus_platform_hardening_router)
app.include_router(campus_ops_router)
app.include_router(campus_ai_router)
app.include_router(campus_platform_router)
app.include_router(campus_semantics_router)
app.include_router(campus_media_router)
app.include_router(campus_voice_router)
app.include_router(institution_studio_router)
logger = logging.getLogger("oncampus")
_auto_campaign_task: Optional[asyncio.Task] = None
_campus_scheduler_task: Optional[asyncio.Task] = None
_semantics_task: Optional[asyncio.Task] = None
_campus_local_rate: dict[str, tuple[int, int]] = {}


def _campus_rate_principal(request: Request) -> tuple[str, bool]:
    authorization = (request.headers.get("authorization") or "").strip()
    if authorization:
        digest = hashlib.sha256(authorization.encode("utf-8")).hexdigest()[:24]
        return f"auth:{digest}", True
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",", 1)[0].strip()
    client_ip = forwarded or (request.client.host if request.client else "unknown")
    return f"ip:{client_ip}", False


def _local_rate_allowed(key: str, limit: int) -> bool:
    bucket = int(time.time() // 60)
    stored_bucket, count = _campus_local_rate.get(key, (bucket, 0))
    if stored_bucket != bucket:
        stored_bucket, count = bucket, 0
    count += 1
    _campus_local_rate[key] = (stored_bucket, count)
    if len(_campus_local_rate) > 5000:
        stale = [item for item, (item_bucket, _) in list(_campus_local_rate.items()) if item_bucket < bucket]
        for item in stale[:2500]:
            _campus_local_rate.pop(item, None)
    return count <= limit


@app.get("/v1/updates/manifest", include_in_schema=False)
def production_ota_manifest(request: Request) -> Response:
    return ota_updates.expo_updates_manifest(request)


@app.get("/v1/updates/status", include_in_schema=False)
def production_ota_status(runtimeVersion: Optional[str] = None) -> dict:
    return ota_updates.expo_updates_status(runtimeVersion)


@app.on_event("startup")
async def verify_production_routes() -> None:
    global _auto_campaign_task, _campus_scheduler_task, _semantics_task
    route_paths = {getattr(route, "path", "") for route in app.routes}
    required = {
        "/v1/updates/manifest",
        "/v1/updates/status",
        "/v1/updates/installations",
        "/v1/updates/campaign",
        "/v1/updates/native/latest",
        "/v1/updates/native/apk",
        "/v1/admin/updates/trigger",
        "/v1/institutions/me/content/overview",
        "/v1/campus/hub",
        "/v1/campus/search",
        "/v1/campus/trending",
        "/v1/campus/invites/{code}/accept",
        "/v1/campus/institution/overview",
        "/v1/campus/institution/student-approvals",
        "/v1/campus/institution/events",
        "/v1/campus/institution/broadcasts",
        "/v1/campus/institution/moderation",
        "/v1/campus/institution/audit-logs",
        "/v1/campus/institution/export-link",
        "/v1/campus/public/export",
        "/v1/campus/ai/status",
        "/v1/campus/institution/ai/analyze",
        "/v1/campus/posts/{post_id}/versions",
        "/v1/campus/posts/{post_id}/semantics",
        "/v1/campus/groups/{group_id}/media",
        "/v1/campus/groups/{group_id}/voice-note",
        "/v1/campus/directory/institutions",
        "/v1/campus/directory/institutions/{institution_id}",
        "/v1/campus/institution/studio",
        "/v1/campus/institution/studio/profile",
        "/v1/campus/institution/studio/media",
        "/v1/campus/institution/studio/publish",
    }
    missing = sorted(path for path in required if path not in route_paths)
    if missing:
        logger.critical("Production route registration failure: %s", ", ".join(missing))
        raise RuntimeError(f"Required production routes missing: {', '.join(missing)}")
    if _auto_campaign_task is None or _auto_campaign_task.done():
        _auto_campaign_task = asyncio.create_task(update_campaign.auto_campaign_loop())
    if _campus_scheduler_task is None or _campus_scheduler_task.done():
        _campus_scheduler_task = asyncio.create_task(campus_platform.scheduler_loop())
    if _semantics_task is None or _semantics_task.done():
        _semantics_task = asyncio.create_task(campus_semantics.semantics_loop())
    logger.info("Production OTA/native/content/campus/security/governance/AI/semantic/media/voice/institution-studio routes verified; background workers started")


@app.on_event("shutdown")
async def stop_background_tasks() -> None:
    global _auto_campaign_task, _campus_scheduler_task, _semantics_task
    tasks = [_auto_campaign_task, _campus_scheduler_task, _semantics_task]
    for task in tasks:
        if task and not task.done():
            task.cancel()
    for task in tasks:
        if task:
            try:
                await task
            except asyncio.CancelledError:
                pass
    _auto_campaign_task = None
    _campus_scheduler_task = None
    _semantics_task = None


def institution_admin_or_error(request: Request):
    user = server.current_user(request.headers.get("authorization"))
    server.require_institution_admin(user)
    return user


@app.middleware("http")
async def campus_rate_limit(request: Request, call_next):
    """Bound all campus APIs, preferring distributed Upstash quotas when available."""
    if request.method != "OPTIONS" and request.url.path.startswith("/v1/campus/"):
        principal, authenticated = _campus_rate_principal(request)
        is_read = request.method in {"GET", "HEAD"}
        limit = (300 if is_read else 120) if authenticated else (120 if is_read else 30)
        key = f"campus-rate:{principal}:{'read' if is_read else 'write'}"
        try:
            allowed = server.redis.check_rate_limit(key, limit, 60) if server.redis.enabled else _local_rate_allowed(key, limit)
        except Exception as exc:
            logger.warning("Distributed campus rate limit unavailable: %s", type(exc).__name__)
            allowed = _local_rate_allowed(key, limit)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many campus requests. Please retry shortly."},
                headers={"Retry-After": "60"},
            )
    return await call_next(request)


@app.middleware("http")
async def institution_only_publishing(request: Request, call_next):
    """Students may consume content, but publishing and publishing-request workflows are institution-owned."""
    path = request.url.path
    method = request.method.upper()

    # Legacy student post/poster request creation is fully retired. Keep historical admin
    # read/decision routes only for migration/cleanup, never as a student workflow.
    retired_request_creation = method == "POST" and (
        re.fullmatch(r"/v1/groups/[^/]+/post-requests", path) is not None
        or re.fullmatch(r"/v1/institutions/[^/]+/post-requests", path) is not None
    )
    if retired_request_creation:
        return JSONResponse(
            status_code=410,
            content={"detail": "Student publishing requests are retired. Institution administrators publish through Content Studio."},
        )

    protected = (
        (method == "POST" and path == "/v1/posts")
        or (method == "POST" and re.fullmatch(r"/v1/posts/[^/]+/(repost|share)", path) is not None)
        or (re.fullmatch(r"/v1/groups/[^/]+/post-requests(?:/[^/]+/(?:approve|reject))?", path) is not None)
        or (re.fullmatch(r"/v1/institutions/[^/]+/post-requests(?:/[^/]+/(?:approve|reject))?", path) is not None)
        or (method == "GET" and path == "/v1/users/me/post-requests")
    )
    if protected:
        try:
            institution_admin_or_error(request)
        except HTTPException as exc:
            return JSONResponse(status_code=exc.status_code, content={"detail": "Institution admin access required"})
        except Exception:
            return JSONResponse(status_code=401, content={"detail": "Authentication required"})
    return await call_next(request)


@app.middleware("http")
async def protect_institution_branding_uploads(request: Request, call_next):
    """Require a live institution-admin session for institution branding uploads."""
    protected_paths = {
        "/v1/upload/institution-logo",
        "/v1/upload/institution-cover",
    }
    if request.method == "POST" and request.url.path in protected_paths:
        try:
            institution_admin_or_error(request)
        except HTTPException as exc:
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
        except Exception:
            return JSONResponse(status_code=401, content={"detail": "Authentication required"})
    return await call_next(request)


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8080")),
        proxy_headers=True,
        forwarded_allow_ips="*",
    )
