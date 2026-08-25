from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any, Literal, Optional

import requests
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

import ota_updates
import server

router = APIRouter(tags=["update-control"])
AUTO_CAMPAIGN_INTERVAL_SECONDS = max(15, int(os.getenv("OTA_AUTO_CAMPAIGN_INTERVAL_SECONDS", "30")))
_install_rate: dict[str, tuple[float, int]] = {}

NATIVE_RELEASE_API = "https://api.github.com/repos/ommehta0022/oncamp_v2/releases/latest"
NATIVE_RELEASE_PREFIX = "https://github.com/ommehta0022/oncamp_v2/releases/download/"
PUBLIC_API_BASE = os.getenv("PUBLIC_API_BASE_URL", "https://oncampus-backend-production.up.railway.app").rstrip("/")
_native_release_cache: tuple[float, Optional[dict[str, Any]]] = (0.0, None)


class InstallationDto(BaseModel):
    installationId: str = Field(..., min_length=12, max_length=160, pattern=r"^[A-Za-z0-9._:-]+$")
    platform: Literal["android", "ios"]
    pushToken: Optional[str] = Field(default=None, max_length=4096)
    notificationPermission: Literal["unknown", "granted", "denied"] = "unknown"
    nativeVersion: Optional[str] = Field(default=None, max_length=40)
    runtimeVersion: Optional[str] = Field(default=None, max_length=40)
    currentUpdateId: Optional[str] = Field(default=None, max_length=160)
    lastCampaignId: Optional[str] = Field(default=None, max_length=160)


class TriggerCampaignDto(BaseModel):
    runtimeVersion: str = Field(default="1.4.0", min_length=1, max_length=40)
    title: str = Field(default="OnCampus update available", min_length=1, max_length=160)
    message: str = Field(default="A new OnCampus update is ready to install.", min_length=1, max_length=500)
    forceUpdate: bool = False


def _latest_campaign(runtime_version: str) -> Optional[dict[str, Any]]:
    rows = server.db.get(
        "ota_update_campaigns",
        {
            "runtime_version": f"eq.{runtime_version}",
            "active": "eq.true",
            "order": "created_at.desc",
            "limit": "1",
            "select": "id,update_id,runtime_version,title,message,force_update,active,created_at,expires_at",
        },
    ) or []
    return rows[0] if rows else None


def _release_flag(body: str, name: str) -> Optional[str]:
    match = re.search(rf"<!--\s*{re.escape(name)}\s*:\s*([^>]+?)\s*-->", body or "", flags=re.IGNORECASE)
    return match.group(1).strip() if match else None


def _clean_release_notes(body: str) -> str:
    cleaned = re.sub(r"<!--[\s\S]*?-->", "", body or "")
    cleaned = re.sub(r"^#+\s*", "", cleaned, flags=re.MULTILINE)
    return cleaned.replace("\r", "").strip()[:1200]


def _version_tuple(value: Optional[str]) -> tuple[int, int, int]:
    match = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)", str(value or "").strip())
    if not match:
        return (0, 0, 0)
    return tuple(int(part) for part in match.groups())  # type: ignore[return-value]


def _asset_digest_sha256(asset: Optional[dict[str, Any]]) -> Optional[str]:
    raw = str((asset or {}).get("digest") or "").strip().lower()
    match = re.fullmatch(r"sha256:([a-f0-9]{64})", raw)
    return match.group(1) if match else None


def _fetch_native_release(force: bool = False) -> Optional[dict[str, Any]]:
    global _native_release_cache
    now = time.monotonic()
    cached_at, cached = _native_release_cache
    if not force and now - cached_at < 60:
        return cached

    release: Optional[dict[str, Any]] = None
    try:
        response = requests.get(
            NATIVE_RELEASE_API,
            headers={
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "OnCampus-Native-Updater/2.0",
                "Cache-Control": "no-cache",
            },
            timeout=8,
        )
        if response.ok:
            raw = response.json()
            tag = str(raw.get("tag_name") or "").strip()
            if re.fullmatch(r"v\d+\.\d+\.\d+", tag):
                version = tag[1:]
                prefix = f"{NATIVE_RELEASE_PREFIX}{tag}/"
                assets = raw.get("assets") if isinstance(raw.get("assets"), list) else []
                apk_names = (f"OnCampus-{version}.apk", "OnCampus.apk")
                checksum_names = (f"OnCampus-{version}.apk.sha256", "OnCampus.apk.sha256")
                apk = next((a for a in assets if a.get("name") in apk_names), None)
                checksum_asset = next((a for a in assets if a.get("name") in checksum_names), None)
                apk_name = str((apk or {}).get("name") or "")
                checksum_name = str((checksum_asset or {}).get("name") or "")
                apk_url = str((apk or {}).get("browser_download_url") or "")
                checksum_url = str((checksum_asset or {}).get("browser_download_url") or "")

                if apk_name and apk_url == f"{prefix}{apk_name}":
                    checksum = _asset_digest_sha256(apk)
                    if not checksum and checksum_name and checksum_url == f"{prefix}{checksum_name}":
                        checksum_response = requests.get(
                            checksum_url,
                            headers={"Accept": "text/plain", "User-Agent": "OnCampus-Native-Updater/2.0", "Cache-Control": "no-cache"},
                            timeout=8,
                        )
                        checksum_match = re.search(
                            r"\b([A-Fa-f0-9]{64})\b",
                            checksum_response.text if checksum_response.ok else "",
                        )
                        checksum = checksum_match.group(1).lower() if checksum_match else None

                    if checksum:
                        body = str(raw.get("body") or "")
                        release = {
                            "version": version,
                            "tag": tag,
                            "name": str(raw.get("name") or f"OnCampus {version}")[:160],
                            "notes": _clean_release_notes(body),
                            "minVersion": _release_flag(body, "min-version") or "0.0.0",
                            "forceUpdate": str(_release_flag(body, "force-update") or "false").lower() == "true",
                            "sha256": checksum,
                            "size": int((apk or {}).get("size") or 0),
                            "githubApkUrl": apk_url,
                        }
        else:
            server.logger.warning("Native release metadata unavailable: GitHub status %s", response.status_code)
    except Exception as exc:
        server.logger.warning("Native release metadata unavailable: %s", type(exc).__name__)

    if not release:
        server.logger.warning("Native release metadata rejected: compatible APK/checksum asset not found")
    _native_release_cache = (now, release)
    return release


def _secure_firebase_info() -> Optional[dict[str, Any]]:
    raw = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        return None
    try:
        value = json.loads(raw)
        if isinstance(value, dict) and value.get("project_id") and value.get("private_key"):
            return value
    except Exception:
        return None
    return None


def _fcm_access_token(info: dict[str, Any]) -> Optional[str]:
    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request as GoogleAuthRequest

        credentials = service_account.Credentials.from_service_account_info(
            info,
            scopes=["https://www.googleapis.com/auth/firebase.messaging"],
        )
        credentials.refresh(GoogleAuthRequest())
        return credentials.token
    except Exception as exc:
        server.logger.warning("FCM access token unavailable: %s", type(exc).__name__)
        return None


def _broadcast_fcm(campaign: dict[str, Any]) -> dict[str, Any]:
    info = _secure_firebase_info()
    if not info:
        return {"enabled": False, "sent": 0, "failed": 0, "reason": "secure_firebase_credential_not_configured"}
    access_token = _fcm_access_token(info)
    if not access_token:
        return {"enabled": False, "sent": 0, "failed": 0, "reason": "firebase_auth_failed"}

    rows = server.db.get(
        "app_installations",
        {
            "platform": "eq.android",
            "notification_permission": "eq.granted",
            "push_token": "not.is.null",
            "select": "installation_id,push_token",
            "limit": "5000",
        },
    ) or []
    project_id = info["project_id"]
    endpoint = f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    sent = 0
    failed = 0
    invalid_installations: list[str] = []

    for row in rows:
        token = row.get("push_token")
        if not token:
            continue
        payload = {
            "message": {
                "token": token,
                "notification": {"title": campaign["title"], "body": campaign["message"]},
                "data": {
                    "type": "ota_update",
                    "campaignId": str(campaign["id"]),
                    "runtimeVersion": str(campaign["runtime_version"]),
                    "updateId": str(campaign["update_id"]),
                    "forceUpdate": "true" if campaign.get("force_update") else "false",
                },
                "android": {
                    "priority": "high",
                    "notification": {"channel_id": "updates", "sound": "default"},
                },
            }
        }
        try:
            response = requests.post(endpoint, headers=headers, json=payload, timeout=8)
            if response.ok:
                sent += 1
            else:
                failed += 1
                if response.status_code == 404 and row.get("installation_id"):
                    invalid_installations.append(str(row["installation_id"]))
        except Exception:
            failed += 1

    for installation_id in invalid_installations:
        try:
            server.db.patch(
                "app_installations",
                {"installation_id": f"eq.{installation_id}"},
                {"push_token": None, "updated_at": server.now_iso()},
            )
        except Exception:
            pass

    return {"enabled": True, "sent": sent, "failed": failed}


def _create_campaign(
    runtime_version: str,
    source: dict[str, Any],
    *,
    title: str,
    message: str,
    force_update: bool,
    created_by: Optional[str] = None,
) -> dict[str, Any]:
    server.db.patch(
        "ota_update_campaigns",
        {"runtime_version": f"eq.{runtime_version}", "active": "eq.true"},
        {"active": False},
    )
    return server.db.post(
        "ota_update_campaigns",
        {
            "update_id": source["id"],
            "runtime_version": runtime_version,
            "title": title,
            "message": message,
            "force_update": force_update,
            "active": True,
            "created_by": created_by,
            "created_at": server.now_iso(),
        },
    )[0]


def ensure_latest_campaign(runtime_version: str) -> Optional[dict[str, Any]]:
    source = ota_updates.fetch_latest_source(runtime_version)
    if not source:
        return None

    active = _latest_campaign(runtime_version)
    if active and str(active.get("update_id")) == str(source.get("id")):
        return active

    existing = server.db.get(
        "ota_update_campaigns",
        {
            "runtime_version": f"eq.{runtime_version}",
            "update_id": f"eq.{source['id']}",
            "order": "created_at.desc",
            "limit": "1",
            "select": "id,update_id,runtime_version,title,message,force_update,active,created_at,expires_at",
        },
    ) or []
    if existing:
        campaign = existing[0]
        if not campaign.get("active"):
            server.db.patch(
                "ota_update_campaigns",
                {"runtime_version": f"eq.{runtime_version}", "active": "eq.true"},
                {"active": False},
            )
            campaign = server.db.patch(
                "ota_update_campaigns",
                {"id": f"eq.{campaign['id']}"},
                {"active": True},
            )[0]
        return campaign

    campaign = _create_campaign(
        runtime_version,
        source,
        title="OnCampus update available",
        message="A new secure OnCampus update is ready. Open the app to install it now.",
        force_update=False,
    )
    push = _broadcast_fcm(campaign)
    server.logger.info(
        "Auto OTA campaign created runtime=%s update=%s push_enabled=%s sent=%s failed=%s",
        runtime_version,
        source.get("id"),
        push.get("enabled"),
        push.get("sent"),
        push.get("failed"),
    )
    return campaign


async def auto_campaign_loop() -> None:
    while True:
        try:
            for runtime in sorted(ota_updates.supported_runtime_versions()):
                await asyncio.to_thread(ensure_latest_campaign, runtime)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            server.logger.warning("OTA auto campaign check failed: %s", type(exc).__name__)
        await asyncio.sleep(AUTO_CAMPAIGN_INTERVAL_SECONDS)


def _allow_install_registration(request: Request) -> None:
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    key = forwarded or (request.client.host if request.client else "unknown")
    now = time.monotonic()
    window_start, count = _install_rate.get(key, (now, 0))
    if now - window_start >= 60:
        window_start, count = now, 0
    count += 1
    _install_rate[key] = (window_start, count)
    if count > 30:
        raise HTTPException(status_code=429, detail="Too many installation registration requests")
    if len(_install_rate) > 5000:
        stale = [ip for ip, (started, _) in _install_rate.items() if now - started > 120]
        for ip in stale[:2500]:
            _install_rate.pop(ip, None)


@router.post("/v1/updates/installations")
def register_installation(payload: InstallationDto, request: Request) -> dict[str, Any]:
    _allow_install_registration(request)
    values = {
        "platform": payload.platform,
        "push_token": payload.pushToken or None,
        "notification_permission": payload.notificationPermission,
        "native_version": payload.nativeVersion,
        "runtime_version": payload.runtimeVersion,
        "current_update_id": payload.currentUpdateId,
        "last_campaign_id": payload.lastCampaignId,
        "last_seen_at": server.now_iso(),
        "updated_at": server.now_iso(),
    }

    if payload.pushToken:
        duplicates = server.db.get(
            "app_installations",
            {
                "push_token": f"eq.{payload.pushToken}",
                "installation_id": f"neq.{payload.installationId}",
                "select": "installation_id",
            },
        ) or []
        for duplicate in duplicates:
            server.db.patch(
                "app_installations",
                {"installation_id": f"eq.{duplicate['installation_id']}"},
                {"push_token": None, "updated_at": server.now_iso()},
            )

    existing = server.db.get(
        "app_installations",
        {"installation_id": f"eq.{payload.installationId}", "select": "installation_id", "limit": "1"},
    ) or []
    if existing:
        server.db.patch("app_installations", {"installation_id": f"eq.{payload.installationId}"}, values)
    else:
        server.db.post("app_installations", {"installation_id": payload.installationId, **values})
    return {"registered": True}


@router.get("/v1/updates/campaign")
def get_update_campaign(
    runtimeVersion: str = Query(..., min_length=1, max_length=40),
    currentUpdateId: Optional[str] = Query(default=None, max_length=160),
    installationId: Optional[str] = Query(default=None, max_length=160),
    nativeVersion: Optional[str] = Query(default=None, max_length=40),
) -> dict[str, Any]:
    native_release = _fetch_native_release()
    native_release_version = str((native_release or {}).get("version") or "")
    native_update_available = bool(
        native_release_version
        and nativeVersion
        and _version_tuple(native_release_version) > _version_tuple(nativeVersion)
    )
    native_fields = {
        "nativeUpdateAvailable": native_update_available,
        "nativeReleaseVersion": native_release_version or None,
    }

    if runtimeVersion not in ota_updates.supported_runtime_versions():
        return {"available": False, "runtimeVersion": runtimeVersion, "pollAfterSeconds": 15, **native_fields}

    source = ota_updates.fetch_latest_source(runtimeVersion)
    if not source:
        return {"available": False, "runtimeVersion": runtimeVersion, "pollAfterSeconds": 15, **native_fields}

    campaign = _latest_campaign(runtimeVersion)
    source_id = str(source.get("id"))
    available = not currentUpdateId or currentUpdateId != source_id

    if installationId:
        try:
            server.db.patch(
                "app_installations",
                {"installation_id": f"eq.{installationId}"},
                {
                    "runtime_version": runtimeVersion,
                    "native_version": nativeVersion,
                    "current_update_id": currentUpdateId,
                    "last_seen_at": server.now_iso(),
                    "updated_at": server.now_iso(),
                },
            )
        except Exception:
            pass

    return {
        "available": available,
        "campaignId": str(campaign.get("id")) if campaign else source_id,
        "updateId": source_id,
        "runtimeVersion": runtimeVersion,
        "title": (campaign or {}).get("title") or "OnCampus update available",
        "message": (campaign or {}).get("message") or "A new secure OnCampus update is ready.",
        "forceUpdate": bool((campaign or {}).get("force_update", False)),
        "publishedAt": source.get("createdAt"),
        "pollAfterSeconds": 15,
        **native_fields,
    }


@router.get("/v1/updates/native/latest")
def get_latest_native_release() -> dict[str, Any]:
    release = _fetch_native_release()
    if not release:
        raise HTTPException(status_code=503, detail="Native release metadata is temporarily unavailable")
    version = str(release["version"])
    return {
        "available": True,
        "version": version,
        "name": release["name"],
        "notes": release["notes"],
        "minVersion": release["minVersion"],
        "forceUpdate": release["forceUpdate"],
        "sha256": release["sha256"],
        "size": release["size"],
        "apkUrl": f"{PUBLIC_API_BASE}/v1/updates/native/apk?version={version}",
    }


@router.get("/v1/updates/native/apk")
def download_latest_native_apk(version: str = Query(..., pattern=r"^\d+\.\d+\.\d+$")) -> RedirectResponse:
    release = _fetch_native_release()
    if not release:
        raise HTTPException(status_code=503, detail="Native release is temporarily unavailable")
    if str(release["version"]) != version:
        raise HTTPException(status_code=409, detail="A newer native release is available; refresh update metadata")
    return RedirectResponse(
        url=str(release["githubApkUrl"]),
        status_code=307,
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.post("/v1/admin/updates/trigger")
def trigger_update_campaign(
    payload: TriggerCampaignDto,
    user: server.CurrentUser = Depends(server.current_user),
) -> dict[str, Any]:
    server.require_platform_admin(user)
    if payload.runtimeVersion not in ota_updates.supported_runtime_versions():
        raise HTTPException(status_code=400, detail="Unsupported runtime version")
    source = ota_updates.fetch_latest_source(payload.runtimeVersion)
    if not source:
        raise HTTPException(status_code=409, detail="No published OTA exists for this runtime")

    campaign = _create_campaign(
        payload.runtimeVersion,
        source,
        title=payload.title,
        message=payload.message,
        force_update=payload.forceUpdate,
        created_by=user.id,
    )
    push = _broadcast_fcm(campaign)
    return {
        "triggered": True,
        "campaignId": str(campaign["id"]),
        "updateId": campaign["update_id"],
        "runtimeVersion": campaign["runtime_version"],
        "push": push,
    }
