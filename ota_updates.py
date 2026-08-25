from __future__ import annotations

import base64
import json
import logging
import os
import re
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
SOURCE_CACHE_TTL_SECONDS = max(15, int(os.getenv("OTA_SOURCE_CACHE_TTL_SECONDS", "60")))
LOGGER = logging.getLogger("oncampus")

_cache_lock = threading.Lock()
_source_cache: dict[str, tuple[float, Optional[dict[str, Any]]]] = {}
_source_refresh_locks: dict[str, threading.Lock] = {}


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


def _allowed_asset_prefix(runtime_version: str) -> str:
    return f"https://github.com/{REPO}/releases/download/{_release_tag(runtime_version)}/"


def _release_asset_url(runtime_version: str, asset_name: str) -> Optional[str]:
    if not re.fullmatch(r"[A-Za-z0-9._-]{1,160}", asset_name):
        return None
    return f"{_allowed_asset_prefix(runtime_version)}{asset_name}"


def _pointer_url(runtime_version: str) -> str:
    # The workflow commits this tiny pointer only *after* all immutable release
    # assets are uploaded. A cache-busting query avoids the stale mutable release
    # asset behavior that previously caused production to miss new update IDs.
    stamp = int(time.time() // SOURCE_CACHE_TTL_SECONDS)
    return (
        f"https://raw.githubusercontent.com/{REPO}/main/"
        f"ota-pointers/runtime-{runtime_version}.json?v={stamp}"
    )


def _download_url(url: str, *, accept: str, label: str) -> Optional[bytes]:
    try:
        response = requests.get(
            url,
            headers={
                "Accept": accept,
                "User-Agent": "OnCampus-OTA/5.0",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
            },
            timeout=10,
            allow_redirects=True,
        )
        if response.ok:
            return response.content
        LOGGER.warning("OTA %s unavailable status=%s", label, response.status_code)
    except Exception as exc:
        LOGGER.warning("OTA %s failed error=%s", label, type(exc).__name__)
    return None


def _download_promoted_source(runtime_version: str) -> Optional[bytes]:
    payload = _download_url(
        _pointer_url(runtime_version),
        accept="application/json",
        label=f"promoted pointer runtime={runtime_version}",
    )
    if payload:
        return payload

    # Transitional fallback for APKs while the first promoted pointer is being
    # created. This is deliberately not the primary source because GitHub release
    # asset overwrite URLs can remain stale after a successful publish.
    fallback = _release_asset_url(runtime_version, "ota-source.json")
    if not fallback:
        return None
    return _download_url(
        fallback,
        accept="application/json",
        label=f"legacy release pointer runtime={runtime_version}",
    )


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
    metadata = source.get("metadata") if isinstance(source.get("metadata"), dict) else {}
    metadata = {str(key): str(value) for key, value in metadata.items()}
    return {
        "id": update_id,
        "createdAt": created_at,
        "runtimeVersion": runtime_version,
        "launchAsset": launch_asset,
        "assets": assets,
        "metadata": metadata,
        "extra": extra or {},
    }


def _refresh_lock(runtime_version: str) -> threading.Lock:
    with _cache_lock:
        lock = _source_refresh_locks.get(runtime_version)
        if lock is None:
            lock = threading.Lock()
            _source_refresh_locks[runtime_version] = lock
        return lock


def fetch_latest_source(runtime_version: str, force: bool = False) -> Optional[dict[str, Any]]:
    if runtime_version not in supported_runtime_versions():
        return None

    now = time.monotonic()
    with _cache_lock:
        cached = _source_cache.get(runtime_version)
        if not force and cached and now - cached[0] < SOURCE_CACHE_TTL_SECONDS:
            return cached[1]

    with _refresh_lock(runtime_version):
        now = time.monotonic()
        with _cache_lock:
            cached = _source_cache.get(runtime_version)
            if not force and cached and now - cached[0] < SOURCE_CACHE_TTL_SECONDS:
                return cached[1]
            last_good = cached[1] if cached else None

        source: Optional[dict[str, Any]] = None
        payload = _download_promoted_source(runtime_version)
        if payload:
            try:
                source = _validate_source(json.loads(payload.decode("utf-8")), runtime_version)
                if not source:
                    LOGGER.warning("OTA source validation failed runtime=%s", runtime_version)
            except Exception as exc:
                LOGGER.warning("OTA source decode failed runtime=%s error=%s", runtime_version, type(exc).__name__)

        refreshed_at = time.monotonic()
        if source:
            with _cache_lock:
                _source_cache[runtime_version] = (refreshed_at, source)
            return source

        if last_good:
            LOGGER.warning("OTA source refresh failed runtime=%s; serving last verified source", runtime_version)
            with _cache_lock:
                _source_cache[runtime_version] = (refreshed_at, last_good)
            return last_good

        with _cache_lock:
            _source_cache[runtime_version] = (refreshed_at, None)
        return None


def _sign_manifest(body: bytes) -> Optional[str]:
    private_key_pem = os.getenv("OTA_CODE_SIGNING_PRIVATE_KEY", "")
    if not private_key_pem:
        return None
    try:
        private_key = serialization.load_pem_private_key(private_key_pem.encode("utf-8"), password=None)
        signature = private_key.sign(body, padding.PKCS1v15(), hashes.SHA256())
        return base64.b64encode(signature).decode("ascii")
    except Exception as exc:
        LOGGER.error("OTA manifest signing failed error=%s", type(exc).__name__)
        return None


def _manifest_headers(signature: str) -> dict[str, str]:
    return {
        "expo-protocol-version": "1",
        "expo-sfv-version": "0",
        "expo-manifest-filters": 'channel="production"',
        "expo-server-defined-headers": 'expo-channel-name="production"',
        "cache-control": "private, max-age=0, no-store",
        "expo-signature": f'sig=:{signature}:, keyid="{SIGNING_KEY_ID}", alg="rsa-v1_5-sha256"',
        "x-content-type-options": "nosniff",
    }


@router.get("/v1/updates/manifest")
def expo_updates_manifest(request: Request) -> Response:
    protocol_version = request.headers.get("expo-protocol-version", "1")
    platform = request.headers.get("expo-platform")
    runtime_version = request.headers.get("expo-runtime-version")
    current_update_id = request.headers.get("expo-current-update-id")
    if protocol_version not in {"1", "0"}:
        return JSONResponse(status_code=406, content={"error": "Unsupported Expo Updates protocol"})
    if platform != "android" or not runtime_version or runtime_version not in supported_runtime_versions():
        return Response(status_code=204, headers={"x-oncampus-update-reason": "incompatible-request"})
    manifest = fetch_latest_source(runtime_version)
    if not manifest:
        return Response(status_code=204, headers={"x-oncampus-update-reason": "source-unavailable"})
    if current_update_id and current_update_id == manifest.get("id"):
        return Response(status_code=204, headers={"x-oncampus-update-reason": "already-current"})
    body = json.dumps(manifest, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    signature = _sign_manifest(body)
    if not signature:
        return JSONResponse(status_code=503, content={"error": "Signed OTA updates are temporarily unavailable"})
    return Response(
        content=body,
        media_type="application/expo+json",
        headers=_manifest_headers(signature),
    )


@router.get("/v1/updates/status")
def expo_updates_status(runtimeVersion: Optional[str] = Query(default=None, max_length=40)) -> dict[str, Any]:
    runtime = runtimeVersion or DEFAULT_RUNTIME
    source = fetch_latest_source(runtime, force=True)
    return {
        "enabled": bool(os.getenv("OTA_CODE_SIGNING_PRIVATE_KEY")),
        "runtimeVersion": runtime,
        "supportedRuntimes": sorted(supported_runtime_versions()),
        "platform": "android",
        "releaseAvailable": source is not None,
        "updateId": source.get("id") if source else None,
        "signed": bool(os.getenv("OTA_CODE_SIGNING_PRIVATE_KEY")),
        "sourceMode": "promoted-repository-pointer",
        "cacheTtlSeconds": SOURCE_CACHE_TTL_SECONDS,
    }
