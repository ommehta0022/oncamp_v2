"""
OnCampus Super Admin API Routes
Supabase-backed endpoints for the enterprise admin panel.
"""

from datetime import date, datetime, timedelta
from typing import Any, Optional
import hashlib
import os
import re
import uuid

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query
from pydantic import BaseModel, EmailStr
import jwt
import requests


JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-change-me")

router = APIRouter(prefix="/admin", tags=["Admin"])

db_client = None


def set_db_client(db):
    """Called by server.py to inject the Supabase REST client."""
    global db_client
    db_client = db


class AdminUser(BaseModel):
    id: str
    email: str
    role: str
    name: Optional[str] = None


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminLoginResponse(BaseModel):
    accessToken: str
    refreshToken: str
    user: AdminUser


class RefreshTokenRequest(BaseModel):
    refreshToken: str


class ReasonRequest(BaseModel):
    reason: Optional[str] = None


class MuteUserRequest(BaseModel):
    duration: str = "24h"
    reason: str


class VerifyUserRequest(BaseModel):
    badge: Optional[str] = None


class ResolveReportRequest(BaseModel):
    action: str
    notes: str = ""
    notifyReporter: bool = True


class DismissReportRequest(BaseModel):
    reason: str


class CreateAdminRequest(BaseModel):
    email: EmailStr
    role: str = "admin"
    tempPassword: str


class BlockedKeywordRequest(BaseModel):
    keyword: str
    matchType: str = "exact"


def now_iso() -> str:
    return datetime.utcnow().isoformat()


def get_admin_id(admin: dict[str, Any]) -> Optional[str]:
    return admin.get("user_id") or admin.get("id") or admin.get("sub")


def require_super_admin(admin: dict[str, Any]) -> None:
    if admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")


def get_current_admin(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "admin":
            raise HTTPException(status_code=403, detail="Not an admin token")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def safe_get(table: str, params: Optional[dict[str, Any]] = None, fallback: Any = None) -> Any:
    try:
        rows = db_client.get(table, params or {})
        return rows if rows is not None else ([] if fallback is None else fallback)
    except HTTPException:
        return [] if fallback is None else fallback


def safe_patch(table: str, params: dict[str, Any], payload: dict[str, Any]) -> Any:
    try:
        return db_client.patch(table, params, payload) or []
    except HTTPException as exc:
        raise exc


def safe_post(table: str, payload: dict[str, Any]) -> Any:
    try:
        return db_client.post(table, payload) or []
    except HTTPException:
        return []


def rest_get(table: str, params: Optional[dict[str, Any]] = None, count: bool = False) -> tuple[list[Any], int]:
    if not getattr(db_client, "enabled", False):
        raise HTTPException(
            status_code=503,
            detail="Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        )

    headers = dict(db_client.headers)
    if count:
        headers["Prefer"] = "count=exact"
        headers["Range-Unit"] = "items"
        headers["Range"] = "0-0"

    response = requests.get(
        f"{db_client.base}/{table}",
        headers=headers,
        params=params or {},
        timeout=20,
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    data = response.json() if response.text else []
    total = len(data)
    content_range = response.headers.get("content-range") or response.headers.get("Content-Range")
    if content_range and "/" in content_range:
        total_text = content_range.rsplit("/", 1)[-1]
        if total_text.isdigit():
            total = int(total_text)
    return data, total


def count_rows(table: str, filters: Optional[dict[str, Any]] = None) -> int:
    params = {"select": "*", **(filters or {})}
    try:
        _, total = rest_get(table, params, count=True)
        return total
    except HTTPException:
        return 0


def table_rows(
    table: str,
    params: Optional[dict[str, Any]] = None,
    page: int = 1,
    limit: int = 50,
) -> dict[str, Any]:
    query = {
        "select": "*",
        "limit": str(limit),
        "offset": str((page - 1) * limit),
        **(params or {}),
    }
    data, total = rest_get(table, query, count=True)
    return {"data": data, "meta": {"page": page, "limit": limit, "total": total}}


def log_admin_action(
    admin: dict[str, Any],
    action: str,
    details: Any,
    target_type: str = "system",
    target_id: Optional[str] = None,
) -> None:
    admin_id = get_admin_id(admin)
    email = admin.get("email")
    if safe_post(
        "audit_logs",
        {
            "admin_id": admin_id,
            "admin_email": email,
            "action": action,
            "target_type": target_type,
            "target_id": target_id,
            "details": details if isinstance(details, str) else str(details),
        },
    ):
        return

    safe_post(
        "action_logs",
        {
            "id": str(uuid.uuid4()),
            "admin_id": admin_id or "unknown",
            "action_type": action,
            "target_type": target_type,
            "target_id": target_id or "system",
            "details": details if isinstance(details, dict) else {"message": str(details)},
        },
    )


def token_pair(admin: dict[str, Any]) -> tuple[str, str]:
    access_token = jwt.encode(
        {
            "user_id": admin["id"],
            "email": admin["email"],
            "role": admin["role"],
            "type": "admin",
            "exp": datetime.utcnow() + timedelta(days=7),
        },
        JWT_SECRET,
        algorithm="HS256",
    )
    refresh_token = jwt.encode(
        {
            "user_id": admin["id"],
            "type": "admin_refresh",
            "exp": datetime.utcnow() + timedelta(days=30),
        },
        JWT_SECRET,
        algorithm="HS256",
    )
    return access_token, refresh_token


def normalize_group(row: dict[str, Any]) -> dict[str, Any]:
    official = bool(row.get("is_official", row.get("official", False)))
    deleted = bool(row.get("deleted_at")) or row.get("status") == "deleted"
    return {
        **row,
        "is_official": official,
        "official": official,
        "status": row.get("status") or ("deleted" if deleted else "active"),
        "member_count": row.get("member_count", row.get("membersCount", 0)) or 0,
    }


def normalize_report(row: dict[str, Any]) -> dict[str, Any]:
    return {
        **row,
        "reported_type": row.get("reported_type") or row.get("target_type"),
        "reported_id": row.get("reported_id") or row.get("target_id"),
    }


def normalize_action_log(row: dict[str, Any]) -> dict[str, Any]:
    return {
        **row,
        "action": row.get("action") or row.get("action_type"),
        "admin_email": row.get("admin_email"),
        "details": row.get("details") if isinstance(row.get("details"), str) else str(row.get("details", "")),
    }


def previous_period_growth(table: str, days: int = 30) -> float:
    current_start = (datetime.utcnow() - timedelta(days=days)).isoformat()
    previous_start = (datetime.utcnow() - timedelta(days=days * 2)).isoformat()
    current = count_rows(table, {"created_at": f"gte.{current_start}"})
    previous = count_rows(table, {"and": f"(created_at.gte.{previous_start},created_at.lt.{current_start})"})
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return round(((current - previous) / previous) * 100, 1)


def daily_count(table: str, day: date) -> int:
    start = datetime.combine(day, datetime.min.time()).isoformat()
    end = datetime.combine(day + timedelta(days=1), datetime.min.time()).isoformat()
    return count_rows(table, {"created_at": f"gte.{start}", "and": f"(created_at.lt.{end})"})


# ============================================================================
# AUTHENTICATION
# ============================================================================


@router.post("/auth/login", response_model=AdminLoginResponse)
async def admin_login(request: AdminLoginRequest):
    password_hash = hashlib.sha256(request.password.encode()).hexdigest()

    admins = safe_get(
        "admin_users",
        {
            "email": f"eq.{request.email}",
            "select": "*",
            "limit": "1",
        },
    )
    admin = admins[0] if admins else None
    if not admin or admin.get("password_hash") != password_hash or admin.get("is_active") is False:
        safe_post(
            "failed_login_attempts",
            {
                "email": request.email,
                "ip_address": "unknown",
                "reason": "invalid_credentials",
                "last_attempt": now_iso(),
            },
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token, refresh_token = token_pair(admin)
    log_admin_action(
        {"user_id": admin["id"], "email": admin["email"], "role": admin["role"]},
        "AUTH_LOGIN",
        "Admin logged in",
    )

    return AdminLoginResponse(
        accessToken=access_token,
        refreshToken=refresh_token,
        user=AdminUser(
            id=admin["id"],
            email=admin["email"],
            role=admin["role"],
            name=admin.get("name"),
        ),
    )


@router.post("/auth/refresh")
async def refresh_admin_token(payload: RefreshTokenRequest):
    try:
        decoded = jwt.decode(payload.refreshToken, JWT_SECRET, algorithms=["HS256"])
        if decoded.get("type") != "admin_refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    admins = safe_get("admin_users", {"id": f"eq.{decoded['user_id']}", "select": "*", "limit": "1"})
    if not admins or admins[0].get("is_active") is False:
        raise HTTPException(status_code=401, detail="Admin not found")

    access_token, refresh_token = token_pair(admins[0])
    return {"accessToken": access_token, "refreshToken": refresh_token}


@router.post("/auth/logout")
async def admin_logout(admin: dict = Depends(get_current_admin)):
    log_admin_action(admin, "AUTH_LOGOUT", "Admin logged out")
    return {"success": True}


@router.get("/auth/me")
async def get_current_admin_user(admin: dict = Depends(get_current_admin)):
    admins = safe_get("admin_users", {"id": f"eq.{get_admin_id(admin)}", "select": "*", "limit": "1"})
    if admins:
        admin_data = admins[0]
        return AdminUser(
            id=admin_data["id"],
            email=admin_data["email"],
            role=admin_data["role"],
            name=admin_data.get("name"),
        )
    raise HTTPException(status_code=404, detail="Admin not found")


# ============================================================================
# DASHBOARD AND ANALYTICS
# ============================================================================


@router.get("/dashboard")
async def get_dashboard(admin: dict = Depends(get_current_admin)):
    today = datetime.utcnow().date()
    day_start = datetime.combine(today, datetime.min.time()).isoformat()
    active_start = (datetime.utcnow() - timedelta(days=1)).isoformat()
    week_start = (datetime.utcnow() - timedelta(days=7)).isoformat()

    total_users = count_rows("users")
    active_users = count_rows("users", {"last_seen_at": f"gte.{active_start}"})
    total_groups = count_rows("groups", {"deleted_at": "is.null"})
    active_groups = count_rows("messages", {"created_at": f"gte.{week_start}"})
    total_messages = count_rows("messages", {"deleted_at": "is.null"})
    messages_24h = count_rows("messages", {"created_at": f"gte.{active_start}", "deleted_at": "is.null"})
    pending_reports = count_rows("content_reports", {"status": "eq.pending"}) or count_rows("reports", {"status": "eq.pending"})
    unresolved_errors = count_rows("error_logs", {"status": "neq.resolved"})

    return {
        "totalUsers": total_users,
        "activeUsers": active_users,
        "totalGroups": total_groups,
        "activeGroups": active_groups,
        "totalMessages": total_messages,
        "todayMessages": count_rows("messages", {"created_at": f"gte.{day_start}", "deleted_at": "is.null"}),
        "messages24h": messages_24h,
        "newUsersToday": count_rows("users", {"created_at": f"gte.{day_start}"}),
        "newGroupsToday": count_rows("groups", {"created_at": f"gte.{day_start}"}),
        "newUsersThisWeek": count_rows("users", {"created_at": f"gte.{week_start}"}),
        "pendingReports": pending_reports,
        "unresolvedErrors": unresolved_errors,
        "growth": {
            "users": previous_period_growth("users", 30),
            "groups": previous_period_growth("groups", 30),
            "messages": previous_period_growth("messages", 30),
        },
    }


@router.get("/analytics/overview")
async def get_analytics_overview(admin: dict = Depends(get_current_admin)):
    active_start = (datetime.utcnow() - timedelta(days=1)).isoformat()
    return {
        "users": {
            "total": count_rows("users"),
            "active": count_rows("users", {"last_seen_at": f"gte.{active_start}"}),
            "growth": previous_period_growth("users", 30),
        },
        "groups": {
            "total": count_rows("groups", {"deleted_at": "is.null"}),
            "active": count_rows("messages", {"created_at": f"gte.{(datetime.utcnow() - timedelta(days=7)).isoformat()}"}),
            "growth": previous_period_growth("groups", 30),
        },
        "engagement": {
            "messages": count_rows("messages", {"deleted_at": "is.null"}),
            "posts": count_rows("posts", {"status": "eq.published"}),
            "comments": count_rows("post_comments", {"deleted_at": "is.null"}),
            "messagesLastHour": count_rows("messages", {"created_at": f"gte.{(datetime.utcnow() - timedelta(hours=1)).isoformat()}"}),
            "newGroupsLastHour": count_rows("groups", {"created_at": f"gte.{(datetime.utcnow() - timedelta(hours=1)).isoformat()}"}),
            "newUsersLastHour": count_rows("users", {"created_at": f"gte.{(datetime.utcnow() - timedelta(hours=1)).isoformat()}"}),
        },
    }


@router.get("/analytics/growth")
async def get_growth_metrics(admin: dict = Depends(get_current_admin), days: int = Query(30, ge=1, le=90)):
    today = datetime.utcnow().date()
    rows = []
    for i in range(days - 1, -1, -1):
        current_day = today - timedelta(days=i)
        rows.append(
            {
                "date": current_day.isoformat(),
                "users": daily_count("users", current_day),
                "groups": daily_count("groups", current_day),
                "messages": daily_count("messages", current_day),
            }
        )
    return {"data": rows}


@router.get("/analytics/cities")
async def get_city_metrics(admin: dict = Depends(get_current_admin)):
    users = safe_get("users", {"select": "city", "limit": "10000"})
    counts: dict[str, int] = {}
    for user in users:
        city = user.get("city") or "Unknown"
        counts[city] = counts.get(city, 0) + 1
    return [{"city": city, "users": total} for city, total in sorted(counts.items(), key=lambda item: item[1], reverse=True)[:20]]


@router.get("/analytics/institutions")
async def get_institution_metrics(admin: dict = Depends(get_current_admin)):
    institutions = safe_get("institutions", {"select": "id,name", "limit": "10000"})
    memberships = safe_get("user_institutions", {"select": "institution_id", "limit": "10000"})
    counts: dict[str, int] = {}
    for row in memberships:
        institution_id = row.get("institution_id")
        if institution_id:
            counts[institution_id] = counts.get(institution_id, 0) + 1
    names = {row.get("id"): row.get("name") for row in institutions}
    return [
        {"name": names.get(institution_id) or institution_id, "users": total}
        for institution_id, total in sorted(counts.items(), key=lambda item: item[1], reverse=True)[:12]
    ]


# ============================================================================
# USER MANAGEMENT
# ============================================================================


@router.get("/users")
async def get_users(
    admin: dict = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    city: Optional[str] = None,
    institution: Optional[str] = None,
    search: Optional[str] = None,
    verified: Optional[str] = None,
):
    params: dict[str, Any] = {"order": "created_at.desc"}
    if status:
        params["status"] = f"eq.{status}"
    if city:
        params["city"] = f"ilike.*{city}*"
    if search:
        params["or"] = f"(name.ilike.*{search}*,phone_hash.ilike.*{search}*)"
    if verified in {"true", "false"}:
        params["verified"] = f"eq.{verified}"

    response = table_rows("users", params, page, limit)
    if institution:
        response["data"] = [
            row for row in response["data"]
            if institution.lower() in str(row.get("institution", "")).lower()
        ]
    return response


@router.get("/users/{user_id}")
async def get_user(user_id: str, admin: dict = Depends(get_current_admin)):
    users = safe_get("users", {"id": f"eq.{user_id}", "select": "*", "limit": "1"})
    if not users:
        raise HTTPException(status_code=404, detail="User not found")

    user = users[0]
    user["groupsCount"] = count_rows("group_members", {"user_id": f"eq.{user_id}", "status": "eq.active"})
    user["messagesCount"] = count_rows("messages", {"sender_id": f"eq.{user_id}", "deleted_at": "is.null"})
    user["postsCount"] = count_rows("posts", {"author_id": f"eq.{user_id}"})
    return user


@router.patch("/users/{user_id}")
async def update_user(user_id: str, data: dict[str, Any] = Body(...), admin: dict = Depends(get_current_admin)):
    blocked = {"id", "created_at", "updated_at", "phone_hash"}
    payload = {key: value for key, value in data.items() if key not in blocked}
    payload["updated_at"] = now_iso()
    result = safe_patch("users", {"id": f"eq.{user_id}"}, payload)
    log_admin_action(admin, "USER_UPDATE", {"fields": list(payload.keys())}, "user", user_id)
    return result[0] if result else {"success": True}


@router.post("/users/{user_id}/mute")
async def mute_user(user_id: str, payload: MuteUserRequest, admin: dict = Depends(get_current_admin)):
    duration_map = {
        "1h": timedelta(hours=1),
        "24h": timedelta(days=1),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
        "permanent": timedelta(days=36500),
    }
    mute_until = datetime.utcnow() + duration_map.get(payload.duration, timedelta(days=1))
    result = safe_patch("users", {"id": f"eq.{user_id}"}, {"status": "muted", "updated_at": now_iso()})
    log_admin_action(admin, "USER_MUTE", {"duration": payload.duration, "reason": payload.reason, "until": mute_until.isoformat()}, "user", user_id)
    return result[0] if result else {"success": True}


@router.post("/users/{user_id}/ban")
async def ban_user(user_id: str, payload: ReasonRequest = Body(default=ReasonRequest()), admin: dict = Depends(get_current_admin)):
    result = safe_patch("users", {"id": f"eq.{user_id}"}, {"status": "banned", "updated_at": now_iso()})
    safe_patch("user_devices", {"user_id": f"eq.{user_id}"}, {"revoked_at": now_iso()})
    log_admin_action(admin, "USER_BAN", payload.reason or "User banned", "user", user_id)
    return result[0] if result else {"success": True}


@router.post("/users/{user_id}/unban")
async def unban_user(user_id: str, admin: dict = Depends(get_current_admin)):
    result = safe_patch("users", {"id": f"eq.{user_id}"}, {"status": "active", "updated_at": now_iso()})
    log_admin_action(admin, "USER_UNBAN", "User unbanned", "user", user_id)
    return result[0] if result else {"success": True}


@router.post("/users/{user_id}/verify")
async def verify_user(user_id: str, payload: VerifyUserRequest = Body(default=VerifyUserRequest()), admin: dict = Depends(get_current_admin)):
    result = safe_patch("users", {"id": f"eq.{user_id}"}, {"verified": True, "updated_at": now_iso()})
    log_admin_action(admin, "USER_VERIFY", {"badge": payload.badge}, "user", user_id)
    return result[0] if result else {"success": True}


# ============================================================================
# GROUP MANAGEMENT
# ============================================================================


@router.get("/groups")
async def get_groups(
    admin: dict = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    visibility: Optional[str] = None,
    category: Optional[str] = None,
    city: Optional[str] = None,
    search: Optional[str] = None,
):
    params: dict[str, Any] = {"order": "created_at.desc"}
    if visibility:
        params["visibility"] = f"eq.{visibility}"
    if category:
        params["category"] = f"eq.{category}"
    if city:
        params["city"] = f"ilike.*{city}*"
    if search:
        params["name"] = f"ilike.*{search}*"

    response = table_rows("groups", params, page, limit)
    response["data"] = [normalize_group(row) for row in response["data"]]
    return response


@router.get("/groups/{group_id}")
async def get_group(group_id: str, admin: dict = Depends(get_current_admin)):
    groups = safe_get("groups", {"id": f"eq.{group_id}", "select": "*", "limit": "1"})
    if not groups:
        raise HTTPException(status_code=404, detail="Group not found")
    group = normalize_group(groups[0])
    group["membersCount"] = count_rows("group_members", {"group_id": f"eq.{group_id}", "status": "eq.active"})
    group["messagesCount"] = count_rows("messages", {"group_id": f"eq.{group_id}", "deleted_at": "is.null"})
    return group


@router.patch("/groups/{group_id}")
async def update_group(group_id: str, data: dict[str, Any] = Body(...), admin: dict = Depends(get_current_admin)):
    result = safe_patch("groups", {"id": f"eq.{group_id}"}, {**data, "updated_at": now_iso()})
    log_admin_action(admin, "GROUP_UPDATE", {"fields": list(data.keys())}, "group", group_id)
    return normalize_group(result[0]) if result else {"success": True}


@router.post("/groups/{group_id}/verify")
async def verify_group(group_id: str, admin: dict = Depends(get_current_admin)):
    try:
        result = safe_patch("groups", {"id": f"eq.{group_id}"}, {"official": True, "updated_at": now_iso()})
    except HTTPException:
        result = safe_patch("groups", {"id": f"eq.{group_id}"}, {"is_official": True})
    log_admin_action(admin, "GROUP_VERIFY", "Group verified as official", "group", group_id)
    return normalize_group(result[0]) if result else {"success": True}


@router.get("/groups/{group_id}/members")
async def get_group_members(
    group_id: str,
    admin: dict = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
):
    response = table_rows(
        "group_members",
        {"group_id": f"eq.{group_id}", "select": "*,users(name,email,phone_hash,avatar_url)"},
        page,
        limit,
    )
    return response


@router.delete("/groups/{group_id}/members/{user_id}")
async def remove_group_member(group_id: str, user_id: str, admin: dict = Depends(get_current_admin)):
    db_client.delete("group_members", {"group_id": f"eq.{group_id}", "user_id": f"eq.{user_id}"})
    log_admin_action(admin, "MEMBER_REMOVE", {"user_id": user_id}, "group", group_id)
    return {"success": True}


@router.delete("/groups/{group_id}")
async def delete_group(group_id: str, payload: ReasonRequest = Body(default=ReasonRequest()), admin: dict = Depends(get_current_admin)):
    try:
        safe_patch("groups", {"id": f"eq.{group_id}"}, {"deleted_at": now_iso(), "updated_at": now_iso()})
    except HTTPException:
        db_client.delete("groups", {"id": f"eq.{group_id}"})
    log_admin_action(admin, "GROUP_DELETE", payload.reason or "Group deleted", "group", group_id)
    return {"success": True}


# ============================================================================
# MODERATION, SECURITY, ADMINS, AUDIT
# ============================================================================


@router.get("/reports")
async def get_reports(
    admin: dict = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    type: Optional[str] = None,
):
    params: dict[str, Any] = {"order": "created_at.desc"}
    if status:
        params["status"] = f"eq.{status}"
    if type:
        params["reported_type"] = f"eq.{type}"
    try:
        response = table_rows("content_reports", params, page, limit)
    except HTTPException:
        if type:
            params.pop("reported_type", None)
            params["target_type"] = f"eq.{type}"
        response = table_rows("reports", params, page, limit)
    response["data"] = [normalize_report(row) for row in response["data"]]
    return response


@router.post("/reports/{report_id}/resolve")
async def resolve_report(report_id: str, payload: ResolveReportRequest, admin: dict = Depends(get_current_admin)):
    data = {"status": "resolved", "resolved_by": get_admin_id(admin), "resolved_at": now_iso()}
    try:
        result = safe_patch("content_reports", {"id": f"eq.{report_id}"}, data)
    except HTTPException:
        result = safe_patch("reports", {"id": f"eq.{report_id}"}, {**data, "resolution": payload.notes})
    log_admin_action(admin, "REPORT_RESOLVE", {"action": payload.action, "notes": payload.notes}, "report", report_id)
    return result[0] if result else {"success": True}


@router.post("/reports/{report_id}/dismiss")
async def dismiss_report(report_id: str, payload: DismissReportRequest, admin: dict = Depends(get_current_admin)):
    data = {"status": "dismissed", "resolved_by": get_admin_id(admin), "resolved_at": now_iso()}
    try:
        result = safe_patch("content_reports", {"id": f"eq.{report_id}"}, data)
    except HTTPException:
        result = safe_patch("reports", {"id": f"eq.{report_id}"}, {**data, "resolution": payload.reason})
    log_admin_action(admin, "REPORT_DISMISS", payload.reason, "report", report_id)
    return result[0] if result else {"success": True}


@router.get("/action-logs")
@router.get("/audit-logs")
async def get_audit_logs(
    admin: dict = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    admin_filter: Optional[str] = Query(None, alias="admin"),
    action: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
):
    params: dict[str, Any] = {"order": "created_at.desc"}
    if admin_filter:
        params["admin_id"] = f"eq.{admin_filter}"
    if action:
        params["action"] = f"ilike.*{action}*"
    if startDate:
        params["created_at"] = f"gte.{startDate}"
    if endDate:
        params["and"] = f"(created_at.lte.{endDate})"
    try:
        response = table_rows("audit_logs", params, page, limit)
    except HTTPException:
        if action:
            params.pop("action", None)
            params["action_type"] = f"ilike.*{action}*"
        response = table_rows("action_logs", params, page, limit)
    response["data"] = [normalize_action_log(row) for row in response["data"]]
    return response


@router.get("/security/alerts")
async def get_security_alerts(admin: dict = Depends(get_current_admin)):
    alerts = []
    critical_errors = count_rows("error_logs", {"level": "eq.critical", "status": "neq.resolved"})
    pending_reports = count_rows("content_reports", {"status": "eq.pending"}) or count_rows("reports", {"status": "eq.pending"})
    failed_logins = count_rows("failed_login_attempts", {"created_at": f"gte.{(datetime.utcnow() - timedelta(days=1)).isoformat()}"})
    if critical_errors:
        alerts.append({"id": "critical-errors", "title": "Critical errors unresolved", "description": f"{critical_errors} critical errors need review.", "severity": "critical", "status": "active", "created_at": now_iso()})
    if failed_logins >= 5:
        alerts.append({"id": "failed-logins", "title": "Failed login spike", "description": f"{failed_logins} failed admin login attempts in 24h.", "severity": "high", "status": "active", "created_at": now_iso()})
    if pending_reports:
        alerts.append({"id": "pending-reports", "title": "Moderation queue pending", "description": f"{pending_reports} reports are awaiting review.", "severity": "medium", "status": "active", "created_at": now_iso()})
    return alerts


@router.get("/security/failed-logins")
async def get_failed_logins(admin: dict = Depends(get_current_admin)):
    return safe_get("failed_login_attempts", {"select": "*", "order": "created_at.desc", "limit": "100"})


@router.get("/security/blocked-keywords")
async def get_blocked_keywords(admin: dict = Depends(get_current_admin)):
    return safe_get("blocked_keywords", {"select": "*", "order": "created_at.desc"})


@router.post("/security/blocked-keywords")
async def add_blocked_keyword(payload: BlockedKeywordRequest, admin: dict = Depends(get_current_admin)):
    result = safe_post(
        "blocked_keywords",
        {
            "keyword": payload.keyword,
            "match_type": payload.matchType,
            "added_by": get_admin_id(admin),
        },
    )
    log_admin_action(admin, "KEYWORD_BLOCK", payload.keyword, "security")
    return result[0] if result else {"success": True}


@router.delete("/security/blocked-keywords/{keyword_id}")
async def delete_blocked_keyword(keyword_id: str, admin: dict = Depends(get_current_admin)):
    db_client.delete("blocked_keywords", {"id": f"eq.{keyword_id}"})
    log_admin_action(admin, "KEYWORD_UNBLOCK", keyword_id, "security")
    return {"success": True}


@router.get("/security/rate-limits")
async def get_rate_limits(admin: dict = Depends(get_current_admin)):
    rows = safe_get("rate_limit_config", {"select": "*", "order": "endpoint_pattern.asc"})
    if rows:
        return rows
    config = safe_get("security_config", {"select": "*", "limit": "1"})
    return config[0] if config else {}


@router.patch("/security/rate-limits")
async def update_rate_limits(data: dict[str, Any] = Body(...), admin: dict = Depends(get_current_admin)):
    require_super_admin(admin)
    existing = safe_get("security_config", {"id": "eq.global", "select": "id", "limit": "1"})
    allowed = {
        "message_rate_limit_per_minute",
        "join_requests_per_hour",
        "otp_attempts_per_hour",
        "spam_keywords",
        "blocked_ips",
        "suspicious_activity_alerts_enabled",
    }
    payload = {key: value for key, value in data.items() if key in allowed}
    payload["updated_at"] = now_iso()
    if existing:
        result = safe_patch("security_config", {"id": "eq.global"}, payload)
    else:
        result = safe_post("security_config", {"id": "global", **payload})
    log_admin_action(admin, "RATE_LIMIT_UPDATE", data, "security")
    return result[0] if result else {"success": True}


@router.get("/security/admins")
async def get_admins(admin: dict = Depends(get_current_admin)):
    return safe_get("admin_users", {"select": "*", "order": "created_at.desc"})


@router.post("/security/admins")
async def create_admin(payload: CreateAdminRequest, admin: dict = Depends(get_current_admin)):
    require_super_admin(admin)
    admin_payload = {
        "id": str(uuid.uuid4()),
        "email": payload.email,
        "role": payload.role,
        "name": payload.email.split("@")[0],
        "password_hash": hashlib.sha256(payload.tempPassword.encode()).hexdigest(),
        "created_at": now_iso(),
    }
    result = safe_post("admin_users", admin_payload)
    if not result:
        result = safe_post(
            "admin_users",
            {key: value for key, value in admin_payload.items() if key != "name"},
        )
    log_admin_action(admin, "ADMIN_CREATE", payload.email, "admin", result[0]["id"] if result else None)
    return result[0] if result else {"success": True}


@router.delete("/security/admins/{admin_id}")
async def delete_admin(admin_id: str, admin: dict = Depends(get_current_admin)):
    require_super_admin(admin)
    if admin_id == get_admin_id(admin):
        raise HTTPException(status_code=400, detail="You cannot delete your own admin account")
    try:
        result = safe_patch("admin_users", {"id": f"eq.{admin_id}"}, {"is_active": False})
    except HTTPException:
        result = db_client.delete("admin_users", {"id": f"eq.{admin_id}"})
    log_admin_action(admin, "ADMIN_DELETE", "Admin access removed", "admin", admin_id)
    return result[0] if isinstance(result, list) and result else {"success": True}


# ============================================================================
# SETTINGS, DATABASE, SYSTEM, ERRORS
# ============================================================================


@router.get("/settings")
async def get_settings(admin: dict = Depends(get_current_admin)):
    rows = safe_get("system_settings", {"select": "*"})
    settings: dict[str, Any] = {}
    key_map = {
        "platform_name": "appName",
        "support_email": "supportEmail",
        "maintenance_mode": "maintenanceMode",
        "registration_enabled": "registrationEnabled",
        "group_creation_enabled": "groupCreationEnabled",
        "max_group_members": "maxGroupMembers",
        "max_message_length": "maxMessageLength",
        "require_email_verification": "requireEmailVerification",
        "require_phone_verification": "requirePhoneVerification",
        "allow_anonymous_reporting": "allowAnonymousReporting",
        "push_notifications_enabled": "pushNotificationsEnabled",
        "email_notifications_enabled": "emailNotificationsEnabled",
    }
    for row in rows:
        settings[key_map.get(row.get("key"), row.get("key"))] = row.get("value")
    return settings


@router.patch("/settings")
async def update_settings(data: dict[str, Any] = Body(...), admin: dict = Depends(get_current_admin)):
    require_super_admin(admin)
    reverse_map = {
        "appName": "platform_name",
        "supportEmail": "support_email",
        "maintenanceMode": "maintenance_mode",
        "registrationEnabled": "registration_enabled",
        "groupCreationEnabled": "group_creation_enabled",
        "maxGroupMembers": "max_group_members",
        "maxMessageLength": "max_message_length",
        "requireEmailVerification": "require_email_verification",
        "requirePhoneVerification": "require_phone_verification",
        "allowAnonymousReporting": "allow_anonymous_reporting",
        "pushNotificationsEnabled": "push_notifications_enabled",
        "emailNotificationsEnabled": "email_notifications_enabled",
    }
    for key, value in data.items():
        db_key = reverse_map.get(key, key)
        existing = safe_get("system_settings", {"key": f"eq.{db_key}", "select": "id", "limit": "1"})
        payload = {"key": db_key, "value": value, "category": "admin", "updated_by": get_admin_id(admin), "updated_at": now_iso()}
        if existing:
            safe_patch("system_settings", {"key": f"eq.{db_key}"}, payload)
        else:
            safe_post("system_settings", payload)
    log_admin_action(admin, "SETTINGS_UPDATE", {"fields": list(data.keys())})
    return {"success": True}


KNOWN_TABLES = [
    "users", "user_devices", "institutions", "user_institutions", "groups", "group_members",
    "join_requests", "messages", "reports", "posts", "post_comments", "notifications",
    "admin_users", "audit_logs", "action_logs", "error_logs", "system_settings",
    "blocked_keywords", "blocked_ips", "content_reports", "rate_limit_config",
    "failed_login_attempts", "security_config",
]


@router.get("/database/tables")
async def get_database_tables(admin: dict = Depends(get_current_admin)):
    require_super_admin(admin)
    tables = []
    for table in KNOWN_TABLES:
        try:
            _, total = rest_get(table, {"select": "*", "limit": "1"}, count=True)
            tables.append({"table_name": table, "column_count": 0, "row_count": total})
        except HTTPException:
            continue
    return tables


@router.get("/database/tables/{table_name}")
async def get_table_data(
    table_name: str,
    admin: dict = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    orderBy: Optional[str] = None,
):
    require_super_admin(admin)
    if table_name not in KNOWN_TABLES:
        raise HTTPException(status_code=400, detail="Table is not exposed through the admin browser")
    params = {"order": orderBy or "created_at.desc"}
    try:
        return table_rows(table_name, params, page, limit)
    except HTTPException:
        return table_rows(table_name, {}, page, limit)


@router.post("/database/query")
async def execute_database_query(payload: dict[str, str] = Body(...), admin: dict = Depends(get_current_admin)):
    require_super_admin(admin)
    query = (payload.get("query") or "").strip()

    count_match = re.fullmatch(r"SELECT\s+COUNT\(\*\)\s+as\s+total\s+FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*;?", query, re.I)
    if count_match:
        table = count_match.group(1)
        if table not in KNOWN_TABLES:
            raise HTTPException(status_code=400, detail="Table is not exposed through the admin browser")
        return [{"total": count_rows(table)}]

    select_match = re.fullmatch(r"SELECT\s+\*\s+FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(ORDER\s+BY\s+created_at\s+DESC)?\s*LIMIT\s+(\d+)\s*;?", query, re.I)
    if select_match:
        table = select_match.group(1)
        limit = min(int(select_match.group(3)), 100)
        if table not in KNOWN_TABLES:
            raise HTTPException(status_code=400, detail="Table is not exposed through the admin browser")
        return table_rows(table, {"order": "created_at.desc"}, 1, limit)["data"]

    status_match = re.fullmatch(r"SELECT\s+status,\s*COUNT\(\*\)\s+as\s+count\s+FROM\s+users\s+GROUP\s+BY\s+status\s*;?", query, re.I)
    if status_match:
        users = safe_get("users", {"select": "status", "limit": "10000"})
        counts: dict[str, int] = {}
        for user in users:
            status = user.get("status") or "unknown"
            counts[status] = counts.get(status, 0) + 1
        return [{"status": status, "count": total} for status, total in counts.items()]

    raise HTTPException(
        status_code=400,
        detail="Raw SQL execution is not available through Supabase REST. Use Browse Tables or supported SELECT/COUNT templates.",
    )


@router.get("/system/status")
async def get_system_status(admin: dict = Depends(get_current_admin)):
    database_connected = True
    try:
        count_rows("users")
    except HTTPException:
        database_connected = False
    return {
        "status": "online",
        "version": "1.0.0",
        "database": "connected" if database_connected else "unavailable",
        "timestamp": now_iso(),
    }


@router.post("/system/cache/clear")
async def clear_cache(admin: dict = Depends(get_current_admin)):
    require_super_admin(admin)
    log_admin_action(admin, "CACHE_CLEAR", "Admin requested cache clear")
    return {"success": True}


@router.get("/errors")
async def get_errors(
    admin: dict = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    level: Optional[str] = None,
    userId: Optional[str] = None,
):
    params: dict[str, Any] = {"order": "created_at.desc"}
    if level:
        params["level"] = f"eq.{level}"
    if userId:
        params["user_id"] = f"eq.{userId}"
    return table_rows("error_logs", params, page, limit)


@router.get("/errors/{error_id}")
async def get_error(error_id: str, admin: dict = Depends(get_current_admin)):
    rows = safe_get("error_logs", {"id": f"eq.{error_id}", "select": "*", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Error not found")
    return rows[0]


@router.post("/errors/{error_id}/resolve")
async def resolve_error(error_id: str, admin: dict = Depends(get_current_admin)):
    result = safe_patch(
        "error_logs",
        {"id": f"eq.{error_id}"},
        {"status": "resolved", "resolved_by": get_admin_id(admin), "resolved_at": now_iso()},
    )
    log_admin_action(admin, "ERROR_RESOLVE", "Error marked resolved", "error", error_id)
    return result[0] if result else {"success": True}
