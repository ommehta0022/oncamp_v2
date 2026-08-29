from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import os
import re
import threading
import time
from collections import OrderedDict
from typing import Any, Optional

import requests
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
import native_update_v2
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
from institution_engagement import router as institution_engagement_router
from institution_studio import router as institution_studio_router
from institution_studio_analytics import router as institution_studio_analytics_router
from institution_studio_operations import router as institution_studio_operations_router
from native_update_v2 import router as native_update_v2_router
from update_campaign import router as update_campaign_router

app = server.app
app.include_router(institution_content_router)
app.include_router(update_campaign_router)
app.include_router(native_update_v2_router)
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
app.include_router(institution_engagement_router)
app.include_router(institution_studio_operations_router)
app.include_router(institution_studio_analytics_router)
logger = logging.getLogger("oncampus")
_auto_campaign_task: Optional[asyncio.Task] = None
_campus_scheduler_task: Optional[asyncio.Task] = None
_semantics_task: Optional[asyncio.Task] = None
_campus_local_rate: dict[str, tuple[int, int]] = {}

# OTA source metadata is small, but the launch bundle can be several MB. Keep a
# bounded per-worker LRU so repeated/retried downloads do not repeatedly depend
# on GitHub release delivery. Asset names are content addressed, so immutable
# caching is safe for the lifetime of a runtime.
_OTA_ASSET_CACHE_MAX_BYTES = max(8 * 1024 * 1024, int(os.getenv("OTA_ASSET_CACHE_MAX_BYTES", str(32 * 1024 * 1024))))
_ota_asset_cache_lock = threading.Lock()
_ota_asset_cache: OrderedDict[str, tuple[bytes, str, str]] = OrderedDict()
_ota_asset_cache_bytes = 0


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


def _ota_public_origin(request: Request) -> str:
    forwarded_proto = (request.headers.get("x-forwarded-proto") or "").split(",", 1)[0].strip()
    forwarded_host = (request.headers.get("x-forwarded-host") or "").split(",", 1)[0].strip()
    scheme = forwarded_proto or request.url.scheme or "https"
    host = forwarded_host or request.headers.get("host") or request.url.netloc
    return f"{scheme}://{host}".rstrip("/")


def _ota_asset_name(asset: Any) -> Optional[str]:
    if not isinstance(asset, dict):
        return None
    url = str(asset.get("url") or "")
    name = url.rsplit("/", 1)[-1]
    if not re.fullmatch(r"(?:launch|asset)-[0-9a-f]{64}\.[A-Za-z0-9]{1,12}", name):
        return None
    return name


def _ota_asset_record(source: dict[str, Any], asset_name: str) -> Optional[dict[str, Any]]:
    candidates = [source.get("launchAsset"), *(source.get("assets") or [])]
    for candidate in candidates:
        if isinstance(candidate, dict) and _ota_asset_name(candidate) == asset_name:
            return candidate
    return None


def _ota_rewrite_manifest_for_client(source: dict[str, Any], request: Request) -> dict[str, Any]:
    manifest = json.loads(json.dumps(source))
    runtime = str(manifest.get("runtimeVersion") or "")
    origin = _ota_public_origin(request)
    for asset in [manifest.get("launchAsset"), *(manifest.get("assets") or [])]:
        name = _ota_asset_name(asset)
        if name and isinstance(asset, dict):
            asset["url"] = f"{origin}/v1/updates/assets/{runtime}/{name}"
    return manifest


def _ota_hash_bytes(payload: bytes) -> str:
    return base64.urlsafe_b64encode(hashlib.sha256(payload).digest()).decode("ascii").rstrip("=")


def _ota_cache_get(cache_key: str) -> Optional[tuple[bytes, str, str]]:
    with _ota_asset_cache_lock:
        value = _ota_asset_cache.get(cache_key)
        if value is not None:
            _ota_asset_cache.move_to_end(cache_key)
        return value


def _ota_cache_put(cache_key: str, payload: bytes, content_type: str, digest: str) -> None:
    global _ota_asset_cache_bytes
    if len(payload) > _OTA_ASSET_CACHE_MAX_BYTES:
        return
    with _ota_asset_cache_lock:
        previous = _ota_asset_cache.pop(cache_key, None)
        if previous is not None:
            _ota_asset_cache_bytes -= len(previous[0])
        _ota_asset_cache[cache_key] = (payload, content_type, digest)
        _ota_asset_cache_bytes += len(payload)
        while _ota_asset_cache and _ota_asset_cache_bytes > _OTA_ASSET_CACHE_MAX_BYTES:
            _, evicted = _ota_asset_cache.popitem(last=False)
            _ota_asset_cache_bytes -= len(evicted[0])


def _ota_fetch_verified_asset(runtime_version: str, asset_name: str) -> tuple[bytes, str, str]:
    source = ota_updates.fetch_latest_source(runtime_version)
    if not source:
        raise HTTPException(status_code=404, detail="OTA release is unavailable")
    asset = _ota_asset_record(source, asset_name)
    if not asset:
        raise HTTPException(status_code=404, detail="OTA asset is not part of the promoted release")

    expected_hash = str(asset.get("hash") or "")
    content_type = str(asset.get("contentType") or "application/octet-stream")
    cache_key = f"{runtime_version}:{asset_name}:{expected_hash}"
    cached = _ota_cache_get(cache_key)
    if cached is not None:
        return cached

    upstream_url = str(asset.get("url") or "")
    try:
        upstream = requests.get(
            upstream_url,
            headers={
                "Accept": content_type,
                "User-Agent": "OnCampus-OTA-Asset-Relay/1.0",
            },
            timeout=(5, 45),
            allow_redirects=True,
        )
    except requests.RequestException as exc:
        logger.warning("OTA asset upstream failed runtime=%s asset=%s error=%s", runtime_version, asset_name, type(exc).__name__)
        raise HTTPException(status_code=503, detail="OTA asset delivery is temporarily unavailable") from exc
    if not upstream.ok:
        logger.warning("OTA asset upstream rejected runtime=%s asset=%s status=%s", runtime_version, asset_name, upstream.status_code)
        raise HTTPException(status_code=503, detail="OTA asset delivery is temporarily unavailable")

    payload = upstream.content
    actual_hash = _ota_hash_bytes(payload)
    if not expected_hash or actual_hash != expected_hash:
        logger.error("OTA asset hash mismatch runtime=%s asset=%s", runtime_version, asset_name)
        raise HTTPException(status_code=502, detail="OTA asset integrity verification failed")

    _ota_cache_put(cache_key, payload, content_type, actual_hash)
    return payload, content_type, actual_hash


def _ota_range(value: str, total: int) -> Optional[tuple[int, int]]:
    if not value or not value.startswith("bytes=") or "," in value:
        return None
    spec = value[6:].strip()
    if "-" not in spec:
        return None
    start_text, end_text = spec.split("-", 1)
    try:
        if start_text:
            start = int(start_text)
            end = int(end_text) if end_text else total - 1
        elif end_text:
            suffix = int(end_text)
            if suffix <= 0:
                return None
            start = max(0, total - suffix)
            end = total - 1
        else:
            return None
    except ValueError:
        return None
    if start < 0 or start >= total or end < start:
        return None
    return start, min(end, total - 1)


@app.post("/v1/updates/promote", include_in_schema=False)
def production_ota_promote(payload: ota_updates.PromoteSourceDto, request: Request) -> dict:
    return ota_updates.promote_ota_source(payload, request)


@app.get("/v1/updates/manifest", include_in_schema=False)
def production_ota_manifest(request: Request) -> Response:
    protocol_version = request.headers.get("expo-protocol-version", "1")
    platform = request.headers.get("expo-platform")
    runtime_version = request.headers.get("expo-runtime-version")
    current_update_id = request.headers.get("expo-current-update-id")
    if protocol_version not in {"1", "0"}:
        return JSONResponse(status_code=406, content={"error": "Unsupported Expo Updates protocol"})
    if platform != "android" or not runtime_version or runtime_version not in ota_updates.supported_runtime_versions():
        return Response(status_code=204, headers={"x-oncampus-update-reason": "incompatible-request"})
    source = ota_updates.fetch_latest_source(runtime_version)
    if not source:
        return Response(status_code=204, headers={"x-oncampus-update-reason": "source-unavailable"})
    if current_update_id and current_update_id == source.get("id"):
        return Response(status_code=204, headers={"x-oncampus-update-reason": "already-current"})

    # Never make mobile clients depend directly on GitHub release delivery.
    # Railway remains the stable origin and relays only content-addressed assets
    # that belong to the exact promoted, signed release.
    manifest = _ota_rewrite_manifest_for_client(source, request)
    body = json.dumps(manifest, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    signature = ota_updates._sign_manifest(body)
    if not signature:
        return JSONResponse(status_code=503, content={"error": "Signed OTA updates are temporarily unavailable"})
    return Response(
        content=body,
        media_type="application/expo+json",
        headers=ota_updates._manifest_headers(signature),
    )


@app.api_route("/v1/updates/assets/{runtime_version}/{asset_name}", methods=["GET", "HEAD"], include_in_schema=False)
def production_ota_asset(runtime_version: str, asset_name: str, request: Request) -> Response:
    if runtime_version not in ota_updates.supported_runtime_versions():
        raise HTTPException(status_code=404, detail="Unsupported OTA runtime")
    if not re.fullmatch(r"(?:launch|asset)-[0-9a-f]{64}\.[A-Za-z0-9]{1,12}", asset_name):
        raise HTTPException(status_code=404, detail="Invalid OTA asset")

    payload, content_type, digest = _ota_fetch_verified_asset(runtime_version, asset_name)
    total = len(payload)
    common_headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
        "ETag": f'"sha256-{digest}"',
        "X-Content-Type-Options": "nosniff",
    }
    requested_range = request.headers.get("range", "")
    if requested_range:
        byte_range = _ota_range(requested_range, total)
        if byte_range is None:
            return Response(status_code=416, headers={**common_headers, "Content-Range": f"bytes */{total}"})
        start, end = byte_range
        segment = payload[start : end + 1]
        headers = {
            **common_headers,
            "Content-Range": f"bytes {start}-{end}/{total}",
            "Content-Length": str(len(segment)),
        }
        return Response(
            content=b"" if request.method == "HEAD" else segment,
            status_code=206,
            media_type=content_type,
            headers=headers,
        )

    headers = {**common_headers, "Content-Length": str(total)}
    return Response(
        content=b"" if request.method == "HEAD" else payload,
        media_type=content_type,
        headers=headers,
    )


@app.get("/v1/updates/status", include_in_schema=False)
def production_ota_status(runtimeVersion: Optional[str] = None) -> dict:
    return ota_updates.expo_updates_status(runtimeVersion)


@app.on_event("startup")
async def verify_production_routes() -> None:
    global _auto_campaign_task, _campus_scheduler_task, _semantics_task
    route_paths = {getattr(route, "path", "") for route in app.routes}
    required = {
        "/v1/updates/promote",
        "/v1/updates/manifest",
        "/v1/updates/status",
        "/v1/updates/assets/{runtime_version}/{asset_name}",
        "/v1/updates/installations",
        "/v1/updates/campaign",
        "/v1/updates/native/latest",
        "/v1/updates/native/apk",
        "/v1/updates/v2/latest",
        "/v1/updates/v2/apk/{version}",
        "/v1/updates/v2/telemetry",
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
        "/v1/campus/directory/institutions/{institution_id}/engagement",
        "/v1/campus/directory/institutions/{institution_id}/bookmark",
        "/v1/campus/directory/institutions/{institution_id}/view",
        "/v1/campus/institution/studio",
        "/v1/campus/institution/studio/profile",
        "/v1/campus/institution/studio/media",
        "/v1/campus/institution/studio/publish",
        "/v1/campus/institution/studio/opportunities",
        "/v1/campus/institution/studio/groups",
        "/v1/campus/institution/studio/places",
        "/v1/campus/institution/studio/analytics",
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
    logger.info("Production OTA/native-v2/content/campus/security/governance/AI/semantic/media/voice/institution-studio routes verified; background workers started")


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
            return JSONResponse(status_code=429, content={"detail": "Too many campus requests. Please retry shortly."}, headers={"Retry-After": "60"})
    return await call_next(request)


@app.middleware("http")
async def institution_only_publishing(request: Request, call_next):
    """Students may consume content, but publishing and publishing-request workflows are institution-owned."""
    path = request.url.path
    method = request.method.upper()
    retired_request_creation = method == "POST" and (
        re.fullmatch(r"/v1/groups/[^/]+/post-requests", path) is not None
        or re.fullmatch(r"/v1/institutions/[^/]+/post-requests", path) is not None
    )
    if retired_request_creation:
        return JSONResponse(status_code=410, content={"detail": "Student publishing requests are retired. Institution administrators publish through Content Studio."})

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
            return JSONResponse(status_code=403, content={"detail": "Institution admin access required"})
    return await call_next(request)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("production_server:app", host="0.0.0.0", port=port, reload=False)
