from __future__ import annotations

import hashlib
import logging
import re
from typing import Any, Literal, Optional

import requests
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

import ota_updates
import update_campaign

router = APIRouter(tags=["native-update-v2"])
LOGGER = logging.getLogger("oncampus")
APK_MEDIA_TYPE = "application/vnd.android.package-archive"
AUTH_ALGORITHM = "rsa-v1_5-sha256"
AUTH_PACKAGE = "com.oncampus.app"


class NativeUpdateTelemetryDto(BaseModel):
    traceId: str = Field(..., min_length=8, max_length=160, pattern=r"^[A-Za-z0-9._:-]+$")
    stage: Literal[
        "check",
        "available",
        "download_start",
        "downloading",
        "download_complete",
        "verify_hash",
        "verify_package",
        "verify_signature",
        "ready",
        "installer_opened",
        "installed",
        "error",
    ]
    nativeVersion: Optional[str] = Field(default=None, max_length=40)
    targetVersion: Optional[str] = Field(default=None, max_length=40)
    progress: Optional[int] = Field(default=None, ge=0, le=100)
    errorCode: Optional[str] = Field(default=None, max_length=80)
    detail: Optional[str] = Field(default=None, max_length=500)


def _version_code(version: str) -> int:
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", version)
    if not match:
        raise HTTPException(status_code=503, detail="Native release version is invalid")
    major, minor, patch = (int(value) for value in match.groups())
    if any(value < 0 or value > 99 for value in (major, minor, patch)):
        raise HTTPException(status_code=503, detail="Native release version is outside supported range")
    return major * 10000 + minor * 100 + patch


def _release(*, force: bool = False) -> dict[str, Any]:
    release = update_campaign._fetch_native_release(force=force)
    if not release:
        raise HTTPException(status_code=503, detail="Native update release is temporarily unavailable")
    return release


def _authorization_payload(*, version: str, version_code: int, sha256: str, size: int) -> bytes:
    digest = sha256.lower().strip()
    if not re.fullmatch(r"[0-9a-f]{64}", digest):
        raise HTTPException(status_code=503, detail="Native release checksum is invalid")
    if size < 1024 * 1024:
        raise HTTPException(status_code=503, detail="Native release size is invalid")
    return (
        "oncampus-update-v2\n"
        f"version={version}\n"
        f"versionCode={version_code}\n"
        f"sha256={digest}\n"
        f"size={size}\n"
        f"package={AUTH_PACKAGE}\n"
    ).encode("utf-8")


def _release_authorization(release: dict[str, Any], *, version: str, version_code: int) -> dict[str, str]:
    try:
        size = int(release["size"])
        digest = str(release["sha256"])
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="Native release integrity metadata is invalid") from exc
    payload = _authorization_payload(version=version, version_code=version_code, sha256=digest, size=size)
    signature = ota_updates._sign_manifest(payload)
    if not signature:
        LOGGER.error("Native OTA v2 authorization signing unavailable version=%s", version)
        raise HTTPException(status_code=503, detail="Native update authorization is temporarily unavailable")
    return {
        "keyId": ota_updates.SIGNING_KEY_ID,
        "algorithm": AUTH_ALGORITHM,
        "signature": signature,
    }


def _is_no_cache(request: Request) -> bool:
    cache_control = (request.headers.get("cache-control") or "").lower()
    pragma = (request.headers.get("pragma") or "").lower()
    return "no-cache" in cache_control or "no-cache" in pragma


@router.get("/v1/updates/v2/latest")
def native_update_v2_latest(
    request: Request,
    currentVersion: Optional[str] = Query(default=None, max_length=40),
) -> dict[str, Any]:
    release = _release(force=_is_no_cache(request))
    version = str(release["version"])
    version_code = _version_code(version)
    authorization = _release_authorization(release, version=version, version_code=version_code)
    current = update_campaign._version_tuple(currentVersion)
    available = not currentVersion or update_campaign._version_tuple(version) > current
    base = update_campaign.PUBLIC_API_BASE
    return {
        "schemaVersion": 2,
        "transport": "native-apk",
        "available": available,
        "version": version,
        "versionCode": version_code,
        "name": release["name"],
        "notes": release["notes"],
        "minVersion": release["minVersion"],
        "forceUpdate": release["forceUpdate"],
        "sha256": str(release["sha256"]).lower(),
        "size": release["size"],
        "apkUrl": f"{base}/v1/updates/v2/apk/{version}",
        "telemetryUrl": f"{base}/v1/updates/v2/telemetry",
        "authorization": authorization,
        "integrity": {
            "algorithm": "sha256",
            "package": AUTH_PACKAGE,
            "requireSameSigningCertificate": True,
            "requireHigherVersionCode": True,
            "releaseAuthorization": AUTH_ALGORITHM,
        },
        "capabilities": {
            "resume": True,
            "backgroundDownload": True,
            "androidPackageVerification": True,
            "signingCertificatePinning": True,
            "releaseAuthorizationSignature": True,
            "processRecovery": True,
        },
    }


def _relay_headers(upstream: requests.Response, release: dict[str, Any], *, immutable: bool) -> dict[str, str]:
    headers = {
        "Accept-Ranges": upstream.headers.get("Accept-Ranges", "bytes"),
        "Cache-Control": "public, max-age=31536000, immutable" if immutable else "private, no-store",
        "X-Checksum-Sha256": str(release["sha256"]),
        "X-Content-Type-Options": "nosniff",
    }
    for name in ("Content-Length", "Content-Range", "ETag", "Last-Modified"):
        value = upstream.headers.get(name)
        if value:
            headers[name] = value
    return headers


@router.api_route("/v1/updates/v2/apk/{version}", methods=["GET", "HEAD"])
def native_update_v2_apk(version: str, request: Request) -> Response:
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise HTTPException(status_code=404, detail="Invalid native release version")
    release = _release(force=True)
    if str(release["version"]) != version:
        raise HTTPException(status_code=409, detail="A newer native release is available; refresh update metadata")

    headers = {
        "Accept": APK_MEDIA_TYPE,
        "User-Agent": "OnCampus-Native-Update-Relay/2.0",
    }
    requested_range = request.headers.get("range")
    if requested_range:
        headers["Range"] = requested_range

    try:
        upstream = requests.get(
            str(release["githubApkUrl"]),
            headers=headers,
            timeout=(8, 180),
            allow_redirects=True,
            stream=True,
        )
    except requests.RequestException as exc:
        LOGGER.warning("Native OTA v2 upstream failed version=%s error=%s", version, type(exc).__name__)
        raise HTTPException(status_code=503, detail="Native update download is temporarily unavailable") from exc

    if upstream.status_code not in {200, 206}:
        status = upstream.status_code
        upstream.close()
        LOGGER.warning("Native OTA v2 upstream rejected version=%s status=%s", version, status)
        raise HTTPException(status_code=503, detail="Native update download is temporarily unavailable")

    if requested_range and upstream.status_code != 206:
        upstream.close()
        raise HTTPException(status_code=503, detail="Native update resume support is temporarily unavailable")

    response_headers = _relay_headers(upstream, release, immutable=True)
    if request.method == "HEAD":
        upstream.close()
        return Response(status_code=upstream.status_code, media_type=APK_MEDIA_TYPE, headers=response_headers)

    def iterator():
        try:
            for chunk in upstream.iter_content(chunk_size=256 * 1024):
                if chunk:
                    yield chunk
        finally:
            upstream.close()

    return StreamingResponse(
        iterator(),
        status_code=upstream.status_code,
        media_type=APK_MEDIA_TYPE,
        headers=response_headers,
    )


@router.post("/v1/updates/v2/telemetry")
def native_update_v2_telemetry(payload: NativeUpdateTelemetryDto, request: Request) -> dict[str, bool]:
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",", 1)[0].strip()
    client = forwarded or (request.client.host if request.client else "unknown")
    detail = (payload.detail or "").replace("\n", " ").replace("\r", " ")[:500]
    LOGGER.info(
        "Native OTA v2 trace=%s stage=%s native=%s target=%s progress=%s error=%s client=%s detail=%s",
        payload.traceId,
        payload.stage,
        payload.nativeVersion or "-",
        payload.targetVersion or "-",
        payload.progress if payload.progress is not None else "-",
        payload.errorCode or "-",
        client,
        detail or "-",
    )
    return {"accepted": True}
