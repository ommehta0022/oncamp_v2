from __future__ import annotations

import base64
import json
import logging
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
GITHUB_API_BASE = f"https://api.github.com/repos/{REPO}"
LOGGER = logging.getLogger("oncampus")

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


def _allowed_asset_prefix(runtime_version: str) -> str:
    return f"https://github.com/{REPO}/releases/download/{_release_tag(runtime_version)}/"


def _github_headers(accept: str = "application/vnd.github+json") -> dict[str, str]:
    return {
        "Accept": accept,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "OnCampus-OTA/3.0",
        "Cache-Control": "no-cache",
    }


def _release_asset(runtime_version: str, asset_name: str) -> Optional[dict[str, Any]]:
    tag = _release_tag(runtime_version)
    try:
        response = requests.get(
            f"{GITHUB_API_BASE}/releases/tags/{tag}",
            headers=_github_headers(),
            timeout=8,
        )
        if not response.ok:
            LOGGER.warning("OTA release metadata unavailable runtime=%s status=%s", runtime_version, response.status_code)
            return None
        release = response.json()
        assets = release.get("assets") if isinstance(release.get("assets"), list) else []
        asset = next((value for value in assets if value.get("name") == asset_name), None)
        return asset if isinstance(asset, dict) else None
    except Exception as exc:
        LOGGER.warning("OTA release metadata failed runtime=%s error=%s", runtime_version, type(exc).__name__)
        return None


def _download_release_asset(runtime_version: str, asset_name: str) -> Optional[bytes]:
    asset = _release_asset(runtime_version, asset_name)
    if not asset:
        LOGGER.warning("OTA release asset missing runtime=%s asset=%s", runtime_version, asset_name)
        return None

    api_url = str(asset.get("url") or "")
    browser_url = str(asset.get("browser_download_url") or "")
    allowed_prefix = _allowed_asset_prefix(runtime_version)
    if browser_url and not browser_url.startswith(allowed_prefix):
        LOGGER.warning("OTA release asset rejected runtime=%s asset=%s reason=untrusted_url", runtime_version, asset_name)
        return None

    if api_url.startswith(f"{GITHUB_API_BASE}/releases/assets/"):
        try:
            response = requests.get(
                api_url,
                headers=_github_headers("application/octet-stream"),
                timeout=10,
                allow_redirects=True,
            )
            if response.ok:
                content_type = str(response.headers.get("content-type") or "").lower()
                if "application/json" not in content_type or not response.content.lstrip().startswith(b"{"):
                    return response.content
        except Exception as exc:
            LOGGER.warning(
                "OTA asset API download failed runtime=%s asset=%s error=%s",
                runtime_version,
                asset_name,
                type(exc).__name__,
            )

    if browser_url:
        try:
            response = requests.get(
                browser_url,
                headers={"Accept": "application/json", "User-Agent": "OnCampus-OTA/3.0", "Cache-Control": "no-cache"},
                timeout=10,
                allow_redirects=True,
            )
            if response.ok:
                return response.content
            LOGGER.warning(
                "OTA browser asset download unavailable runtime=%s asset=%s status=%s",
                runtime_version,
                asset_name,
                response.status_code,
            )
        except Exception as exc:
            LOGGER.warning(
                "OTA browser asset download failed runtime=%s asset=%s error=%s",
                runtime_version,
                asset_name,
                type(exc).__name__,
            )
    return None


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


def fetch_latest_source(runtime_version: str, force: bool = False) -> Optional[dict[str, Any]]:
    if runtime_version not in supported_runtime_versions():
        return None
    now = time.monotonic()
    with _cache_lock:
        cached = _source_cache.get(runtime_version)
        if not force and cached and now - cached[0] < SOURCE_CACHE_TTL_SECONDS:
            return cached[1]

    source: Optional[dict[str, Any]] = None
    payload = _download_release_asset(runtime_version, "ota-source.json")
    if payload:
        try:
            source = _validate_source(json.loads(payload.decode("utf-8")), runtime_version)
            if not source:
                LOGGER.warning("OTA source validation failed runtime=%s", runtime_version)
        except Exception as exc:
            LOGGER.warning("OTA source decode failed runtime=%s error=%s", runtime_version, type(exc).__name__)

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
    except Exception as exc:
        LOGGER.error("OTA manifest signing failed error=%s", type(exc).__name__)
        return None


def _manifest_headers(signature: str) -> dict[str, str]:
    # Expo Structured Field Values encode byte sequences as :base64: rather
    # than quoted strings. expo-updates rejects a syntactically invalid
    # expo-signature even when the HTTP response itself is 200.
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
    }
