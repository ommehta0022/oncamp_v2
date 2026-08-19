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
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

router = APIRouter(tags=["OTA Updates"])

REPO = "ommehta0022/oncamp_v2"
SUPPORTED_RUNTIME = os.getenv("OTA_RUNTIME_VERSION", "1.2.0")
SIGNING_KEY_ID = os.getenv("OTA_CODE_SIGNING_KEY_ID", "oncampus-main")
SOURCE_CACHE_TTL_SECONDS = int(os.getenv("OTA_SOURCE_CACHE_TTL_SECONDS", "20"))

_cache_lock = threading.Lock()
_source_cache: dict[str, tuple[float, Optional[dict[str, Any]]]] = {}


def _release_tag(runtime_version: str) -> str:
    return f"ota-runtime-{runtime_version}"


def _source_url(runtime_version: str) -> str:
    tag = _release_tag(runtime_version)
    # Cache-busting query keeps the small mutable pointer fresh while immutable
    # bundle/assets continue to use content-addressed file names.
    bucket = int(time.time() // max(SOURCE_CACHE_TTL_SECONDS, 1))
    return (
        f"https://github.com/{REPO}/releases/download/{tag}/ota-source.json"
        f"?v={bucket}"
    )


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
    if not url.startswith(_allowed_asset_prefix(runtime_version)):
        return False
    if not url.startswith("https://"):
        return False
    return True


def _validate_source(source: Any, runtime_version: str) -> Optional[dict[str, Any]]:
    if not isinstance(source, dict):
        return None
    if source.get("runtimeVersion") != runtime_version:
        return None
    if source.get("platform") not in {None, "android"}:
        return None
    update_id = source.get("id")
    created_at = source.get("createdAt")
    if not isinstance(update_id, str) or len(update_id) != 36:
        return None
    if not isinstance(created_at, str) or not created_at:
        return None

    launch_asset = source.get("launchAsset")
    assets = source.get("assets", [])
    if not _is_valid_asset(launch_asset, runtime_version):
        return None
    if not isinstance(assets, list) or len(assets) > 500:
        return None
    if any(not _is_valid_asset(asset, runtime_version) for asset in assets):
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


def _fetch_latest_source(runtime_version: str) -> Optional[dict[str, Any]]:
    now = time.monotonic()
    with _cache_lock:
        cached = _source_cache.get(runtime_version)
        if cached and now - cached[0] < SOURCE_CACHE_TTL_SECONDS:
            return cached[1]

    try:
        response = requests.get(
            _source_url(runtime_version),
            headers={"Accept": "application/json", "User-Agent": "OnCampus-OTA/1.0"},
            timeout=8,
            allow_redirects=True,
        )
        if response.status_code == 404:
            source = None
        elif response.status_code >= 400:
            source = None
        else:
            source = _validate_source(response.json(), runtime_version)
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
        private_key = serialization.load_pem_private_key(
            private_key_pem.encode("utf-8"),
            password=None,
        )
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
    if platform != "android":
        return Response(status_code=204)
    if runtime_version != SUPPORTED_RUNTIME:
        return Response(status_code=204)

    manifest = _fetch_latest_source(runtime_version)
    if not manifest:
        # The embedded update remains the safe fallback until the first OTA is published.
        return Response(status_code=204)
    if current_update_id and current_update_id == manifest.get("id"):
        return Response(status_code=204)

    body = json.dumps(manifest, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    signature = _sign_manifest(body)
    if not signature:
        # Never downgrade a code-signing-enabled client to an unsigned update.
        return JSONResponse(status_code=503, content={"error": "Signed OTA updates are temporarily unavailable"})

    headers = {
        "expo-protocol-version": "1",
        "expo-sfv-version": "0",
        "cache-control": "private, max-age=0, no-store",
        "expo-signature": (
            f'sig="{signature}", keyid="{SIGNING_KEY_ID}", '
            'alg="rsa-v1_5-sha256"'
        ),
        "x-content-type-options": "nosniff",
    }
    return Response(content=body, media_type="application/expo+json", headers=headers)


@router.get("/v1/updates/status")
def expo_updates_status() -> dict[str, Any]:
    source = _fetch_latest_source(SUPPORTED_RUNTIME)
    return {
        "enabled": bool(os.getenv("OTA_CODE_SIGNING_PRIVATE_KEY")),
        "runtimeVersion": SUPPORTED_RUNTIME,
        "platform": "android",
        "releaseAvailable": source is not None,
        "signed": True,
    }
