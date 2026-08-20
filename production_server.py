from __future__ import annotations

import asyncio
import logging
import os
import re
from typing import Optional

import uvicorn
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse, Response

import campus_platform
import ota_updates
import server
import update_campaign
from campus_platform import router as campus_platform_router
from institution_content_workflow import router as institution_content_router
from update_campaign import router as update_campaign_router

app = server.app
app.include_router(institution_content_router)
app.include_router(update_campaign_router)
app.include_router(campus_platform_router)
logger = logging.getLogger("oncampus")
_auto_campaign_task: Optional[asyncio.Task] = None
_campus_scheduler_task: Optional[asyncio.Task] = None


@app.get("/v1/updates/manifest", include_in_schema=False)
def production_ota_manifest(request: Request) -> Response:
    return ota_updates.expo_updates_manifest(request)


@app.get("/v1/updates/status", include_in_schema=False)
def production_ota_status(runtimeVersion: Optional[str] = None) -> dict:
    return ota_updates.expo_updates_status(runtimeVersion)


@app.on_event("startup")
async def verify_production_routes() -> None:
    global _auto_campaign_task, _campus_scheduler_task
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
        "/v1/campus/institution/overview",
        "/v1/campus/institution/student-approvals",
        "/v1/campus/institution/events",
        "/v1/campus/institution/broadcasts",
        "/v1/campus/institution/moderation",
    }
    missing = sorted(path for path in required if path not in route_paths)
    if missing:
        logger.critical("Production route registration failure: %s", ", ".join(missing))
        raise RuntimeError(f"Required production routes missing: {', '.join(missing)}")
    if _auto_campaign_task is None or _auto_campaign_task.done():
        _auto_campaign_task = asyncio.create_task(update_campaign.auto_campaign_loop())
    if _campus_scheduler_task is None or _campus_scheduler_task.done():
        _campus_scheduler_task = asyncio.create_task(campus_platform.scheduler_loop())
    logger.info("Production OTA/native/content/campus routes verified; campaign and campus schedulers started")


@app.on_event("shutdown")
async def stop_background_tasks() -> None:
    global _auto_campaign_task, _campus_scheduler_task
    tasks = [_auto_campaign_task, _campus_scheduler_task]
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


def institution_admin_or_error(request: Request):
    user = server.current_user(request.headers.get("authorization"))
    server.require_institution_admin(user)
    return user


@app.middleware("http")
async def institution_only_publishing(request: Request, call_next):
    """Students may consume content, but institution publishing/collaboration is admin-only."""
    path = request.url.path
    method = request.method.upper()
    protected = (
        (method == "POST" and path == "/v1/posts")
        or (method == "POST" and re.fullmatch(r"/v1/posts/[^/]+/(repost|share)", path) is not None)
        or (re.fullmatch(r"/v1/groups/[^/]+/post-requests(?:/[^/]+/(?:approve|reject))?", path) is not None)
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
