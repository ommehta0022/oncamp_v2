from __future__ import annotations

import base64
import json
import os
import threading
import time
from typing import Any, Optional

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse, Response

router = APIRouter(tags=["OTA Updates"])

REPO = "ommehta0022/oncamp_v2"
DEFAULT_RUNTIME = os.getenv("OTA_RUNTIME_VERSION", "1.3.0")
SIGNING_KEY_ID = os.getenv("OTA_CODE_SIGNING_KEY_ID", "oncampus-main")
SOURCE_CACHE_TTL_SECONDS = int(os.getenv("OTA_SOURCE_CACHE_TTL_SECONDS", "20"))

_cache_lock = threading.Lock()
_source_cache: dict[str, tuple[float, Optional[dict[str, Any]]]] = {}


def supported_runtime_versions() -> set[str]:
    configured = {
        value.strip()
        for value in os.getenv("OTA_SUPPORTED_RUNTIMES", "1.2.0,1.3.0").split(",")
        if value.strip()
    }
    configured.add(DEFAULT_RUNTIME)
    return configured


def _release_tag(runtime_version: str) -> str:
    return f"ota-runtime-{runtime_version}"


def _source_url(runtime_version: str) -> str:
    tag = _release_tag(runtime_version)
    bucket = int(time.time() // max(SOURCE_CACHE_TTL_SECONDS, 1))
    return f"https://github.com/{REPO}/releases/download/{tag}/ota-source.json?v={bucket}"


def _allowed_asset_prefix(runtime_version: str) -> str:
    return f"https://github.com/{REPO}/releases/download/{_release_tag(runtime_version)}/"


def _is_valid_asset(asset: Any, runtime_version: str) -> bool:
    if not isinstance(asset, dict):
        return False
    url = asset.get("url")
    key = asset.get("key")
    digest = asset.get("hash")
    content_type = asset.get("contentType")
    if not all(isinstance(value, str) and value for value in (url, key, digest, content_type)):
        return False
    return bool(url.startswith("https://") and url.startswith(_allowed_asset_prefix(runtime_version)))


def _validate_source(source: Any, runtime_version: str) -> Optional[dict[str, Any]]:
    if not isinstance(source, dict) or source.get("runtimeVersion") != runtime_version:
        return None
    if source.get("platform") not in {None, "android"}:
        return None
    update_id = source.get("id")
    created_at = source.get("createdAt")
    if not isinstance(update_id, str) or len(update_id) != 36 or not isinstance(created_at, str) or not created_at:
        return None
    launch_asset = source.get("launchAsset")
    assets = source.get("assets", [])
    if not _is_valid_asset(launch_asset, runtime_version):
        return None
    if not isinstance(assets, list) or len(assets) > 500 or any(not _is_valid_asset(a, runtime_version) for a in assets):
        return None
    extra = source.get("extra")
    if extra is not None and not isinstance(extra, dict):
        return None
    return {
        "id": update_id,
        "createdAt": created_at,
        "runtimeVersion": runtime_version,
        "launchAsset": launch_asset,
        "assets": assets,
        "metadata": source.get("metadata") if isinstance(source.get("metadata"), dict) else {},
        "extra": extra or {},
    }


def fetch_latest_source(runtime_version: str) -> Optional[dict[str, Any]]:
    if runtime_version not in supported_runtime_versions():
        return None
    now = time.monotonic()
    with _cache_lock:
        cached = _source_cache.get(runtime_version)
        if cached and now - cached[0] < SOURCE_CACHE_TTL_SECONDS:
            return cached[1]
    try:
        response = requests.get(
            _source_url(runtime_version),
            headers={"Accept": "application/json", "User-Agent": "OnCampus-OTA/2.0"},
            timeout=8,
            allow_redirects=True,
        )
        source = None if response.status_code >= 400 else _validate_source(response.json(), runtime_version)
    except Exception:
        source = None
    with _cache_lock:
        _source_cache[runtime_version] = (now, source)
    return source


def _sign_manifest(body: bytes) -> Optional[str]:
    private_key_pem = os.getenv("OTA_CODE_SIGNING_PRIVATE_KEY", "")
    if not private_key_pem:
        return None
    try:
        private_key = serialization.load_pem_private_key(private_key_pem.encode("utf-8"), password=None)
        signature = private_key.sign(body, padding.PKCS1v15(), hashes.SHA256())
        return base64.b64encode(signature).decode("ascii")
    except Exception:
        return None


@router.get("/v1/updates/manifest")
def expo_updates_manifest(request: Request) -> Response:
    protocol_version = request.headers.get("expo-protocol-version", "1")
    platform = request.headers.get("expo-platform")
    runtime_version = request.headers.get("expo-runtime-version")
    current_update_id = request.headers.get("expo-current-update-id")
    if protocol_version not in {"1", "0"}:
        return JSONResponse(status_code=406, content={"error": "Unsupported Expo Updates protocol"})
    if platform != "android" or not runtime_version or runtime_version not in supported_runtime_versions():
        return Response(status_code=204)
    manifest = fetch_latest_source(runtime_version)
    if not manifest or (current_update_id and current_update_id == manifest.get("id")):
        return Response(status_code=204)
    body = json.dumps(manifest, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    signature = _sign_manifest(body)
    if not signature:
        return JSONResponse(status_code=503, content={"error": "Signed OTA updates are temporarily unavailable"})
    headers = {
        "expo-protocol-version": "1",
        "expo-sfv-version": "0",
        "cache-control": "private, max-age=0, no-store",
        "expo-signature": f'sig="{signature}", keyid="{SIGNING_KEY_ID}", alg="rsa-v1_5-sha256"',
        "x-content-type-options": "nosniff",
    }
    return Response(content=body, media_type="application/expo+json", headers=headers)


@router.get("/v1/updates/status")
def expo_updates_status(runtimeVersion: Optional[str] = Query(default=None, max_length=40)) -> dict[str, Any]:
    runtime = runtimeVersion or DEFAULT_RUNTIME
    source = fetch_latest_source(runtime)
    return {
        "enabled": bool(os.getenv("OTA_CODE_SIGNING_PRIVATE_KEY")),
        "runtimeVersion": runtime,
        "supportedRuntimes": sorted(supported_runtime_versions()),
        "platform": "android",
        "releaseAvailable": source is not None,
        "updateId": source.get("id") if source else None,
        "signed": True,
    }
