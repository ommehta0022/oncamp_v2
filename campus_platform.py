from __future__ import annotations

import base64
import csv
import hashlib
import hmac
import io
import ipaddress
import json
import os
import re
import secrets
import socket
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from html import unescape
from typing import Any, Literal, Optional
from urllib.parse import urlparse

import requests
from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field

import server

router = APIRouter(prefix="/v1/campus", tags=["campus-platform"])

PERMISSIONS = {
    "students.review",
    "staff.manage",
    "departments.manage",
    "roles.manage",
    "events.manage",
    "broadcasts.send",
    "moderation.review",
    "analytics.view",
    "verification.manage",
    "storage.view",
    "exports.view",
    "backup.manage",
    "integrations.manage",
    "invites.manage",
    "opportunities.manage",
    "places.manage",
    "attendance.manage",
    "digital_id.manage",
    "emergency.send",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4()}"


def clean_text(value: str, max_length: int) -> str:
    return re.sub(r"\s+", " ", value.strip())[:max_length]


def _safe_query(value: str) -> str:
    return value.replace("%", "").replace(",", " ").replace("(", " ").replace(")", " ").strip()


def _admin_context(user: server.CurrentUser) -> Optional[dict[str, Any]]:
    try:
        admin = server.require_institution_admin(user)
        if admin and admin.get("institution_id"):
            return {
                "institution_id": admin["institution_id"],
                "kind": "admin",
                "permissions": set(PERMISSIONS),
                "record": admin,
            }
    except HTTPException:
        return None
    return None


def institution_operator(user: server.CurrentUser, permission: Optional[str] = None) -> dict[str, Any]:
    admin = _admin_context(user)
    if admin:
        return admin

    staff_rows = server.db.get(
        "institution_staff",
        {
            "user_id": f"eq.{user.id}",
            "status": "eq.active",
            "select": "id,institution_id,role_id,name,title,status",
            "limit": "1",
        },
    ) or []
    if not staff_rows:
        raise HTTPException(status_code=403, detail="Institution staff access required")
    staff = staff_rows[0]
    permissions: set[str] = set()
    role_id = staff.get("role_id")
    if role_id:
        roles = server.db.get(
            "institution_roles",
            {"id": f"eq.{role_id}", "institution_id": f"eq.{staff['institution_id']}", "select": "permissions", "limit": "1"},
        ) or []
        if roles and isinstance(roles[0].get("permissions"), list):
            permissions = {str(item) for item in roles[0]["permissions"]}
    if permission and permission not in permissions:
        raise HTTPException(status_code=403, detail=f"Missing institution permission: {permission}")
    return {
        "institution_id": staff["institution_id"],
        "kind": "staff",
        "permissions": permissions,
        "record": staff,
    }


def require_operator(permission: str):
    def dependency(user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
        return institution_operator(user, permission)
    return dependency


def student_membership(user_id: str, *, require_verified: bool = True) -> dict[str, Any]:
    params: dict[str, Any] = {
        "user_id": f"eq.{user_id}",
        "select": "*",
        "order": "created_at.desc",
        "limit": "1",
    }
    if require_verified:
        params["verification_status"] = "eq.verified"
    rows = server.db.get("user_institutions", params) or []
    if not rows:
        raise HTTPException(status_code=409, detail="Join and verify your institution first")
    return rows[0]


def _activity(user_id: Optional[str], institution_id: Optional[str], event_type: str, target_type: Optional[str] = None, target_id: Optional[str] = None, metadata: Optional[dict[str, Any]] = None) -> None:
    try:
        server.db.post(
            "user_activity_events",
            {
                "id": new_id("activity"),
                "user_id": user_id,
                "institution_id": institution_id,
                "event_type": event_type,
                "target_type": target_type,
                "target_id": target_id,
                "metadata": metadata or {},
                "created_at": now_iso(),
            },
        )
    except Exception:
        pass


def _audit(user: server.CurrentUser, institution_id: str, action: str, target_type: str, target_id: Optional[str], details: Any) -> None:
    _activity(user.id, institution_id, action, target_type, target_id, details if isinstance(details, dict) else {"message": str(details)})
    try:
        server.db.post(
            "audit_logs",
            {
                "admin_id": user.id,
                "action": action,
                "target_type": target_type,
                "target_id": target_id,
                "details": json.dumps(details, ensure_ascii=False) if not isinstance(details, str) else details,
                "device_info": {"source": "campus_platform"},
            },
        )
    except Exception:
        pass


def _institution_users(institution_id: str, target: Optional[dict[str, Any]] = None, limit: int = 5000) -> list[dict[str, Any]]:
    params: dict[str, Any] = {
        "institution_id": f"eq.{institution_id}",
        "verification_status": "eq.verified",
        "select": "user_id,department,year,semester,role",
        "limit": str(limit),
    }
    rows = server.db.get("user_institutions", params) or []
    target = target or {"type": "all"}
    target_type = target.get("type", "all")
    if target_type == "department" and target.get("department"):
        wanted = str(target["department"]).lower()
        rows = [row for row in rows if str(row.get("department") or "").lower() == wanted]
    elif target_type == "year" and target.get("year"):
        rows = [row for row in rows if str(row.get("year") or "") == str(target["year"])]
    elif target_type == "users" and isinstance(target.get("userIds"), list):
        allowed = {str(value) for value in target["userIds"][:1000]}
        rows = [row for row in rows if str(row.get("user_id")) in allowed]
    return rows


def _notify_user(user_id: str, title: str, body: str, event_type: str, data: Optional[dict[str, Any]] = None, push: bool = True) -> bool:
    try:
        server.db.post(
            "notifications",
            {
                "id": new_id("notif"),
                "user_id": user_id,
                "type": event_type,
                "title": title[:180],
                "body": body[:1000],
                "data": data or {},
                "read": False,
                "created_at": now_iso(),
            },
        )
    except Exception:
        return False

    if push:
        devices = server.db.get(
            "user_devices",
            {"user_id": f"eq.{user_id}", "push_token": "not.is.null", "select": "push_token", "limit": "5"},
        ) or []
        for device in devices:
            token = device.get("push_token")
            if not token:
                continue
            try:
                server.send_push(token, title[:120], body[:300], {key: str(value) for key, value in (data or {}).items()})
            except Exception:
                pass
    return True


def _fernet() -> Fernet:
    digest = hashlib.sha256(server.JWT_SECRET.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def _validate_public_https_url(value: str) -> str:
    parsed = urlparse(value.strip())
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise HTTPException(status_code=422, detail="Webhook URL must be a public HTTPS URL")
    host = parsed.hostname.lower()
    if host in {"localhost", "localhost.localdomain"} or host.endswith(".local"):
        raise HTTPException(status_code=422, detail="Private webhook destinations are not allowed")
    try:
        addresses = {entry[4][0] for entry in socket.getaddrinfo(host, parsed.port or 443, type=socket.SOCK_STREAM)}
        for address in addresses:
            ip = ipaddress.ip_address(address)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
                raise HTTPException(status_code=422, detail="Private webhook destinations are not allowed")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=422, detail="Webhook hostname could not be verified")
    return value.strip()


def _deliver_webhook(row: dict[str, Any], event_type: str, payload: dict[str, Any]) -> None:
    ciphertext = row.get("secret_ciphertext")
    if not ciphertext:
        return
    try:
        url = _validate_public_https_url(str(row["url"]))
        secret = _fernet().decrypt(str(ciphertext).encode("utf-8")).decode("utf-8")
        delivery_id = str(uuid.uuid4())
        raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        signature = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()
        response = requests.post(
            url,
            data=raw,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "OnCampus-Webhooks/1.0",
                "X-OnCampus-Event": event_type,
                "X-OnCampus-Delivery": delivery_id,
                "X-OnCampus-Signature": f"sha256={signature}",
            },
            timeout=8,
            allow_redirects=False,
        )
        server.db.patch(
            "institution_webhooks",
            {"id": f"eq.{row['id']}"},
            {
                "last_status": response.status_code,
                "last_delivery_at": now_iso(),
                "failure_count": 0 if response.ok else int(row.get("failure_count") or 0) + 1,
                "last_error": None if response.ok else f"HTTP {response.status_code}",
                "updated_at": now_iso(),
            },
        )
    except Exception as exc:
        try:
            server.db.patch(
                "institution_webhooks",
                {"id": f"eq.{row['id']}"},
                {
                    "failure_count": int(row.get("failure_count") or 0) + 1,
                    "last_error": type(exc).__name__,
                    "updated_at": now_iso(),
                },
            )
        except Exception:
            pass


def emit_webhook(institution_id: str, event_type: str, payload: dict[str, Any]) -> None:
    hooks = server.db.get(
        "institution_webhooks",
        {"institution_id": f"eq.{institution_id}", "active": "eq.true", "select": "*", "limit": "100"},
    ) or []
    envelope = {
        "id": str(uuid.uuid4()),
        "event": event_type,
        "createdAt": now_iso(),
        "institutionId": institution_id,
        "data": payload,
    }
    for hook in hooks:
        events = hook.get("events") or []
        if "*" not in events and event_type not in events:
            continue
        threading.Thread(target=_deliver_webhook, args=(hook, event_type, envelope), daemon=True).start()


def _create_announcement_post(row: dict[str, Any]) -> dict[str, Any]:
    existing_id = row.get("published_post_id")
    if existing_id:
        existing = server.db.get("posts", {"id": f"eq.{existing_id}", "select": "*", "limit": "1"}) or []
        if existing:
            return existing[0]
    post = server.db.post(
        "posts",
        {
            "id": new_id("post"),
            "author_id": row["created_by"],
            "institution_id": row["institution_id"],
            "group_id": None,
            "type": "announcement",
            "visibility": "institution",
            "status": "published",
            "title": row["title"],
            "content": row["body"],
            "pinned": row.get("priority") in {"high", "critical"},
            "comments_enabled": True,
            "reactions_enabled": True,
            "published_at": now_iso(),
            "expires_at": row.get("expires_at"),
            "created_at": now_iso(),
            "updated_at": now_iso(),
        },
    )[0]
    server.db.patch(
        "scheduled_announcements",
        {"id": f"eq.{row['id']}"},
        {"status": "published", "published_post_id": post["id"], "updated_at": now_iso()},
    )
    emit_webhook(row["institution_id"], "announcement.published", {"announcementId": row["id"], "postId": post["id"]})
    return post


def _send_broadcast(row: dict[str, Any]) -> dict[str, int]:
    if row.get("status") == "sent":
        stats = row.get("delivery_stats") or {}
        return {"recipients": int(stats.get("recipients") or 0), "inApp": int(stats.get("inApp") or 0)}
    server.db.patch("institution_broadcasts", {"id": f"eq.{row['id']}"}, {"status": "sending", "updated_at": now_iso()})
    recipients = _institution_users(row["institution_id"], row.get("target") or {"type": "all"})
    channels = row.get("channels") or {"inApp": True, "push": True}
    in_app = 0
    for member in recipients:
        if _notify_user(
            member["user_id"],
            row["title"],
            row["body"],
            "institution_broadcast",
            {"broadcastId": row["id"], "institutionId": row["institution_id"]},
            push=bool(channels.get("push", True)),
        ):
            in_app += 1
    stats = {"recipients": len(recipients), "inApp": in_app}
    server.db.patch(
        "institution_broadcasts",
        {"id": f"eq.{row['id']}"},
        {"status": "sent", "sent_at": now_iso(), "delivery_stats": stats, "updated_at": now_iso()},
    )
    emit_webhook(row["institution_id"], "broadcast.sent", {"broadcastId": row["id"], **stats})
    return stats


async def scheduler_loop() -> None:
    import asyncio
    while True:
        try:
            current = now_iso()
            announcements = server.db.get(
                "scheduled_announcements",
                {"status": "eq.scheduled", "publish_at": f"lte.{current}", "select": "*", "limit": "100"},
            ) or []
            for row in announcements:
                await asyncio.to_thread(_create_announcement_post, row)

            broadcasts = server.db.get(
                "institution_broadcasts",
                {"status": "eq.scheduled", "scheduled_at": f"lte.{current}", "select": "*", "limit": "100"},
            ) or []
            for row in broadcasts:
                await asyncio.to_thread(_send_broadcast, row)

            expiring = server.db.get(
                "scheduled_announcements",
                {"status": "eq.published", "expires_at": f"lte.{current}", "select": "id", "limit": "100"},
            ) or []
            for row in expiring:
                server.db.patch("scheduled_announcements", {"id": f"eq.{row['id']}"}, {"status": "expired", "updated_at": current})
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            server.logger.warning("Campus scheduler iteration failed: %s", type(exc).__name__)
        await asyncio.sleep(30)


class DecisionDto(BaseModel):
    status: Literal["approved", "rejected", "needs_info"]
    message: str = Field(default="", max_length=2000)


class DepartmentDto(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    code: Optional[str] = Field(default=None, max_length=30)
    description: Optional[str] = Field(default=None, max_length=1000)
    active: bool = True


class RoleDto(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    description: Optional[str] = Field(default=None, max_length=1000)
    permissions: list[str] = Field(default_factory=list, max_length=100)


class StaffDto(BaseModel):
    userId: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=140)
    email: Optional[str] = Field(default=None, max_length=254)
    phone: Optional[str] = Field(default=None, max_length=40)
    title: Optional[str] = Field(default=None, max_length=120)
    departmentId: Optional[str] = None
    roleId: Optional[str] = None
    status: Literal["invited", "active", "suspended", "inactive"] = "active"


class EventDto(BaseModel):
    title: str = Field(..., min_length=1, max_length=180)
    description: str = Field(default="", max_length=12000)
    location: Optional[str] = Field(default=None, max_length=300)
    locationLat: Optional[float] = Field(default=None, ge=-90, le=90)
    locationLng: Optional[float] = Field(default=None, ge=-180, le=180)
    startAt: str
    endAt: str
    capacity: Optional[int] = Field(default=None, ge=1, le=100000)
    visibility: Literal["public", "institution", "invite_only"] = "institution"
    status: Literal["draft", "scheduled", "published", "cancelled", "completed"] = "published"
    imageUrl: Optional[str] = Field(default=None, max_length=2000)
    rsvpEnabled: bool = True


class RsvpDto(BaseModel):
    status: Literal["going", "interested", "not_going", "waitlist"] = "going"
    guests: int = Field(default=0, ge=0, le=10)


class AnnouncementDto(BaseModel):
    title: str = Field(..., min_length=1, max_length=180)
    body: str = Field(..., min_length=1, max_length=12000)
    target: dict[str, Any] = Field(default_factory=lambda: {"type": "all"})
    publishAt: Optional[str] = None
    expiresAt: Optional[str] = None
    priority: Literal["low", "normal", "high", "critical"] = "normal"


class BroadcastDto(BaseModel):
    title: str = Field(..., min_length=1, max_length=180)
    body: str = Field(..., min_length=1, max_length=1000)
    target: dict[str, Any] = Field(default_factory=lambda: {"type": "all"})
    channels: dict[str, bool] = Field(default_factory=lambda: {"inApp": True, "push": True})
    scheduledAt: Optional[str] = None


class VerificationDto(BaseModel):
    entityType: Literal["group", "club", "society", "department", "staff"]
    entityId: str = Field(..., min_length=1, max_length=200)
    evidence: dict[str, Any] = Field(default_factory=dict)


class WebhookDto(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    url: str = Field(..., min_length=10, max_length=2000)
    events: list[str] = Field(default_factory=lambda: ["*"], max_length=100)


class InviteDto(BaseModel):
    inviteType: Literal["institution", "group", "event", "club"] = "institution"
    targetId: Optional[str] = None
    autoApprove: bool = False
    maxUses: Optional[int] = Field(default=None, ge=1, le=100000)
    expiresAt: Optional[str] = None


class ReactionDto(BaseModel):
    reaction: Optional[Literal["like", "love", "celebrate", "support", "insightful", "funny"]] = None


class PollDto(BaseModel):
    postId: str
    question: str = Field(..., min_length=1, max_length=300)
    options: list[str] = Field(..., min_length=2, max_length=10)
    multipleChoice: bool = False
    anonymous: bool = False
    closesAt: Optional[str] = None


class PollVoteDto(BaseModel):
    optionIds: list[str] = Field(..., min_length=1, max_length=10)


class FeedbackDto(BaseModel):
    category: str = Field(default="feedback", max_length=60)
    subject: str = Field(..., min_length=1, max_length=180)
    message: str = Field(..., min_length=1, max_length=4000)
    rating: Optional[int] = Field(default=None, ge=1, le=5)


class MarketplaceDto(BaseModel):
    title: str = Field(..., min_length=1, max_length=180)
    description: str = Field(default="", max_length=4000)
    category: str = Field(default="other", max_length=80)
    price: float = Field(default=0, ge=0, le=10000000)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    imageUrls: list[str] = Field(default_factory=list, max_length=8)


class LostFoundDto(BaseModel):
    kind: Literal["lost", "found"]
    title: str = Field(..., min_length=1, max_length=180)
    description: str = Field(default="", max_length=4000)
    location: Optional[str] = Field(default=None, max_length=300)
    eventAt: Optional[str] = None
    imageUrl: Optional[str] = Field(default=None, max_length=2000)


class OpportunityDto(BaseModel):
    kind: Literal["internship", "placement", "part_time", "project", "scholarship", "competition"] = "internship"
    title: str = Field(..., min_length=1, max_length=180)
    organization: Optional[str] = Field(default=None, max_length=180)
    description: str = Field(default="", max_length=8000)
    location: Optional[str] = Field(default=None, max_length=300)
    applyUrl: Optional[str] = Field(default=None, max_length=2000)
    deadline: Optional[str] = None


class PlaceDto(BaseModel):
    name: str = Field(..., min_length=1, max_length=180)
    category: str = Field(default="building", max_length=80)
    description: Optional[str] = Field(default=None, max_length=2000)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    floor: Optional[str] = Field(default=None, max_length=30)


class AttendanceSessionDto(BaseModel):
    title: str = Field(..., min_length=1, max_length=180)
    departmentId: Optional[str] = None
    startsAt: str
    endsAt: str
    geofence: dict[str, Any] = Field(default_factory=dict)


class AttendanceRecordDto(BaseModel):
    userId: str
    status: Literal["present", "late", "absent", "excused"] = "present"
    method: str = Field(default="manual", max_length=40)


class IntegrationDto(BaseModel):
    kind: Literal["lms", "library", "timetable", "calendar", "attendance", "webhook", "other"]
    name: str = Field(..., min_length=1, max_length=160)
    baseUrl: Optional[str] = Field(default=None, max_length=2000)
    config: dict[str, Any] = Field(default_factory=dict)
    secretRef: Optional[str] = Field(default=None, max_length=300)
    active: bool = True


class EmergencyDto(BaseModel):
    title: str = Field(..., min_length=1, max_length=180)
    body: str = Field(..., min_length=1, max_length=2000)
    severity: Literal["info", "warning", "high", "critical"] = "high"
    target: dict[str, Any] = Field(default_factory=lambda: {"type": "all"})


class DigitalIdDto(BaseModel):
    userId: str
    departmentId: Optional[str] = None
    validUntil: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class AlumniDto(BaseModel):
    graduationYear: Optional[int] = Field(default=None, ge=1900, le=2200)
    course: Optional[str] = Field(default=None, max_length=180)
    employer: Optional[str] = Field(default=None, max_length=180)
    jobTitle: Optional[str] = Field(default=None, max_length=180)
    city: Optional[str] = Field(default=None, max_length=120)
    mentorshipAvailable: bool = False
    visible: bool = True


@router.get("/institution/overview")
def institution_overview(user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    ctx = institution_operator(user)
    iid = ctx["institution_id"]
    pending_students = len(server.db.get("institution_student_approvals", {"institution_id": f"eq.{iid}", "status": "eq.pending", "select": "id", "limit": "1000"}) or [])
    departments = len(server.db.get("institution_departments", {"institution_id": f"eq.{iid}", "active": "eq.true", "select": "id", "limit": "1000"}) or [])
    staff = len(server.db.get("institution_staff", {"institution_id": f"eq.{iid}", "status": "eq.active", "select": "id", "limit": "1000"}) or [])
    upcoming_events = len(server.db.get("campus_events", {"institution_id": f"eq.{iid}", "start_at": f"gte.{now_iso()}", "status": "in.(published,scheduled)", "select": "id", "limit": "1000"}) or [])
    open_moderation = len(server.db.get("content_intelligence_signals", {"institution_id": f"eq.{iid}", "status": "eq.open", "select": "id", "limit": "1000"}) or [])
    return {
        "institutionId": iid,
        "permissions": sorted(ctx["permissions"]),
        "counts": {
            "pendingStudents": pending_students,
            "departments": departments,
            "staff": staff,
            "upcomingEvents": upcoming_events,
            "moderation": open_moderation,
        },
    }


@router.get("/institution/student-approvals")
def list_student_approvals(
    status: str = Query("pending", max_length=30),
    q: Optional[str] = Query(default=None, max_length=80),
    ctx: dict[str, Any] = Depends(require_operator("students.review")),
) -> list[dict[str, Any]]:
    iid = ctx["institution_id"]
    params: dict[str, Any] = {"institution_id": f"eq.{iid}", "select": "*", "order": "created_at.desc", "limit": "300"}
    if status != "all":
        params["status"] = f"eq.{status}"
    rows = server.db.get("institution_student_approvals", params) or []

    # Materialize legacy pending memberships into the new review queue.
    if status in {"pending", "all"}:
        legacy = server.db.get(
            "user_institutions",
            {"institution_id": f"eq.{iid}", "verification_status": "neq.verified", "select": "*", "limit": "300"},
        ) or []
        known = {row.get("user_id") for row in rows}
        for membership in legacy:
            if membership.get("user_id") in known:
                continue
            created = server.db.post(
                "institution_student_approvals",
                {
                    "institution_id": iid,
                    "user_id": membership["user_id"],
                    "status": "pending",
                    "source": "legacy_membership",
                    "verification_data": {
                        "department": membership.get("department"),
                        "year": membership.get("year"),
                        "semester": membership.get("semester"),
                        "rollNumber": membership.get("roll_number"),
                        "officialEmail": membership.get("official_email"),
                        "documentUrl": membership.get("document_url"),
                    },
                },
            )[0]
            rows.append(created)
    user_ids = [row.get("user_id") for row in rows if row.get("user_id")]
    profiles: dict[str, dict[str, Any]] = {}
    for user_id in user_ids[:300]:
        profile = server.db.get("users", {"id": f"eq.{user_id}", "select": "id,name,handle,avatar_url,course,city,verified,status", "limit": "1"}) or []
        if profile:
            profiles[user_id] = profile[0]
    if q:
        needle = q.strip().lower()
        rows = [row for row in rows if needle in str((profiles.get(row.get("user_id")) or {}).get("name") or "").lower() or needle in str((profiles.get(row.get("user_id")) or {}).get("handle") or "").lower()]
    return [{**row, "user": profiles.get(row.get("user_id"))} for row in rows]


@router.post("/institution/student-approvals/{approval_id}/decision")
def decide_student_approval(
    approval_id: str,
    payload: DecisionDto,
    user: server.CurrentUser = Depends(server.current_user),
    ctx: dict[str, Any] = Depends(require_operator("students.review")),
) -> dict[str, Any]:
    iid = ctx["institution_id"]
    rows = server.db.get("institution_student_approvals", {"id": f"eq.{approval_id}", "institution_id": f"eq.{iid}", "select": "*", "limit": "1"}) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Student approval request not found")
    row = rows[0]
    stored_status = payload.status
    updated = server.db.patch(
        "institution_student_approvals",
        {"id": f"eq.{approval_id}", "institution_id": f"eq.{iid}"},
        {"status": stored_status, "review_message": payload.message.strip() or None, "reviewed_by": user.id, "reviewed_at": now_iso(), "updated_at": now_iso()},
    )[0]
    membership_status = "verified" if payload.status == "approved" else "rejected" if payload.status == "rejected" else "pending"
    membership_patch = {"verification_status": membership_status, "reviewed_by": user.id, "reviewed_at": now_iso()}
    if payload.status == "approved":
        membership_patch["verified_at"] = now_iso()
    server.db.patch("user_institutions", {"user_id": f"eq.{row['user_id']}", "institution_id": f"eq.{iid}"}, membership_patch)
    _notify_user(row["user_id"], "Institution verification updated", payload.message.strip() or ("Your institution membership was approved." if payload.status == "approved" else "Your institution membership status changed."), "institution_verification", {"status": payload.status, "institutionId": iid})
    _audit(user, iid, f"student.{payload.status}", "user", row["user_id"], {"approvalId": approval_id, "message": payload.message})
    emit_webhook(iid, f"student.{payload.status}", {"userId": row["user_id"], "approvalId": approval_id})
    return updated


@router.get("/institution/departments")
def list_departments(ctx: dict[str, Any] = Depends(require_operator("departments.manage"))) -> list[dict[str, Any]]:
    return server.db.get("institution_departments", {"institution_id": f"eq.{ctx['institution_id']}", "select": "*", "order": "name.asc"}) or []


@router.post("/institution/departments")
def create_department(payload: DepartmentDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("departments.manage"))) -> dict[str, Any]:
    row = server.db.post("institution_departments", {"institution_id": ctx["institution_id"], "name": payload.name.strip(), "code": payload.code, "description": payload.description, "active": payload.active, "created_by": user.id})[0]
    _audit(user, ctx["institution_id"], "department.created", "department", row["id"], {"name": row["name"]})
    return row


@router.patch("/institution/departments/{department_id}")
def update_department(department_id: str, payload: DepartmentDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("departments.manage"))) -> dict[str, Any]:
    rows = server.db.patch("institution_departments", {"id": f"eq.{department_id}", "institution_id": f"eq.{ctx['institution_id']}"}, {"name": payload.name.strip(), "code": payload.code, "description": payload.description, "active": payload.active, "updated_at": now_iso()}) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Department not found")
    _audit(user, ctx["institution_id"], "department.updated", "department", department_id, {"name": payload.name})
    return rows[0]


@router.get("/institution/roles")
def list_roles(ctx: dict[str, Any] = Depends(require_operator("roles.manage"))) -> list[dict[str, Any]]:
    return server.db.get("institution_roles", {"institution_id": f"eq.{ctx['institution_id']}", "select": "*", "order": "name.asc"}) or []


@router.post("/institution/roles")
def create_role(payload: RoleDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("roles.manage"))) -> dict[str, Any]:
    invalid = sorted(set(payload.permissions) - PERMISSIONS)
    if invalid:
        raise HTTPException(status_code=422, detail=f"Unknown permissions: {', '.join(invalid)}")
    row = server.db.post("institution_roles", {"institution_id": ctx["institution_id"], "name": payload.name.strip(), "description": payload.description, "permissions": sorted(set(payload.permissions)), "is_system": False, "created_by": user.id})[0]
    _audit(user, ctx["institution_id"], "role.created", "role", row["id"], {"name": row["name"], "permissions": row["permissions"]})
    return row


@router.patch("/institution/roles/{role_id}")
def update_role(role_id: str, payload: RoleDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("roles.manage"))) -> dict[str, Any]:
    invalid = sorted(set(payload.permissions) - PERMISSIONS)
    if invalid:
        raise HTTPException(status_code=422, detail=f"Unknown permissions: {', '.join(invalid)}")
    existing = server.db.get("institution_roles", {"id": f"eq.{role_id}", "institution_id": f"eq.{ctx['institution_id']}", "select": "is_system", "limit": "1"}) or []
    if not existing:
        raise HTTPException(status_code=404, detail="Role not found")
    rows = server.db.patch("institution_roles", {"id": f"eq.{role_id}"}, {"name": payload.name.strip(), "description": payload.description, "permissions": sorted(set(payload.permissions)), "updated_at": now_iso()}) or []
    _audit(user, ctx["institution_id"], "role.updated", "role", role_id, {"permissions": payload.permissions})
    return rows[0]


@router.get("/institution/staff")
def list_staff(ctx: dict[str, Any] = Depends(require_operator("staff.manage"))) -> list[dict[str, Any]]:
    return server.db.get("institution_staff", {"institution_id": f"eq.{ctx['institution_id']}", "select": "*", "order": "name.asc", "limit": "1000"}) or []


@router.post("/institution/staff")
def create_staff(payload: StaffDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("staff.manage"))) -> dict[str, Any]:
    iid = ctx["institution_id"]
    if payload.departmentId:
        if not (server.db.get("institution_departments", {"id": f"eq.{payload.departmentId}", "institution_id": f"eq.{iid}", "select": "id", "limit": "1"}) or []):
            raise HTTPException(status_code=422, detail="Department does not belong to this institution")
    if payload.roleId:
        if not (server.db.get("institution_roles", {"id": f"eq.{payload.roleId}", "institution_id": f"eq.{iid}", "select": "id", "limit": "1"}) or []):
            raise HTTPException(status_code=422, detail="Role does not belong to this institution")
    row = server.db.post("institution_staff", {"institution_id": iid, "user_id": payload.userId, "name": payload.name.strip(), "email": payload.email, "phone": payload.phone, "title": payload.title, "department_id": payload.departmentId, "role_id": payload.roleId, "status": payload.status, "created_by": user.id})[0]
    _audit(user, iid, "staff.created", "staff", row["id"], {"name": row["name"]})
    emit_webhook(iid, "staff.created", {"staffId": row["id"]})
    return row


@router.patch("/institution/staff/{staff_id}")
def update_staff(staff_id: str, payload: StaffDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("staff.manage"))) -> dict[str, Any]:
    iid = ctx["institution_id"]
    rows = server.db.patch("institution_staff", {"id": f"eq.{staff_id}", "institution_id": f"eq.{iid}"}, {"user_id": payload.userId, "name": payload.name.strip(), "email": payload.email, "phone": payload.phone, "title": payload.title, "department_id": payload.departmentId, "role_id": payload.roleId, "status": payload.status, "updated_at": now_iso()}) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Staff member not found")
    _audit(user, iid, "staff.updated", "staff", staff_id, {"status": payload.status})
    return rows[0]


@router.get("/events")
def list_events(
    upcoming: bool = True,
    user: server.CurrentUser = Depends(server.current_user),
) -> list[dict[str, Any]]:
    membership = student_membership(user.id)
    params: dict[str, Any] = {"institution_id": f"eq.{membership['institution_id']}", "status": "in.(published,scheduled)", "select": "*", "order": "start_at.asc", "limit": "200"}
    if upcoming:
        params["end_at"] = f"gte.{now_iso()}"
    rows = server.db.get("campus_events", params) or []
    rsvps = server.db.get("campus_event_rsvps", {"user_id": f"eq.{user.id}", "select": "event_id,status,guests"}) or []
    by_event = {row["event_id"]: row for row in rsvps}
    return [{**row, "myRsvp": by_event.get(row["id"])} for row in rows]


@router.get("/institution/events")
def institution_events(ctx: dict[str, Any] = Depends(require_operator("events.manage"))) -> list[dict[str, Any]]:
    return server.db.get("campus_events", {"institution_id": f"eq.{ctx['institution_id']}", "select": "*", "order": "start_at.desc", "limit": "500"}) or []


@router.post("/institution/events")
def create_event(payload: EventDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("events.manage"))) -> dict[str, Any]:
    start = datetime.fromisoformat(payload.startAt.replace("Z", "+00:00"))
    end = datetime.fromisoformat(payload.endAt.replace("Z", "+00:00"))
    if end <= start:
        raise HTTPException(status_code=422, detail="Event end time must be after start time")
    row = server.db.post("campus_events", {"institution_id": ctx["institution_id"], "title": payload.title.strip(), "description": payload.description.strip(), "location": payload.location, "location_lat": payload.locationLat, "location_lng": payload.locationLng, "start_at": payload.startAt, "end_at": payload.endAt, "capacity": payload.capacity, "visibility": payload.visibility, "status": payload.status, "image_url": payload.imageUrl, "rsvp_enabled": payload.rsvpEnabled, "created_by": user.id})[0]
    _audit(user, ctx["institution_id"], "event.created", "event", row["id"], {"title": row["title"]})
    emit_webhook(ctx["institution_id"], "event.created", {"eventId": row["id"], "title": row["title"]})
    return row


@router.patch("/institution/events/{event_id}")
def update_event(event_id: str, payload: EventDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("events.manage"))) -> dict[str, Any]:
    rows = server.db.patch("campus_events", {"id": f"eq.{event_id}", "institution_id": f"eq.{ctx['institution_id']}"}, {"title": payload.title.strip(), "description": payload.description.strip(), "location": payload.location, "location_lat": payload.locationLat, "location_lng": payload.locationLng, "start_at": payload.startAt, "end_at": payload.endAt, "capacity": payload.capacity, "visibility": payload.visibility, "status": payload.status, "image_url": payload.imageUrl, "rsvp_enabled": payload.rsvpEnabled, "updated_at": now_iso()}) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Event not found")
    _audit(user, ctx["institution_id"], "event.updated", "event", event_id, {"status": payload.status})
    return rows[0]


@router.post("/events/{event_id}/rsvp")
def rsvp_event(event_id: str, payload: RsvpDto, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    membership = student_membership(user.id)
    event_rows = server.db.get("campus_events", {"id": f"eq.{event_id}", "institution_id": f"eq.{membership['institution_id']}", "status": "in.(published,scheduled)", "select": "*", "limit": "1"}) or []
    if not event_rows or not event_rows[0].get("rsvp_enabled"):
        raise HTTPException(status_code=404, detail="Event is not available for RSVP")
    existing = server.db.get("campus_event_rsvps", {"event_id": f"eq.{event_id}", "user_id": f"eq.{user.id}", "select": "event_id", "limit": "1"}) or []
    values = {"status": payload.status, "guests": payload.guests, "updated_at": now_iso()}
    if existing:
        row = server.db.patch("campus_event_rsvps", {"event_id": f"eq.{event_id}", "user_id": f"eq.{user.id}"}, values)[0]
    else:
        row = server.db.post("campus_event_rsvps", {"event_id": event_id, "user_id": user.id, **values})[0]
    _activity(user.id, membership["institution_id"], "event.rsvp", "event", event_id, {"status": payload.status})
    return row


@router.get("/institution/announcements")
def list_announcements(ctx: dict[str, Any] = Depends(require_operator("broadcasts.send"))) -> list[dict[str, Any]]:
    return server.db.get("scheduled_announcements", {"institution_id": f"eq.{ctx['institution_id']}", "select": "*", "order": "created_at.desc", "limit": "300"}) or []


@router.post("/institution/announcements")
def create_announcement(payload: AnnouncementDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("broadcasts.send"))) -> dict[str, Any]:
    iid = ctx["institution_id"]
    scheduled = bool(payload.publishAt and datetime.fromisoformat(payload.publishAt.replace("Z", "+00:00")) > datetime.now(timezone.utc))
    row = server.db.post("scheduled_announcements", {"institution_id": iid, "title": payload.title.strip(), "body": payload.body.strip(), "target": payload.target, "publish_at": payload.publishAt, "expires_at": payload.expiresAt, "status": "scheduled" if scheduled else "draft", "priority": payload.priority, "created_by": user.id})[0]
    if not scheduled:
        _create_announcement_post(row)
        row = (server.db.get("scheduled_announcements", {"id": f"eq.{row['id']}", "select": "*", "limit": "1"}) or [row])[0]
    _audit(user, iid, "announcement.created", "announcement", row["id"], {"scheduled": scheduled})
    return row


@router.get("/institution/broadcasts")
def list_broadcasts(ctx: dict[str, Any] = Depends(require_operator("broadcasts.send"))) -> list[dict[str, Any]]:
    return server.db.get("institution_broadcasts", {"institution_id": f"eq.{ctx['institution_id']}", "select": "*", "order": "created_at.desc", "limit": "300"}) or []


@router.post("/institution/broadcasts")
def create_broadcast(payload: BroadcastDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("broadcasts.send"))) -> dict[str, Any]:
    iid = ctx["institution_id"]
    scheduled = bool(payload.scheduledAt and datetime.fromisoformat(payload.scheduledAt.replace("Z", "+00:00")) > datetime.now(timezone.utc))
    row = server.db.post("institution_broadcasts", {"institution_id": iid, "title": payload.title.strip(), "body": payload.body.strip(), "target": payload.target, "channels": payload.channels, "status": "scheduled" if scheduled else "draft", "scheduled_at": payload.scheduledAt, "created_by": user.id})[0]
    if not scheduled:
        stats = _send_broadcast(row)
        row = {**row, "status": "sent", "delivery_stats": stats}
    _audit(user, iid, "broadcast.created", "broadcast", row["id"], {"scheduled": scheduled})
    return row


@router.post("/institution/broadcasts/{broadcast_id}/send")
def send_broadcast_now(broadcast_id: str, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("broadcasts.send"))) -> dict[str, Any]:
    rows = server.db.get("institution_broadcasts", {"id": f"eq.{broadcast_id}", "institution_id": f"eq.{ctx['institution_id']}", "select": "*", "limit": "1"}) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    stats = _send_broadcast(rows[0])
    _audit(user, ctx["institution_id"], "broadcast.sent", "broadcast", broadcast_id, stats)
    return {"sent": True, **stats}


@router.get("/institution/verifications")
def list_verifications(status: str = "pending", ctx: dict[str, Any] = Depends(require_operator("verification.manage"))) -> list[dict[str, Any]]:
    params: dict[str, Any] = {"institution_id": f"eq.{ctx['institution_id']}", "select": "*", "order": "created_at.desc", "limit": "300"}
    if status != "all":
        params["status"] = f"eq.{status}"
    return server.db.get("campus_entity_verifications", params) or []


@router.post("/institution/verifications")
def request_verification(payload: VerificationDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("verification.manage"))) -> dict[str, Any]:
    row = server.db.post("campus_entity_verifications", {"institution_id": ctx["institution_id"], "entity_type": payload.entityType, "entity_id": payload.entityId, "status": "pending", "evidence": payload.evidence, "requested_by": user.id})[0]
    return row


@router.post("/institution/verifications/{verification_id}/decision")
def decide_verification(verification_id: str, payload: DecisionDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("verification.manage"))) -> dict[str, Any]:
    rows = server.db.get("campus_entity_verifications", {"id": f"eq.{verification_id}", "institution_id": f"eq.{ctx['institution_id']}", "select": "*", "limit": "1"}) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Verification request not found")
    source = rows[0]
    status = "verified" if payload.status == "approved" else "rejected" if payload.status == "rejected" else "pending"
    updated = server.db.patch("campus_entity_verifications", {"id": f"eq.{verification_id}"}, {"status": status, "review_message": payload.message or None, "reviewed_by": user.id, "reviewed_at": now_iso(), "updated_at": now_iso()})[0]
    if status == "verified" and source.get("entity_type") in {"group", "club", "society"}:
        server.db.patch("groups", {"id": f"eq.{source['entity_id']}", "institution_id": f"eq.{ctx['institution_id']}"}, {"official": True, "is_official": True, "updated_at": now_iso()})
    _audit(user, ctx["institution_id"], f"verification.{status}", source["entity_type"], source["entity_id"], {"message": payload.message})
    return updated


def _count(table: str, params: Optional[dict[str, Any]] = None) -> int:
    try:
        return len(server.db.get(table, {**(params or {}), "select": "id", "limit": "10000"}) or [])
    except Exception:
        return 0


@router.get("/institution/analytics")
def institution_analytics(ctx: dict[str, Any] = Depends(require_operator("analytics.view"))) -> dict[str, Any]:
    iid = ctx["institution_id"]
    memberships = server.db.get("user_institutions", {"institution_id": f"eq.{iid}", "verification_status": "eq.verified", "select": "user_id,department,year,created_at", "limit": "10000"}) or []
    groups = server.db.get("groups", {"institution_id": f"eq.{iid}", "deleted_at": "is.null", "select": "id,name", "limit": "1000"}) or []
    posts = server.db.get("posts", {"institution_id": f"eq.{iid}", "deleted_at": "is.null", "select": "id,group_id,created_at", "limit": "10000"}) or []
    group_stats = []
    for group in groups[:100]:
        members = server.db.get("group_members", {"group_id": f"eq.{group['id']}", "status": "eq.active", "select": "user_id", "limit": "10000"}) or []
        messages = server.db.get("messages", {"group_id": f"eq.{group['id']}", "deleted_at": "is.null", "select": "id", "limit": "10000"}) or []
        group_stats.append({"id": group["id"], "name": group["name"], "members": len(members), "messages": len(messages), "posts": sum(1 for post in posts if post.get("group_id") == group["id"])})
    group_stats.sort(key=lambda item: item["messages"] + item["posts"] * 3, reverse=True)
    departments: dict[str, int] = {}
    for membership in memberships:
        key = membership.get("department") or "Unassigned"
        departments[key] = departments.get(key, 0) + 1
    last_30 = datetime.now(timezone.utc) - timedelta(days=30)
    new_students = sum(1 for row in memberships if row.get("created_at") and datetime.fromisoformat(str(row["created_at"]).replace("Z", "+00:00")).replace(tzinfo=timezone.utc if datetime.fromisoformat(str(row["created_at"]).replace("Z", "+00:00")).tzinfo is None else datetime.fromisoformat(str(row["created_at"]).replace("Z", "+00:00")).tzinfo) >= last_30)
    return {
        "students": {"total": len(memberships), "new30d": new_students, "byDepartment": departments},
        "groups": {"total": len(groups), "top": group_stats[:10]},
        "content": {"posts": len(posts), "events": _count("campus_events", {"institution_id": f"eq.{iid}"}), "broadcasts": _count("institution_broadcasts", {"institution_id": f"eq.{iid}"})},
        "moderation": {"openSignals": _count("content_intelligence_signals", {"institution_id": f"eq.{iid}", "status": "eq.open"})},
    }


@router.get("/institution/audit")
def institution_audit(limit: int = Query(100, ge=1, le=500), ctx: dict[str, Any] = Depends(require_operator("analytics.view"))) -> list[dict[str, Any]]:
    return server.db.get("user_activity_events", {"institution_id": f"eq.{ctx['institution_id']}", "select": "*", "order": "created_at.desc", "limit": str(limit)}) or []


@router.get("/institution/storage")
def institution_storage(ctx: dict[str, Any] = Depends(require_operator("storage.view"))) -> dict[str, Any]:
    rows = server.db.get("institution_media_assets", {"institution_id": f"eq.{ctx['institution_id']}", "select": "kind,mime_type,bytes,created_at", "limit": "10000"}) or []
    total = sum(int(row.get("bytes") or 0) for row in rows)
    by_kind: dict[str, int] = {}
    for row in rows:
        key = row.get("kind") or "file"
        by_kind[key] = by_kind.get(key, 0) + int(row.get("bytes") or 0)
    return {"bytes": total, "megabytes": round(total / 1024 / 1024, 2), "files": len(rows), "byKind": by_kind}


def _simple_pdf(lines: list[str]) -> bytes:
    safe_lines = [line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")[:110] for line in lines[:120]]
    y = 790
    commands = ["BT", "/F1 10 Tf"]
    for line in safe_lines:
        commands.append(f"1 0 0 1 40 {y} Tm ({line}) Tj")
        y -= 14
        if y < 40:
            break
    commands.append("ET")
    stream = "\n".join(commands).encode("latin-1", "replace")
    objects = [
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj\n",
        f"4 0 obj << /Length {len(stream)} >> stream\n".encode() + stream + b"\nendstream endobj\n",
        b"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
    ]
    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(pdf))
        pdf.extend(obj)
    xref = len(pdf)
    pdf.extend(f"xref\n0 {len(objects)+1}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode())
    pdf.extend(f"trailer << /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode())
    return bytes(pdf)


@router.get("/institution/export")
def export_institution_data(dataset: Literal["students", "staff", "events", "analytics"] = "students", format: Literal["csv", "pdf"] = "csv", ctx: dict[str, Any] = Depends(require_operator("exports.view"))) -> Response:
    iid = ctx["institution_id"]
    if dataset == "students":
        rows = server.db.get("user_institutions", {"institution_id": f"eq.{iid}", "select": "user_id,verification_status,role,department,year,semester,roll_number,official_email,created_at", "limit": "10000"}) or []
    elif dataset == "staff":
        rows = server.db.get("institution_staff", {"institution_id": f"eq.{iid}", "select": "id,name,email,phone,title,status,department_id,role_id,created_at", "limit": "10000"}) or []
    elif dataset == "events":
        rows = server.db.get("campus_events", {"institution_id": f"eq.{iid}", "select": "id,title,location,start_at,end_at,status,capacity,created_at", "limit": "10000"}) or []
    else:
        rows = [{"metric": key, "value": value} for key, value in institution_analytics(ctx).items()]
    if format == "pdf":
        lines = [f"OnCampus Institution Export: {dataset}", f"Generated: {now_iso()}", ""] + [json.dumps(row, ensure_ascii=True, default=str) for row in rows]
        return Response(_simple_pdf(lines), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="oncampus-{dataset}.pdf"'})
    output = io.StringIO()
    if rows:
        keys = sorted({key for row in rows for key in row.keys()})
        writer = csv.DictWriter(output, fieldnames=keys)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else value for key, value in row.items()})
    return Response(output.getvalue().encode("utf-8-sig"), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="oncampus-{dataset}.csv"'})


BACKUP_TABLES = ["institution_departments", "institution_roles", "institution_staff", "campus_events", "campus_opportunities", "campus_places", "campus_integrations", "campus_invites", "campus_entity_verifications"]


@router.get("/institution/backups")
def list_backups(ctx: dict[str, Any] = Depends(require_operator("backup.manage"))) -> list[dict[str, Any]]:
    rows = server.db.get("institution_backups", {"institution_id": f"eq.{ctx['institution_id']}", "select": "id,label,item_counts,status,created_by,restored_by,restored_at,created_at", "order": "created_at.desc", "limit": "100"}) or []
    return rows


@router.post("/institution/backups")
def create_backup(label: str = Query("Manual backup", min_length=1, max_length=120), user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("backup.manage"))) -> dict[str, Any]:
    iid = ctx["institution_id"]
    snapshot: dict[str, Any] = {}
    counts: dict[str, int] = {}
    for table in BACKUP_TABLES:
        data = server.db.get(table, {"institution_id": f"eq.{iid}", "select": "*", "limit": "10000"}) or []
        snapshot[table] = data
        counts[table] = len(data)
    row = server.db.post("institution_backups", {"institution_id": iid, "label": label.strip(), "snapshot": snapshot, "item_counts": counts, "status": "ready", "created_by": user.id})[0]
    _audit(user, iid, "backup.created", "backup", row["id"], counts)
    return {key: row.get(key) for key in ["id", "label", "item_counts", "status", "created_at"]}


@router.post("/institution/backups/{backup_id}/restore")
def restore_backup(backup_id: str, confirm: bool = Query(False), user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("backup.manage"))) -> dict[str, Any]:
    if not confirm:
        raise HTTPException(status_code=409, detail="Restore requires confirm=true")
    iid = ctx["institution_id"]
    backups = server.db.get("institution_backups", {"id": f"eq.{backup_id}", "institution_id": f"eq.{iid}", "select": "*", "limit": "1"}) or []
    if not backups:
        raise HTTPException(status_code=404, detail="Backup not found")
    snapshot = backups[0].get("snapshot") or {}
    restored = 0
    # Safe merge restore: never deletes current production data.
    for table in BACKUP_TABLES:
        for row in snapshot.get(table, []) if isinstance(snapshot.get(table), list) else []:
            if row.get("institution_id") != iid or not row.get("id"):
                continue
            existing = server.db.get(table, {"id": f"eq.{row['id']}", "institution_id": f"eq.{iid}", "select": "id", "limit": "1"}) or []
            payload = {key: value for key, value in row.items() if key not in {"created_at"}}
            if existing:
                server.db.patch(table, {"id": f"eq.{row['id']}", "institution_id": f"eq.{iid}"}, payload)
            else:
                server.db.post(table, row)
            restored += 1
    server.db.patch("institution_backups", {"id": f"eq.{backup_id}"}, {"status": "restored", "restored_by": user.id, "restored_at": now_iso()})
    _audit(user, iid, "backup.restored", "backup", backup_id, {"items": restored})
    return {"restored": True, "items": restored}


@router.get("/institution/webhooks")
def list_webhooks(ctx: dict[str, Any] = Depends(require_operator("integrations.manage"))) -> list[dict[str, Any]]:
    rows = server.db.get("institution_webhooks", {"institution_id": f"eq.{ctx['institution_id']}", "select": "id,name,url,events,active,last_status,last_delivery_at,failure_count,last_error,created_at,updated_at", "order": "created_at.desc"}) or []
    return rows


@router.post("/institution/webhooks")
def create_webhook(payload: WebhookDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("integrations.manage"))) -> dict[str, Any]:
    url = _validate_public_https_url(payload.url)
    secret = secrets.token_urlsafe(36)
    row = server.db.post("institution_webhooks", {"institution_id": ctx["institution_id"], "name": payload.name.strip(), "url": url, "events": sorted(set(payload.events or ["*"])), "secret_hash": hashlib.sha256(secret.encode()).hexdigest(), "secret_ciphertext": _fernet().encrypt(secret.encode()).decode(), "active": True, "created_by": user.id})[0]
    _audit(user, ctx["institution_id"], "webhook.created", "webhook", row["id"], {"url": url, "events": row["events"]})
    return {"id": row["id"], "name": row["name"], "url": row["url"], "events": row["events"], "active": True, "secret": secret, "warning": "Save this secret now. It will not be shown again."}


@router.patch("/institution/webhooks/{webhook_id}")
def update_webhook(webhook_id: str, payload: WebhookDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("integrations.manage"))) -> dict[str, Any]:
    url = _validate_public_https_url(payload.url)
    rows = server.db.patch("institution_webhooks", {"id": f"eq.{webhook_id}", "institution_id": f"eq.{ctx['institution_id']}"}, {"name": payload.name.strip(), "url": url, "events": sorted(set(payload.events or ["*"])), "updated_at": now_iso()}) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Webhook not found")
    _audit(user, ctx["institution_id"], "webhook.updated", "webhook", webhook_id, {"url": url})
    return {key: rows[0].get(key) for key in ["id", "name", "url", "events", "active", "last_status", "last_delivery_at", "failure_count"]}


@router.get("/institution/invites")
def list_invites(ctx: dict[str, Any] = Depends(require_operator("invites.manage"))) -> list[dict[str, Any]]:
    rows = server.db.get("campus_invites", {"institution_id": f"eq.{ctx['institution_id']}", "select": "*", "order": "created_at.desc", "limit": "300"}) or []
    for row in rows:
        row["joinUrl"] = f"oncampus://join?code={row['code']}"
        row["qrUrl"] = f"/v1/campus/invites/{row['code']}/qr"
    return rows


@router.post("/institution/invites")
def create_invite(payload: InviteDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("invites.manage"))) -> dict[str, Any]:
    code = secrets.token_urlsafe(18).replace("-", "A").replace("_", "B")
    row = server.db.post("campus_invites", {"institution_id": ctx["institution_id"], "code": code, "invite_type": payload.inviteType, "target_id": payload.targetId, "auto_approve": payload.autoApprove, "max_uses": payload.maxUses, "expires_at": payload.expiresAt, "active": True, "created_by": user.id})[0]
    _audit(user, ctx["institution_id"], "invite.created", "invite", row["id"], {"type": payload.inviteType})
    return {**row, "joinUrl": f"oncampus://join?code={code}", "qrUrl": f"/v1/campus/invites/{code}/qr"}


@router.get("/invites/{code}")
def get_invite(code: str) -> dict[str, Any]:
    rows = server.db.get("campus_invites", {"code": f"eq.{code}", "active": "eq.true", "select": "*", "limit": "1"}) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Invite is invalid or expired")
    row = rows[0]
    if row.get("expires_at") and datetime.fromisoformat(str(row["expires_at"]).replace("Z", "+00:00")) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Invite has expired")
    if row.get("max_uses") is not None and int(row.get("use_count") or 0) >= int(row["max_uses"]):
        raise HTTPException(status_code=410, detail="Invite has reached its usage limit")
    inst = server.db.get("institutions", {"id": f"eq.{row['institution_id']}", "select": "id,name,logo_url,city,state", "limit": "1"}) or []
    return {"code": code, "inviteType": row["invite_type"], "institution": inst[0] if inst else None, "targetId": row.get("target_id"), "autoApprove": bool(row.get("auto_approve")), "expiresAt": row.get("expires_at")}


@router.post("/invites/{code}/accept")
def accept_invite(code: str, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    info = get_invite(code)
    rows = server.db.get("campus_invites", {"code": f"eq.{code}", "active": "eq.true", "select": "*", "limit": "1"}) or []
    row = rows[0]
    iid = row["institution_id"]
    if row["invite_type"] == "institution":
        existing = server.db.get("user_institutions", {"user_id": f"eq.{user.id}", "institution_id": f"eq.{iid}", "select": "user_id", "limit": "1"}) or []
        verification = "verified" if row.get("auto_approve") else "pending"
        if existing:
            server.db.patch("user_institutions", {"user_id": f"eq.{user.id}", "institution_id": f"eq.{iid}"}, {"verification_status": verification, "verified_at": now_iso() if verification == "verified" else None})
        else:
            server.db.post("user_institutions", {"user_id": user.id, "institution_id": iid, "verification_status": verification, "role": "student", "verified_at": now_iso() if verification == "verified" else None})
        approval_existing = server.db.get("institution_student_approvals", {"user_id": f"eq.{user.id}", "institution_id": f"eq.{iid}", "select": "id", "limit": "1"}) or []
        approval_values = {"status": "approved" if verification == "verified" else "pending", "source": "invite", "updated_at": now_iso()}
        if approval_existing:
            server.db.patch("institution_student_approvals", {"id": f"eq.{approval_existing[0]['id']}"}, approval_values)
        else:
            server.db.post("institution_student_approvals", {"institution_id": iid, "user_id": user.id, **approval_values})
    elif row["invite_type"] == "group" and row.get("target_id"):
        existing_request = server.db.get("join_requests", {"group_id": f"eq.{row['target_id']}", "user_id": f"eq.{user.id}", "status": "eq.pending", "select": "id", "limit": "1"}) or []
        if not existing_request:
            server.db.post("join_requests", {"group_id": row["target_id"], "user_id": user.id, "status": "pending", "source": "invite"})
    server.db.patch("campus_invites", {"id": f"eq.{row['id']}"}, {"use_count": int(row.get("use_count") or 0) + 1})
    _activity(user.id, iid, "invite.accepted", row["invite_type"], row.get("target_id"), {"inviteId": row["id"]})
    emit_webhook(iid, "invite.accepted", {"userId": user.id, "inviteId": row["id"], "type": row["invite_type"]})
    return {"accepted": True, "status": "approved" if row.get("auto_approve") else "pending", **info}


@router.get("/invites/{code}/qr")
def invite_qr(code: str) -> Response:
    get_invite(code)
    try:
        import qrcode
        from qrcode.image.svg import SvgPathImage
    except Exception:
        raise HTTPException(status_code=503, detail="QR renderer is temporarily unavailable")
    image = qrcode.make(f"oncampus://join?code={code}", image_factory=SvgPathImage, box_size=8, border=3)
    buffer = io.BytesIO()
    image.save(buffer)
    return Response(buffer.getvalue(), media_type="image/svg+xml", headers={"Cache-Control": "public, max-age=300"})


@router.post("/posts/{post_id}/reaction")
def set_reaction(post_id: str, payload: ReactionDto, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    post = server.db.get("posts", {"id": f"eq.{post_id}", "deleted_at": "is.null", "select": "id,institution_id,reactions_enabled", "limit": "1"}) or []
    if not post or post[0].get("reactions_enabled") is False:
        raise HTTPException(status_code=404, detail="Post is not available for reactions")
    server.db.delete("post_reactions", {"post_id": f"eq.{post_id}", "user_id": f"eq.{user.id}"})
    if payload.reaction:
        server.db.post("post_reactions", {"post_id": post_id, "user_id": user.id, "reaction": payload.reaction})
    rows = server.db.get("post_reactions", {"post_id": f"eq.{post_id}", "select": "reaction", "limit": "10000"}) or []
    counts: dict[str, int] = {}
    for row in rows:
        counts[row["reaction"]] = counts.get(row["reaction"], 0) + 1
    _activity(user.id, post[0].get("institution_id"), "post.reaction", "post", post_id, {"reaction": payload.reaction})
    return {"reaction": payload.reaction, "counts": counts, "total": len(rows)}


@router.get("/posts/{post_id}/reactions")
def reaction_summary(post_id: str, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    rows = server.db.get("post_reactions", {"post_id": f"eq.{post_id}", "select": "user_id,reaction", "limit": "10000"}) or []
    counts: dict[str, int] = {}
    mine = None
    for row in rows:
        counts[row["reaction"]] = counts.get(row["reaction"], 0) + 1
        if row.get("user_id") == user.id:
            mine = row["reaction"]
    return {"counts": counts, "total": len(rows), "mine": mine}


@router.post("/institution/polls")
def create_poll(payload: PollDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("events.manage"))) -> dict[str, Any]:
    post = server.db.get("posts", {"id": f"eq.{payload.postId}", "institution_id": f"eq.{ctx['institution_id']}", "select": "id", "limit": "1"}) or []
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    poll = server.db.post("post_polls", {"post_id": payload.postId, "question": payload.question.strip(), "multiple_choice": payload.multipleChoice, "anonymous": payload.anonymous, "closes_at": payload.closesAt, "created_by": user.id})[0]
    options = []
    for index, label in enumerate(payload.options):
        options.append(server.db.post("post_poll_options", {"poll_id": poll["id"], "label": clean_text(label, 200), "sort_order": index})[0])
    return {**poll, "options": options}


@router.get("/posts/{post_id}/poll")
def get_poll(post_id: str, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    polls = server.db.get("post_polls", {"post_id": f"eq.{post_id}", "select": "*", "limit": "1"}) or []
    if not polls:
        raise HTTPException(status_code=404, detail="Poll not found")
    poll = polls[0]
    options = server.db.get("post_poll_options", {"poll_id": f"eq.{poll['id']}", "select": "*", "order": "sort_order.asc"}) or []
    votes = server.db.get("post_poll_votes", {"poll_id": f"eq.{poll['id']}", "select": "option_id,user_id", "limit": "10000"}) or []
    counts: dict[str, int] = {option["id"]: 0 for option in options}
    mine = []
    for vote in votes:
        counts[vote["option_id"]] = counts.get(vote["option_id"], 0) + 1
        if vote.get("user_id") == user.id:
            mine.append(vote["option_id"])
    return {**poll, "options": [{**option, "votes": counts.get(option["id"], 0)} for option in options], "myVotes": mine, "totalVotes": len(votes)}


@router.post("/polls/{poll_id}/vote")
def vote_poll(poll_id: str, payload: PollVoteDto, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    polls = server.db.get("post_polls", {"id": f"eq.{poll_id}", "select": "*", "limit": "1"}) or []
    if not polls:
        raise HTTPException(status_code=404, detail="Poll not found")
    poll = polls[0]
    if poll.get("closes_at") and datetime.fromisoformat(str(poll["closes_at"]).replace("Z", "+00:00")) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=409, detail="Poll is closed")
    if not poll.get("multiple_choice") and len(payload.optionIds) != 1:
        raise HTTPException(status_code=422, detail="Choose exactly one option")
    valid = server.db.get("post_poll_options", {"poll_id": f"eq.{poll_id}", "select": "id"}) or []
    valid_ids = {row["id"] for row in valid}
    if any(option_id not in valid_ids for option_id in payload.optionIds):
        raise HTTPException(status_code=422, detail="Invalid poll option")
    server.db.delete("post_poll_votes", {"poll_id": f"eq.{poll_id}", "user_id": f"eq.{user.id}"})
    for option_id in sorted(set(payload.optionIds)):
        server.db.post("post_poll_votes", {"poll_id": poll_id, "option_id": option_id, "user_id": user.id})
    return {"voted": True, "optionIds": payload.optionIds}


def _search_table(table: str, field: str, query: str, select: str, limit: int = 10, extra: Optional[dict[str, Any]] = None) -> list[dict[str, Any]]:
    params = {field: f"ilike.%{query}%", "select": select, "limit": str(limit), **(extra or {})}
    try:
        return server.db.get(table, params) or []
    except Exception:
        return []


@router.get("/search")
def global_search(q: str = Query(..., min_length=2, max_length=160), user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    query = _safe_query(q)
    membership = student_membership(user.id, require_verified=False)
    iid = membership["institution_id"]
    groups = _search_table("groups", "name", query, "id,name,description,category,city,avatar_url,official,is_official,institution_id", 15, {"deleted_at": "is.null"})
    posts = _search_table("posts", "title", query, "id,title,content,type,institution_id,group_id,created_at,published_at", 15, {"institution_id": f"eq.{iid}", "deleted_at": "is.null", "status": "eq.published"})
    events = _search_table("campus_events", "title", query, "id,title,description,location,start_at,end_at,image_url", 15, {"institution_id": f"eq.{iid}", "status": "in.(published,scheduled)"})
    opportunities = _search_table("campus_opportunities", "title", query, "id,kind,title,organization,description,location,deadline", 15, {"institution_id": f"eq.{iid}", "status": "eq.published"})
    marketplace = _search_table("campus_marketplace_items", "title", query, "id,title,description,category,price,currency,image_urls,status", 10, {"institution_id": f"eq.{iid}", "status": "eq.active"})
    lost_found = _search_table("campus_lost_found_items", "title", query, "id,kind,title,description,location,event_at,image_url,status", 10, {"institution_id": f"eq.{iid}", "status": "eq.open"})
    results = {"groups": groups, "posts": posts, "events": events, "opportunities": opportunities, "marketplace": marketplace, "lostFound": lost_found}
    count = sum(len(value) for value in results.values())
    server.db.post("user_search_history", {"user_id": user.id, "query": query, "scope": "global", "result_count": count})
    _activity(user.id, iid, "search", "query", None, {"query": query, "results": count})
    return {"query": query, "resultCount": count, "ranking": "oncampus-smart-v1", **results}


@router.get("/search/history")
def search_history(user: server.CurrentUser = Depends(server.current_user)) -> list[dict[str, Any]]:
    return server.db.get("user_search_history", {"user_id": f"eq.{user.id}", "select": "id,query,scope,result_count,created_at", "order": "created_at.desc", "limit": "50"}) or []


@router.delete("/search/history")
def clear_search_history(user: server.CurrentUser = Depends(server.current_user)) -> dict[str, bool]:
    server.db.delete("user_search_history", {"user_id": f"eq.{user.id}"})
    return {"cleared": True}


@router.get("/trending")
def trending(user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    membership = student_membership(user.id, require_verified=False)
    iid = membership["institution_id"]
    recent = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    tags = server.db.get("post_hashtags", {"created_at": f"gte.{recent}", "select": "tag,post_id", "limit": "10000"}) or []
    tag_counts: dict[str, int] = {}
    for row in tags:
        tag_counts[row["tag"]] = tag_counts.get(row["tag"], 0) + 1
    posts = server.db.get("posts", {"institution_id": f"eq.{iid}", "status": "eq.published", "deleted_at": "is.null", "created_at": f"gte.{recent}", "select": "id,title,content,type,created_at,published_at", "order": "created_at.desc", "limit": "100"}) or []
    scored = []
    for post in posts:
        reactions = len(server.db.get("post_reactions", {"post_id": f"eq.{post['id']}", "select": "user_id", "limit": "10000"}) or [])
        views = len(server.db.get("post_views", {"post_id": f"eq.{post['id']}", "select": "id", "limit": "10000"}) or [])
        scored.append({**post, "score": reactions * 4 + views, "reactions": reactions, "views": views})
    scored.sort(key=lambda item: item["score"], reverse=True)
    events = server.db.get("campus_events", {"institution_id": f"eq.{iid}", "end_at": f"gte.{now_iso()}", "status": "in.(published,scheduled)", "select": "id,title,start_at,location,image_url", "order": "start_at.asc", "limit": "10"}) or []
    return {"hashtags": [{"tag": tag, "count": count} for tag, count in sorted(tag_counts.items(), key=lambda item: item[1], reverse=True)[:20]], "posts": scored[:20], "events": events}


@router.post("/feedback")
def create_feedback(payload: FeedbackDto, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    membership = None
    try:
        membership = student_membership(user.id, require_verified=False)
    except HTTPException:
        pass
    row = server.db.post("user_feedback", {"user_id": user.id, "institution_id": membership.get("institution_id") if membership else None, "category": payload.category.strip(), "subject": payload.subject.strip(), "message": payload.message.strip(), "rating": payload.rating, "status": "open", "metadata": {"source": "mobile"}})[0]
    _activity(user.id, row.get("institution_id"), "feedback.created", "feedback", row["id"], {"category": payload.category})
    return row


@router.post("/groups/{group_id}/archive")
def archive_group(group_id: str, archived: bool = Query(True), user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    server.require_group_member(group_id, user)
    server.db.delete("user_archived_groups", {"user_id": f"eq.{user.id}", "group_id": f"eq.{group_id}"})
    if archived:
        server.db.post("user_archived_groups", {"user_id": user.id, "group_id": group_id})
    return {"groupId": group_id, "archived": archived}


@router.post("/groups/{group_id}/mute")
def mute_group(group_id: str, muted: bool = Query(True), user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    server.require_group_member(group_id, user)
    rows = server.db.patch("group_members", {"group_id": f"eq.{group_id}", "user_id": f"eq.{user.id}"}, {"muted": muted, "muted_at": now_iso() if muted else None, "updated_at": now_iso()}) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Group membership not found")
    return {"groupId": group_id, "muted": muted}


@router.get("/activity")
def recent_activity(user: server.CurrentUser = Depends(server.current_user)) -> list[dict[str, Any]]:
    return server.db.get("user_activity_events", {"user_id": f"eq.{user.id}", "select": "*", "order": "created_at.desc", "limit": "100"}) or []


@router.get("/changelog")
def changelog(user: server.CurrentUser = Depends(server.current_user)) -> list[dict[str, Any]]:
    audience = "institutions" if _admin_context(user) else "students"
    rows = server.db.get("changelog_entries", {"published": "eq.true", "select": "*", "order": "published_at.desc", "limit": "50"}) or []
    return [row for row in rows if row.get("audience") in {"all", audience}]


@router.get("/marketplace")
def marketplace(user: server.CurrentUser = Depends(server.current_user)) -> list[dict[str, Any]]:
    membership = student_membership(user.id)
    return server.db.get("campus_marketplace_items", {"institution_id": f"eq.{membership['institution_id']}", "status": "eq.active", "select": "*", "order": "created_at.desc", "limit": "200"}) or []


@router.post("/marketplace")
def create_marketplace_item(payload: MarketplaceDto, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    membership = student_membership(user.id)
    row = server.db.post("campus_marketplace_items", {"institution_id": membership["institution_id"], "seller_user_id": user.id, "title": payload.title.strip(), "description": payload.description.strip(), "category": payload.category.strip(), "price": payload.price, "currency": payload.currency.upper(), "image_urls": payload.imageUrls, "status": "active"})[0]
    _activity(user.id, membership["institution_id"], "marketplace.created", "marketplace", row["id"])
    return row


@router.get("/lost-found")
def lost_found(user: server.CurrentUser = Depends(server.current_user)) -> list[dict[str, Any]]:
    membership = student_membership(user.id)
    return server.db.get("campus_lost_found_items", {"institution_id": f"eq.{membership['institution_id']}", "status": "eq.open", "select": "*", "order": "created_at.desc", "limit": "200"}) or []


@router.post("/lost-found")
def create_lost_found(payload: LostFoundDto, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    membership = student_membership(user.id)
    row = server.db.post("campus_lost_found_items", {"institution_id": membership["institution_id"], "user_id": user.id, "kind": payload.kind, "title": payload.title.strip(), "description": payload.description.strip(), "location": payload.location, "event_at": payload.eventAt, "image_url": payload.imageUrl, "status": "open"})[0]
    _activity(user.id, membership["institution_id"], "lost_found.created", "lost_found", row["id"], {"kind": payload.kind})
    return row


@router.get("/opportunities")
def opportunities(user: server.CurrentUser = Depends(server.current_user)) -> list[dict[str, Any]]:
    membership = student_membership(user.id)
    return server.db.get("campus_opportunities", {"institution_id": f"eq.{membership['institution_id']}", "status": "eq.published", "select": "*", "order": "created_at.desc", "limit": "200"}) or []


@router.post("/institution/opportunities")
def create_opportunity(payload: OpportunityDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("opportunities.manage"))) -> dict[str, Any]:
    if payload.applyUrl:
        parsed = urlparse(payload.applyUrl)
        if parsed.scheme not in {"https", "http"}:
            raise HTTPException(status_code=422, detail="Application URL must be HTTP(S)")
    row = server.db.post("campus_opportunities", {"institution_id": ctx["institution_id"], "kind": payload.kind, "title": payload.title.strip(), "organization": payload.organization, "description": payload.description.strip(), "location": payload.location, "apply_url": payload.applyUrl, "deadline": payload.deadline, "status": "published", "created_by": user.id})[0]
    _audit(user, ctx["institution_id"], "opportunity.created", "opportunity", row["id"], {"kind": payload.kind})
    return row


@router.get("/places")
def places(user: server.CurrentUser = Depends(server.current_user)) -> list[dict[str, Any]]:
    membership = student_membership(user.id)
    return server.db.get("campus_places", {"institution_id": f"eq.{membership['institution_id']}", "active": "eq.true", "select": "*", "order": "name.asc", "limit": "500"}) or []


@router.post("/institution/places")
def create_place(payload: PlaceDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("places.manage"))) -> dict[str, Any]:
    row = server.db.post("campus_places", {"institution_id": ctx["institution_id"], "name": payload.name.strip(), "category": payload.category.strip(), "description": payload.description, "latitude": payload.latitude, "longitude": payload.longitude, "floor": payload.floor, "active": True})[0]
    _audit(user, ctx["institution_id"], "place.created", "place", row["id"], {"name": row["name"]})
    return row


@router.get("/institution/attendance")
def list_attendance_sessions(ctx: dict[str, Any] = Depends(require_operator("attendance.manage"))) -> list[dict[str, Any]]:
    return server.db.get("campus_attendance_sessions", {"institution_id": f"eq.{ctx['institution_id']}", "select": "*", "order": "starts_at.desc", "limit": "300"}) or []


@router.post("/institution/attendance")
def create_attendance_session(payload: AttendanceSessionDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("attendance.manage"))) -> dict[str, Any]:
    row = server.db.post("campus_attendance_sessions", {"institution_id": ctx["institution_id"], "department_id": payload.departmentId, "title": payload.title.strip(), "starts_at": payload.startsAt, "ends_at": payload.endsAt, "geofence": payload.geofence, "status": "scheduled", "created_by": user.id})[0]
    _audit(user, ctx["institution_id"], "attendance.created", "attendance", row["id"], {"title": row["title"]})
    return row


@router.post("/institution/attendance/{session_id}/record")
def record_attendance(session_id: str, payload: AttendanceRecordDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("attendance.manage"))) -> dict[str, Any]:
    session = server.db.get("campus_attendance_sessions", {"id": f"eq.{session_id}", "institution_id": f"eq.{ctx['institution_id']}", "select": "id", "limit": "1"}) or []
    if not session:
        raise HTTPException(status_code=404, detail="Attendance session not found")
    existing = server.db.get("campus_attendance_records", {"session_id": f"eq.{session_id}", "user_id": f"eq.{payload.userId}", "select": "session_id", "limit": "1"}) or []
    values = {"status": payload.status, "checkin_at": now_iso() if payload.status in {"present", "late"} else None, "method": payload.method, "metadata": {"recordedBy": user.id}}
    row = server.db.patch("campus_attendance_records", {"session_id": f"eq.{session_id}", "user_id": f"eq.{payload.userId}"}, values)[0] if existing else server.db.post("campus_attendance_records", {"session_id": session_id, "user_id": payload.userId, **values})[0]
    return row


@router.get("/institution/integrations")
def list_integrations(ctx: dict[str, Any] = Depends(require_operator("integrations.manage"))) -> list[dict[str, Any]]:
    return server.db.get("campus_integrations", {"institution_id": f"eq.{ctx['institution_id']}", "select": "id,kind,name,base_url,config,active,last_sync_at,last_status,created_at,updated_at", "order": "created_at.desc"}) or []


@router.post("/institution/integrations")
def create_integration(payload: IntegrationDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("integrations.manage"))) -> dict[str, Any]:
    if payload.baseUrl and urlparse(payload.baseUrl).scheme != "https":
        raise HTTPException(status_code=422, detail="Integration base URL must use HTTPS")
    row = server.db.post("campus_integrations", {"institution_id": ctx["institution_id"], "kind": payload.kind, "name": payload.name.strip(), "base_url": payload.baseUrl, "config": payload.config, "secret_ref": payload.secretRef, "active": payload.active, "created_by": user.id})[0]
    _audit(user, ctx["institution_id"], "integration.created", "integration", row["id"], {"kind": payload.kind})
    return {key: row.get(key) for key in ["id", "kind", "name", "base_url", "config", "active", "last_sync_at", "last_status", "created_at"]}


@router.get("/digital-id")
def my_digital_id(user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    rows = server.db.get("campus_digital_ids", {"user_id": f"eq.{user.id}", "select": "*", "limit": "1"}) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Digital ID has not been issued yet")
    return rows[0]


@router.post("/institution/digital-id")
def issue_digital_id(payload: DigitalIdDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("digital_id.manage"))) -> dict[str, Any]:
    iid = ctx["institution_id"]
    membership = server.db.get("user_institutions", {"user_id": f"eq.{payload.userId}", "institution_id": f"eq.{iid}", "verification_status": "eq.verified", "select": "user_id", "limit": "1"}) or []
    if not membership:
        raise HTTPException(status_code=409, detail="Only verified institution members can receive a digital ID")
    existing = server.db.get("campus_digital_ids", {"user_id": f"eq.{payload.userId}", "select": "user_id", "limit": "1"}) or []
    values = {"institution_id": iid, "public_id": f"OC-{secrets.token_hex(8).upper()}", "department_id": payload.departmentId, "valid_until": payload.validUntil, "status": "active", "metadata": payload.metadata}
    row = server.db.patch("campus_digital_ids", {"user_id": f"eq.{payload.userId}"}, values)[0] if existing else server.db.post("campus_digital_ids", {"user_id": payload.userId, **values})[0]
    _notify_user(payload.userId, "Digital campus ID ready", "Your institution has issued your OnCampus digital ID.", "digital_id", {"publicId": row["public_id"]})
    _audit(user, iid, "digital_id.issued", "user", payload.userId, {"publicId": row["public_id"]})
    return row


@router.get("/emergency")
def active_emergency_alerts(user: server.CurrentUser = Depends(server.current_user)) -> list[dict[str, Any]]:
    membership = student_membership(user.id)
    return server.db.get("campus_emergency_alerts", {"institution_id": f"eq.{membership['institution_id']}", "status": "eq.active", "select": "*", "order": "created_at.desc", "limit": "50"}) or []


@router.post("/institution/emergency")
def send_emergency(payload: EmergencyDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("emergency.send"))) -> dict[str, Any]:
    iid = ctx["institution_id"]
    row = server.db.post("campus_emergency_alerts", {"institution_id": iid, "title": payload.title.strip(), "body": payload.body.strip(), "severity": payload.severity, "target": payload.target, "status": "active", "created_by": user.id})[0]
    recipients = _institution_users(iid, payload.target)
    for member in recipients:
        _notify_user(member["user_id"], payload.title, payload.body, "emergency_alert", {"alertId": row["id"], "severity": payload.severity}, push=True)
    _audit(user, iid, "emergency.sent", "emergency", row["id"], {"severity": payload.severity, "recipients": len(recipients)})
    emit_webhook(iid, "emergency.sent", {"alertId": row["id"], "severity": payload.severity})
    return {**row, "recipients": len(recipients)}


@router.get("/alumni")
def alumni_directory(user: server.CurrentUser = Depends(server.current_user)) -> list[dict[str, Any]]:
    membership = student_membership(user.id)
    return server.db.get("campus_alumni_profiles", {"institution_id": f"eq.{membership['institution_id']}", "visible": "eq.true", "select": "*", "order": "graduation_year.desc", "limit": "500"}) or []


@router.post("/alumni/me")
def upsert_alumni(payload: AlumniDto, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    membership = student_membership(user.id)
    existing = server.db.get("campus_alumni_profiles", {"user_id": f"eq.{user.id}", "select": "user_id", "limit": "1"}) or []
    values = {"institution_id": membership["institution_id"], "graduation_year": payload.graduationYear, "course": payload.course, "employer": payload.employer, "job_title": payload.jobTitle, "city": payload.city, "mentorship_available": payload.mentorshipAvailable, "visible": payload.visible, "updated_at": now_iso()}
    return server.db.patch("campus_alumni_profiles", {"user_id": f"eq.{user.id}"}, values)[0] if existing else server.db.post("campus_alumni_profiles", {"user_id": user.id, **values})[0]


def _normalize_content(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def _intelligence_scores(text: str, institution_id: str, target_type: str, target_id: str) -> list[dict[str, Any]]:
    normalized = _normalize_content(text)
    words = normalized.split()
    url_count = len(re.findall(r"https?://|www\.", text, flags=re.I))
    repeated = max((words.count(word) for word in set(words)), default=0)
    caps_letters = [char for char in text if char.isalpha()]
    caps_ratio = (sum(char.isupper() for char in caps_letters) / len(caps_letters)) if caps_letters else 0
    spam_score = min(1.0, url_count * 0.18 + max(0, repeated - 4) * 0.06 + max(0, caps_ratio - 0.55) * 0.8)
    quality_score = min(1.0, len(words) / 45) * (1 - min(spam_score, 0.8))

    duplicate_score = 0.0
    recent = server.db.get("posts", {"institution_id": f"eq.{institution_id}", "deleted_at": "is.null", "select": "id,content,title", "order": "created_at.desc", "limit": "80"}) or []
    tokens = set(words)
    for post in recent:
        if post.get("id") == target_id:
            continue
        other = set(_normalize_content(f"{post.get('title') or ''} {post.get('content') or ''}").split())
        if not tokens or not other:
            continue
        similarity = len(tokens & other) / max(1, len(tokens | other))
        duplicate_score = max(duplicate_score, similarity)

    moderation_score = spam_score
    try:
        blocked = server.db.get("blocked_keywords", {"select": "keyword", "limit": "1000"}) or []
        matches = [str(row.get("keyword") or "") for row in blocked if row.get("keyword") and str(row["keyword"]).lower() in text.lower()]
        if matches:
            moderation_score = max(moderation_score, min(1.0, 0.7 + len(matches) * 0.08))
    except Exception:
        matches = []

    return [
        {"signal_type": "spam", "score": round(spam_score, 4), "labels": ["links"] if url_count > 3 else [], "explanation": "Local anti-spam heuristic"},
        {"signal_type": "duplicate", "score": round(duplicate_score, 4), "labels": ["similar_content"] if duplicate_score >= 0.72 else [], "explanation": "Recent campus content similarity"},
        {"signal_type": "moderation", "score": round(moderation_score, 4), "labels": ["blocked_keyword"] if matches else [], "explanation": "Policy keyword and spam risk"},
        {"signal_type": "quality", "score": round(quality_score, 4), "labels": [], "explanation": "Content completeness signal"},
        {"signal_type": "recommendation", "score": round(max(0.0, min(1.0, quality_score * (1 - duplicate_score * 0.5))), 4), "labels": [], "explanation": "Engagement eligibility signal"},
    ]


def analyze_content(institution_id: str, target_type: str, target_id: str, text: str) -> list[dict[str, Any]]:
    output = []
    for signal in _intelligence_scores(text, institution_id, target_type, target_id):
        existing = server.db.get("content_intelligence_signals", {"target_type": f"eq.{target_type}", "target_id": f"eq.{target_id}", "signal_type": f"eq.{signal['signal_type']}", "select": "id", "limit": "1"}) or []
        values = {"institution_id": institution_id, "score": signal["score"], "labels": signal["labels"], "explanation": signal["explanation"], "model": "oncampus-intelligence-v1", "status": "open" if (signal["signal_type"] in {"spam", "duplicate", "moderation"} and signal["score"] >= 0.65) else "reviewed", "reviewed_at": None}
        if existing:
            row = server.db.patch("content_intelligence_signals", {"id": f"eq.{existing[0]['id']}"}, values)[0]
        else:
            row = server.db.post("content_intelligence_signals", {"id": new_id("intel"), "target_type": target_type, "target_id": target_id, **values})[0]
        output.append(row)
    return output


@router.post("/institution/moderation/scan")
def scan_moderation(limit: int = Query(50, ge=1, le=200), ctx: dict[str, Any] = Depends(require_operator("moderation.review"))) -> dict[str, Any]:
    iid = ctx["institution_id"]
    posts = server.db.get("posts", {"institution_id": f"eq.{iid}", "deleted_at": "is.null", "select": "id,title,content", "order": "created_at.desc", "limit": str(limit)}) or []
    scanned = 0
    for post in posts:
        analyze_content(iid, "post", post["id"], f"{post.get('title') or ''}\n{post.get('content') or ''}")
        scanned += 1
    return {"scanned": scanned, "engine": "oncampus-intelligence-v1", "externalAiProvider": False}


@router.get("/institution/moderation")
def moderation_queue(status: str = "open", ctx: dict[str, Any] = Depends(require_operator("moderation.review"))) -> dict[str, Any]:
    iid = ctx["institution_id"]
    params: dict[str, Any] = {"institution_id": f"eq.{iid}", "select": "*", "order": "score.desc", "limit": "500"}
    if status != "all":
        params["status"] = f"eq.{status}"
    signals = server.db.get("content_intelligence_signals", params) or []
    try:
        reports = server.db.get("reports", {"status": "eq.pending", "select": "*", "order": "created_at.desc", "limit": "200"}) or []
    except Exception:
        reports = []
    return {"signals": signals, "reports": reports, "engine": "oncampus-intelligence-v1", "externalAiProvider": False}


@router.post("/institution/moderation/{signal_id}/decision")
def moderation_decision(signal_id: str, status: Literal["reviewed", "dismissed", "actioned"] = Query(...), user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(require_operator("moderation.review"))) -> dict[str, Any]:
    rows = server.db.patch("content_intelligence_signals", {"id": f"eq.{signal_id}", "institution_id": f"eq.{ctx['institution_id']}"}, {"status": status, "reviewed_at": now_iso()}) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Moderation signal not found")
    _audit(user, ctx["institution_id"], f"moderation.{status}", rows[0].get("target_type") or "content", rows[0].get("target_id"), {"signalId": signal_id})
    return rows[0]


def _extract_link_preview(url: str) -> dict[str, Any]:
    safe_url = _validate_public_https_url(url)
    digest = hashlib.sha256(safe_url.encode()).hexdigest()
    cached = server.db.get("link_previews", {"url_hash": f"eq.{digest}", "select": "*", "limit": "1"}) or []
    if cached and (not cached[0].get("expires_at") or datetime.fromisoformat(str(cached[0]["expires_at"]).replace("Z", "+00:00")) > datetime.now(timezone.utc)):
        return cached[0]
    response = requests.get(safe_url, headers={"User-Agent": "OnCampus-LinkPreview/1.0"}, timeout=6, allow_redirects=False, stream=True)
    if not response.ok or "text/html" not in response.headers.get("content-type", ""):
        raise HTTPException(status_code=422, detail="Link preview is unavailable")
    raw = response.raw.read(300_000, decode_content=True).decode(response.encoding or "utf-8", errors="ignore")
    def meta(pattern: str) -> Optional[str]:
        match = re.search(pattern, raw, flags=re.I | re.S)
        return unescape(re.sub(r"\s+", " ", match.group(1)).strip())[:1000] if match else None
    title = meta(r'<meta[^>]+(?:property|name)=["\']og:title["\'][^>]+content=["\']([^"\']+)') or meta(r"<title[^>]*>(.*?)</title>")
    description = meta(r'<meta[^>]+(?:property|name)=["\'](?:og:description|description)["\'][^>]+content=["\']([^"\']+)')
    image = meta(r'<meta[^>]+(?:property|name)=["\']og:image["\'][^>]+content=["\']([^"\']+)')
    site = meta(r'<meta[^>]+(?:property|name)=["\']og:site_name["\'][^>]+content=["\']([^"\']+)')
    values = {"url_hash": digest, "url": safe_url, "title": title, "description": description, "image_url": image, "site_name": site, "fetched_at": now_iso(), "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()}
    if cached:
        server.db.patch("link_previews", {"url_hash": f"eq.{digest}"}, values)
    else:
        server.db.post("link_previews", values)
    return values


@router.get("/link-preview")
def link_preview(url: str = Query(..., min_length=10, max_length=2000), user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    return _extract_link_preview(url)


@router.get("/hub")
def campus_hub(user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    membership = student_membership(user.id)
    iid = membership["institution_id"]
    institution = server.db.get("institutions", {"id": f"eq.{iid}", "select": "id,name,city,state,logo_url,cover_url,status", "limit": "1"}) or []
    events = server.db.get("campus_events", {"institution_id": f"eq.{iid}", "end_at": f"gte.{now_iso()}", "status": "in.(published,scheduled)", "select": "*", "order": "start_at.asc", "limit": "8"}) or []
    opportunities_rows = server.db.get("campus_opportunities", {"institution_id": f"eq.{iid}", "status": "eq.published", "select": "*", "order": "created_at.desc", "limit": "8"}) or []
    lost = server.db.get("campus_lost_found_items", {"institution_id": f"eq.{iid}", "status": "eq.open", "select": "*", "order": "created_at.desc", "limit": "6"}) or []
    market = server.db.get("campus_marketplace_items", {"institution_id": f"eq.{iid}", "status": "eq.active", "select": "*", "order": "created_at.desc", "limit": "6"}) or []
    alerts = server.db.get("campus_emergency_alerts", {"institution_id": f"eq.{iid}", "status": "eq.active", "select": "*", "order": "created_at.desc", "limit": "5"}) or []
    digital = server.db.get("campus_digital_ids", {"user_id": f"eq.{user.id}", "select": "public_id,status,valid_from,valid_until,department_id", "limit": "1"}) or []
    return {"institution": institution[0] if institution else None, "membership": membership, "emergency": alerts, "events": events, "opportunities": opportunities_rows, "lostFound": lost, "marketplace": market, "digitalId": digital[0] if digital else None}
