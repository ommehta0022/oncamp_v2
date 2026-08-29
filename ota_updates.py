from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import re
import threading
import time
from typing import Any, Optional

import jwt
import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

router = APIRouter(tags=["OTA Updates"])

REPO = "ommehta0022/oncamp_v2"
REPOSITORY_ID = "1287172108"
DEFAULT_RUNTIME = os.getenv("OTA_RUNTIME_VERSION", "1.3.0")
SIGNING_KEY_ID = os.getenv("OTA_CODE_SIGNING_KEY_ID", "oncampus-main")
SOURCE_CACHE_TTL_SECONDS = max(15, int(os.getenv("OTA_SOURCE_CACHE_TTL_SECONDS", "60")))
OIDC_AUDIENCE = "oncampus-ota-promote"
OIDC_ISSUER = "https://token.actions.githubusercontent.com"
OIDC_JWKS_URL = "https://token.actions.githubusercontent.com/.well-known/jwks"
LOGGER = logging.getLogger("oncampus")

_cache_lock = threading.Lock()
_source_cache: dict[str, tuple[float, Optional[dict[str, Any]]]] = {}
_source_refresh_locks: dict[str, threading.Lock] = {}
_oidc_client = jwt.PyJWKClient(OIDC_JWKS_URL, cache_keys=True)


class PromoteSourceDto(BaseModel):
    source: dict[str, Any]


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


def _supabase_headers(*, prefer: Optional[str] = None) -> Optional[dict[str, str]]:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        return None
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def _supabase_rest_url(table: str) -> Optional[str]:
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    return f"{base}/rest/v1/{table}" if base else None


def _fetch_database_source(runtime_version: str) -> Optional[dict[str, Any]]:
    url = _supabase_rest_url("ota_update_sources")
    headers = _supabase_headers()
    if not url or not headers:
        LOGGER.error("OTA source database unavailable: Supabase server credentials are not configured")
        return None
    try:
        response = requests.get(
            url,
            headers=headers,
            params={
                "runtime_version": f"eq.{runtime_version}",
                "select": "runtime_version,update_id,source,source_sha256,promoted_at",
                "limit": "1",
            },
            timeout=8,
        )
        if not response.ok:
            LOGGER.warning("OTA source database read failed runtime=%s status=%s", runtime_version, response.status_code)
            return None
        rows = response.json()
        if not isinstance(rows, list) or not rows:
            return None
        row = rows[0] if isinstance(rows[0], dict) else {}
        source = _validate_source(row.get("source"), runtime_version)
        if not source or row.get("update_id") != source.get("id"):
            LOGGER.warning("OTA source database row rejected runtime=%s", runtime_version)
            return None
        digest = _source_digest(source)
        if row.get("source_sha256") != digest:
            LOGGER.warning("OTA source database digest mismatch runtime=%s", runtime_version)
            return None
        return source
    except Exception as exc:
        LOGGER.warning("OTA source database read failed runtime=%s error=%s", runtime_version, type(exc).__name__)
        return None


def _promote_database_source(source: dict[str, Any], promoted_by: str) -> dict[str, Any]:
    runtime_version = str(source["runtimeVersion"])
    url = _supabase_rest_url("ota_update_sources")
    headers = _supabase_headers(prefer="resolution=merge-duplicates,return=representation")
    if not url or not headers:
        raise HTTPException(status_code=503, detail="OTA promotion database is not configured")
    payload = {
        "runtime_version": runtime_version,
        "update_id": source["id"],
        "source": source,
        "source_sha256": _source_digest(source),
        "promoted_by": promoted_by[:160],
    }
    try:
        response = requests.post(
            url,
            headers=headers,
            params={"on_conflict": "runtime_version"},
            json=payload,
            timeout=12,
        )
        if not response.ok:
            LOGGER.error("OTA database promotion failed runtime=%s status=%s body=%s", runtime_version, response.status_code, response.text[:500])
            raise HTTPException(status_code=503, detail="OTA database promotion failed")
        rows = response.json() if response.text else []
        promoted = rows[0] if isinstance(rows, list) and rows else payload
        with _cache_lock:
            _source_cache[runtime_version] = (time.monotonic(), source)
        return promoted
    except HTTPException:
        raise
    except Exception as exc:
        LOGGER.error("OTA database promotion failed runtime=%s error=%s", runtime_version, type(exc).__name__)
        raise HTTPException(status_code=503, detail="OTA database promotion failed") from exc


def _download_url(url: str, *, accept: str, label: str) -> Optional[bytes]:
    try:
        response = requests.get(
            url,
            headers={
                "Accept": accept,
                "User-Agent": "OnCampus-OTA/6.0",
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


def _download_legacy_release_source(runtime_version: str) -> Optional[bytes]:
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
    if not isinstance(update_id, str) or not re.fullmatch(r"[0-9a-fA-F-]{36}", update_id):
        return None
    if not isinstance(created_at, str) or not created_at:
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
        "id": update_id.lower(),
        "createdAt": created_at,
        "runtimeVersion": runtime_version,
        "launchAsset": launch_asset,
        "assets": assets,
        "metadata": metadata,
        "extra": extra or {},
    }


def _source_bytes(source: dict[str, Any]) -> bytes:
    return json.dumps(source, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _source_digest(source: dict[str, Any]) -> str:
    return hashlib.sha256(_source_bytes(source)).hexdigest()


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

        source = _fetch_database_source(runtime_version)

        # One-release transitional fallback: this keeps existing APKs alive while
        # the first database-backed promotion is performed. Future successful
        # publishes always use the database pointer and never GitHub discovery.
        if source is None:
            payload = _download_legacy_release_source(runtime_version)
            if payload:
                try:
                    source = _validate_source(json.loads(payload.decode("utf-8")), runtime_version)
                except Exception:
                    source = None

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


def _verify_github_oidc(token: str) -> dict[str, Any]:
    if not token or len(token) > 12000:
        raise HTTPException(status_code=401, detail="Missing deployment identity")
    try:
        signing_key = _oidc_client.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=OIDC_AUDIENCE,
            issuer=OIDC_ISSUER,
            options={"require": ["exp", "iat", "iss", "aud", "repository", "repository_id", "ref"]},
        )
    except Exception as exc:
        LOGGER.warning("OTA promotion rejected: invalid GitHub OIDC token (%s)", type(exc).__name__)
        raise HTTPException(status_code=401, detail="Invalid deployment identity") from exc

    workflow_ref = str(claims.get("workflow_ref") or claims.get("job_workflow_ref") or "")
    event_name = str(claims.get("event_name") or "")
    if claims.get("repository") != REPO or str(claims.get("repository_id")) != REPOSITORY_ID:
        raise HTTPException(status_code=403, detail="Untrusted deployment repository")
    if claims.get("ref") != "refs/heads/main":
        raise HTTPException(status_code=403, detail="OTA promotion requires main branch")
    if event_name not in {"push", "workflow_dispatch"}:
        raise HTTPException(status_code=403, detail="Untrusted deployment event")
    if ".github/workflows/ota-update.yml@refs/heads/main" not in workflow_ref:
        raise HTTPException(status_code=403, detail="Untrusted deployment workflow")
    return claims


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
    # expo-updates Android parses the signature value as an SFV StringItem.
    # RFC 8941 byte-sequence syntax (sig=:...:) is rejected before assets are
    # downloaded, so the base64 RSA signature must stay inside a quoted string.
    return {
        "expo-protocol-version": "1",
        "expo-sfv-version": "0",
        "expo-manifest-filters": 'channel="production"',
        "expo-server-defined-headers": 'expo-channel-name="production"',
        "cache-control": "private, max-age=0, no-store",
        "expo-signature": f'sig="{signature}", keyid="{SIGNING_KEY_ID}", alg="rsa-v1_5-sha256"',
        "x-content-type-options": "nosniff",
    }


@router.post("/v1/updates/promote")
def promote_ota_source(payload: PromoteSourceDto, request: Request) -> dict[str, Any]:
    authorization = request.headers.get("authorization", "")
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing deployment identity")
    claims = _verify_github_oidc(authorization.split(" ", 1)[1].strip())
    runtime_version = str(payload.source.get("runtimeVersion") or "")
    if runtime_version not in supported_runtime_versions():
        raise HTTPException(status_code=400, detail="Unsupported OTA runtime")
    source = _validate_source(payload.source, runtime_version)
    if not source:
        raise HTTPException(status_code=400, detail="Invalid OTA source")
    actor = str(claims.get("actor") or "github-actions")
    run_id = str(claims.get("run_id") or "")
    promoted_by = f"github-actions:{actor}:{run_id}" if run_id else f"github-actions:{actor}"
    row = _promote_database_source(source, promoted_by)
    return {
        "promoted": True,
        "runtimeVersion": runtime_version,
        "updateId": source["id"],
        "sourceSha256": _source_digest(source),
        "promotedAt": row.get("promoted_at") if isinstance(row, dict) else None,
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
        "sourceMode": "supabase-promoted-pointer",
        "cacheTtlSeconds": SOURCE_CACHE_TTL_SECONDS,
    }
