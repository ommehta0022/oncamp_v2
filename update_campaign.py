from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Literal, Optional

import requests
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

import ota_updates
import server

router = APIRouter(tags=["update-control"])


class InstallationDto(BaseModel):
    installationId: str = Field(..., min_length=12, max_length=160)
    platform: Literal["android", "ios"]
    pushToken: Optional[str] = Field(default=None, max_length=4096)
    notificationPermission: Literal["unknown", "granted", "denied"] = "unknown"
    nativeVersion: Optional[str] = Field(default=None, max_length=40)
    runtimeVersion: Optional[str] = Field(default=None, max_length=40)
    currentUpdateId: Optional[str] = Field(default=None, max_length=160)
    lastCampaignId: Optional[str] = Field(default=None, max_length=160)


class TriggerCampaignDto(BaseModel):
    runtimeVersion: str = Field(default="1.3.0", min_length=1, max_length=40)
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


def _secure_firebase_info() -> Optional[dict[str, Any]]:
    # Deliberately use only the protected runtime variable. Do not fall back to
    # a repository service-account file because a server signing key must never
    # be trusted from source control.
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
        except Exception:
            failed += 1
    return {"enabled": True, "sent": sent, "failed": failed}


@router.post("/v1/updates/installations")
def register_installation(payload: InstallationDto) -> dict[str, Any]:
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
) -> dict[str, Any]:
    if runtimeVersion not in ota_updates.supported_runtime_versions():
        return {"available": False, "runtimeVersion": runtimeVersion, "pollAfterSeconds": 45}

    source = ota_updates.fetch_latest_source(runtimeVersion)
    if not source:
        return {"available": False, "runtimeVersion": runtimeVersion, "pollAfterSeconds": 45}

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
        "pollAfterSeconds": 45,
    }


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

    server.db.patch(
        "ota_update_campaigns",
        {"runtime_version": f"eq.{payload.runtimeVersion}", "active": "eq.true"},
        {"active": False},
    )
    campaign = server.db.post(
        "ota_update_campaigns",
        {
            "update_id": source["id"],
            "runtime_version": payload.runtimeVersion,
            "title": payload.title,
            "message": payload.message,
            "force_update": payload.forceUpdate,
            "active": True,
            "created_by": user.id,
            "created_at": server.now_iso(),
        },
    )[0]
    push = _broadcast_fcm(campaign)
    return {
        "triggered": True,
        "campaignId": str(campaign["id"]),
        "updateId": campaign["update_id"],
        "runtimeVersion": campaign["runtime_version"],
        "push": push,
    }
