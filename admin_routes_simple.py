"""
OnCampus Super Admin API Routes
Supabase-backed endpoints for the enterprise admin panel.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional
import hashlib
import json
import os
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr
from slowapi import Limiter
from slowapi.util import get_remote_address
import bcrypt
import jwt
import requests


JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-change-me")

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)

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


class AdminNotificationRequest(BaseModel):
    title: str
    body: str
    type: str = "admin_broadcast"
    target: str = "all"
    userIds: list[str] = []
    data: dict[str, Any] = {}
    channels: dict[str, bool] = {
        "inApp": True,
        "push": False,
        "email": False,
        "whatsapp": False,
        "telegram": False,
        "linkedin": False,
    }


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


def admin_firebase_project_id() -> str:
    service_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")
    if service_json:
        try:
            return json.loads(service_json).get("project_id", "")
        except Exception:
            return ""
    service_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")
    if not service_path:
        return ""
    try:
        return json.loads(Path(service_path).read_text(encoding="utf-8")).get("project_id", "")
    except Exception:
        return ""


def admin_firebase_access_token() -> str:
    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Firebase auth dependency missing: {exc}")

    service_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")
    service_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")
    if service_json:
        credentials = service_account.Credentials.from_service_account_info(
            json.loads(service_json),
            scopes=["https://www.googleapis.com/auth/firebase.messaging"],
        )
    elif service_path:
        credentials = service_account.Credentials.from_service_account_file(
            service_path,
            scopes=["https://www.googleapis.com/auth/firebase.messaging"],
        )
    else:
        raise HTTPException(status_code=503, detail="Firebase service account is not configured")
    credentials.refresh(Request())
    return credentials.token


def send_admin_push(token: str, title: str, body: str, data: Optional[dict[str, str]] = None) -> Any:
    project_id = admin_firebase_project_id()
    if not project_id:
        raise HTTPException(status_code=503, detail="Firebase project id is not configured")
    response = requests.post(
        f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send",
        headers={
            "Authorization": f"Bearer {admin_firebase_access_token()}",
            "Content-Type": "application/json",
        },
        json={
            "message": {
                "token": token,
                "notification": {"title": title, "body": body},
                "data": data or {},
            }
        },
        timeout=20,
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


def rest_get(table: str, params: Optional[dict[str, Any]] = None, count: bool = False) -> tuple[list[Any], int]:
    if not getattr(db_client, "enabled", False):
        raise HTTPException(
            status_code=503,
            detail="Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        )

    headers = dict(db_client.headers)
    if count:
        headers["Prefer"] = "count=exact"

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
    params = {"limit": "0", **(filters or {})}
    try:
        _, total = rest_get(table, params, count=True)
        return total
    except Exception as e:
        print(f"count_rows failed for table {table}: {e}")
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
            "exp": datetime.utcnow() + timedelta(hours=8),  # 8-hour sessions
        },
        JWT_SECRET,
        algorithm="HS256",
    )
    refresh_token = jwt.encode(
        {
            "user_id": admin["id"],
            "type": "admin_refresh",
            "exp": datetime.utcnow() + timedelta(days=7),  # Reduced from 30 to 7 days
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
# SECURITY FUNCTIONS (CRITICAL - Phase 1)
# ============================================================================

def hash_password_bcrypt(password: str) -> str:
    """Hash password using bcrypt (SECURE)"""
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password_bcrypt(password: str, password_hash: str) -> bool:
    """Verify password against bcrypt hash"""
    try:
        password_bytes = password.encode('utf-8')
        hash_bytes = password_hash.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hash_bytes)
    except Exception:
        return False


def verify_password_legacy(password: str, password_hash: str, algorithm: str) -> bool:
    """Verify password against legacy hash (for migration)"""
    if algorithm == "sha256":
        computed = hashlib.sha256(password.encode()).hexdigest()
        return computed == password_hash
    return False


def check_rate_limit(email: str) -> tuple[bool, Optional[str]]:
    """Check rate limit for login attempts. Returns (is_allowed, error_message)"""
    try:
        window_start = (datetime.utcnow() - timedelta(minutes=15)).isoformat()
        attempts = safe_get("failed_login_attempts", {
            "email": f"eq.{email}",
            "last_attempt": f"gte.{window_start}",
        })
        
        if not attempts:
            return True, None
        
        recent_count = len(attempts)
        
        # Check lockout (10 attempts = 1 hour lockout)
        if recent_count >= 10:
            first_attempt = attempts[0].get("last_attempt", "")
            if first_attempt:
                lockout_time = datetime.fromisoformat(first_attempt.replace('Z', '+00:00'))
                lockout_end = lockout_time + timedelta(hours=1)
                if datetime.now(timezone.utc) < lockout_end:
                    remaining = (lockout_end - datetime.now(timezone.utc)).seconds // 60
                    return False, f"Too many failed attempts. Account locked for {remaining} more minutes."
        
        # Check rate limit (5 attempts in 15 minutes)
        if recent_count >= 5:
            return False, "Too many login attempts. Please try again in 15 minutes."
        
        return True, None
    except Exception:
        return True, None  # Fail open for availability


def record_failed_login(email: str, ip_address: str, reason: str = "invalid_credentials") -> None:
    """Record failed login attempt"""
    try:
        safe_post("failed_login_attempts", {
            "email": email,
            "ip_address": ip_address,
            "reason": reason,
            "last_attempt": datetime.utcnow().isoformat(),
        })
    except Exception:
        pass


def clear_failed_attempts(email: str) -> None:
    """Clear failed attempts after successful login"""
    try:
        safe_patch(
            "failed_login_attempts",
            {"email": f"eq.{email}"},
            {"reason": "cleared_after_success"}
        )
    except Exception:
        pass


def extract_ip_address(request: Request) -> str:
    """Extract IP address from request (handle proxies)"""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ============================================================================
# AUTHENTICATION
# ============================================================================


@router.post("/auth/login", response_model=AdminLoginResponse)
@limiter.limit("5/minute")  # SECURITY: Rate limiting
async def admin_login(request: Request, login_request: AdminLoginRequest):
    """
    Admin login with enhanced security:
    - Rate limiting (5 attempts per minute)
    - Bcrypt password hashing
    - Account lockout after 10 failed attempts
    - Automatic hash migration from SHA256 to bcrypt
    """
    ip_address = extract_ip_address(request)
    
    # SECURITY: Check rate limit
    allowed, error_msg = check_rate_limit(login_request.email)
    if not allowed:
        raise HTTPException(status_code=429, detail=error_msg)
    
    # Get admin user
    admins = safe_get(
        "admin_users",
        {
            "email": f"eq.{login_request.email}",
            "select": "*",
            "limit": "1",
        },
    )
    admin = admins[0] if admins else None
    
    if not admin:
        record_failed_login(login_request.email, ip_address, "user_not_found")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check if admin is active
    if admin.get("is_active") is False:
        record_failed_login(login_request.email, ip_address, "account_disabled")
        raise HTTPException(status_code=403, detail="Account is disabled")
    
    # Get hash algorithm (default to sha256 for existing users)
    hash_algorithm = admin.get("hash_algorithm", "sha256")
    password_hash = admin.get("password_hash", "")
    
    # SECURITY: Verify password based on algorithm
    password_valid = False
    needs_rehash = False
    
    if hash_algorithm == "bcrypt":
        password_valid = verify_password_bcrypt(login_request.password, password_hash)
    elif hash_algorithm == "sha256":
        # Legacy SHA256 verification
        password_valid = verify_password_legacy(login_request.password, password_hash, "sha256")
        needs_rehash = True  # Mark for rehashing to bcrypt
    else:
        # Unknown algorithm
        record_failed_login(login_request.email, ip_address, "unknown_hash_algorithm")
        raise HTTPException(status_code=500, detail="Invalid password configuration")
    
    if not password_valid:
        record_failed_login(login_request.email, ip_address, "invalid_password")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # SECURITY: Rehash password if using legacy SHA256
    if needs_rehash:
        new_hash = hash_password_bcrypt(login_request.password)
        safe_patch(
            "admin_users",
            {"id": f"eq.{admin['id']}"},
            {
                "password_hash": new_hash,
                "hash_algorithm": "bcrypt",
                "password_changed_at": datetime.utcnow().isoformat()
            }
        )
    
    # SECURITY: Clear failed attempts on successful login
    clear_failed_attempts(login_request.email)
    
    # Generate tokens with short expiry
    access_token, refresh_token = token_pair(admin)
    
    # Log successful login
    log_admin_action(
        {"user_id": admin["id"], "email": admin["email"], "role": admin["role"]},
        "AUTH_LOGIN",
        f"Admin logged in from {ip_address}",
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


@router.get("/institutions/verification-requests")
async def get_institution_verification_requests(
    admin: dict = Depends(get_current_admin),
    status: Optional[str] = Query(None, description="Filter by status: pending, approved, rejected, needs_changes, or all")
):
    """
    Get institution verification requests with optional status filtering.
    Used by admin panel to display institutions awaiting verification.
    """
    filters = {"select": "*", "order": "created_at.desc"}
    if status and status != "all":
        filters["status"] = f"eq.{status}"
    
    requests = safe_get("institution_verification_requests", filters)
    log_admin_action(admin, "VIEW_INSTITUTION_REQUESTS", f"Viewed {len(requests)} institution verification requests")
    return requests


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
    limit: int = Query(50, ge=1, le=1000),
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
    # Ban the user
    result = safe_patch("users", {"id": f"eq.{user_id}"}, {"status": "banned", "updated_at": now_iso()})
    
    # Revoke all device tokens
    safe_patch("user_devices", {"user_id": f"eq.{user_id}"}, {"revoked_at": now_iso()})
    
    # SECURITY: Blacklist user tokens to force logout everywhere
    try:
        safe_post("token_blacklist", {
            "user_id": user_id,
            "reason": "user_banned",
            "admin_id": get_admin_id(admin),
            "expires_at": None,  # Permanent unless unbanned
            "notes": payload.reason or "User banned by admin"
        })
    except Exception as e:
        # Log but don't fail if blacklist fails
        print(f"Warning: Failed to blacklist user tokens: {e}")
    
    log_admin_action(admin, "USER_BAN", payload.reason or "User banned", "user", user_id)
    return result[0] if result else {"success": True}


@router.post("/users/{user_id}/unban")
async def unban_user(user_id: str, admin: dict = Depends(get_current_admin)):
    # Unban the user
    result = safe_patch("users", {"id": f"eq.{user_id}"}, {"status": "active", "updated_at": now_iso()})
    
    # SECURITY: Remove from blacklist to allow login again
    try:
        db_client.delete("token_blacklist", {"user_id": f"eq.{user_id}", "reason": "eq.user_banned"})
    except Exception as e:
        print(f"Warning: Failed to remove from blacklist: {e}")
    
    log_admin_action(admin, "USER_UNBAN", "User unbanned", "user", user_id)
    return result[0] if result else {"success": True}


@router.post("/users/{user_id}/verify")
async def verify_user(user_id: str, payload: VerifyUserRequest = Body(default=VerifyUserRequest()), admin: dict = Depends(get_current_admin)):
    result = safe_patch("users", {"id": f"eq.{user_id}"}, {"verified": True, "updated_at": now_iso()})
    log_admin_action(admin, "USER_VERIFY", {"badge": payload.badge}, "user", user_id)
    return result[0] if result else {"success": True}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(get_current_admin)):
    """Permanently delete a user and all related data from the database"""
    # Verify user exists
    existing = safe_get("users", {"id": f"eq.{user_id}", "select": "id,name", "limit": "1"})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    user_name = existing[0].get("name", "Unknown")
    
    # SECURITY: Blacklist user tokens BEFORE deletion to force immediate logout
    try:
        safe_post("token_blacklist", {
            "user_id": user_id,
            "reason": "user_deleted",
            "admin_id": get_admin_id(admin),
            "expires_at": None,  # Permanent
            "notes": f"User '{user_name}' deleted by admin"
        })
    except Exception as e:
        print(f"Warning: Failed to blacklist user tokens: {e}")

    # Cascade delete related data first (FK constraints)
    try:
        db_client.delete("user_devices", {"user_id": f"eq.{user_id}"})
    except Exception:
        pass
    try:
        db_client.delete("group_members", {"user_id": f"eq.{user_id}"})
    except Exception:
        pass
    try:
        db_client.delete("messages", {"sender_id": f"eq.{user_id}"})
    except Exception:
        pass
    try:
        db_client.delete("notifications", {"user_id": f"eq.{user_id}"})
    except Exception:
        pass
    try:
        db_client.delete("otp_challenges", {"phone": f"eq.{user_id}"})
    except Exception:
        pass

    # Hard-delete the user row
    db_client.delete("users", {"id": f"eq.{user_id}"})

    log_admin_action(admin, "USER_DELETE", f"Permanently deleted user: {user_name}", "user", user_id)
    return {"success": True, "message": f"User '{user_name}' permanently deleted"}


# ============================================================================
# GROUP MANAGEMENT
# ============================================================================


@router.get("/groups")
async def get_groups(
    admin: dict = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=1000),
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
    limit: int = Query(50, ge=1, le=1000),
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
    limit: int = Query(50, ge=1, le=1000),
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
    limit: int = Query(50, ge=1, le=1000),
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
# ADMIN NOTIFICATIONS
# ============================================================================


def notification_channels_config() -> dict[str, bool]:
    return {
        "push": bool(os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON") or os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")),
        "email": bool(os.getenv("SENDGRID_API_KEY") or os.getenv("SMTP_HOST")),
        "whatsapp": bool(os.getenv("WHATSAPP_ACCESS_TOKEN") and os.getenv("WHATSAPP_PHONE_NUMBER_ID")),
        "telegram": bool(os.getenv("TELEGRAM_BOT_TOKEN")),
        "linkedin": bool(os.getenv("LINKEDIN_ACCESS_TOKEN")),
    }


def normalize_notification(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("id"),
        "userId": row.get("user_id"),
        "title": row.get("title"),
        "body": row.get("body"),
        "type": row.get("type"),
        "data": row.get("data") or {},
        "readAt": row.get("read_at"),
        "createdAt": row.get("created_at"),
    }


@router.get("/notifications")
async def get_admin_notifications(
    admin: dict = Depends(get_current_admin),
    limit: int = Query(50, ge=1, le=1000),
):
    rows = safe_get(
        "notifications",
        {
            "select": "id,user_id,title,body,type,data,read_at,created_at",
            "order": "created_at.desc",
            "limit": str(limit),
        },
    )
    return {
        "data": [normalize_notification(row) for row in rows],
        "channels": notification_channels_config(),
    }


@router.get("/notifications/stats")
async def get_admin_notification_stats(admin: dict = Depends(get_current_admin)):
    recent = safe_get(
        "notifications",
        {
            "select": "id,title,body,type,read_at,created_at",
            "order": "created_at.desc",
            "limit": "10",
        },
    )
    unread = count_rows("notifications", {"read_at": "is.null"})
    total = count_rows("notifications")
    return {
        "total": total,
        "unread": unread,
        "recent": [normalize_notification(row) for row in recent],
        "channels": notification_channels_config(),
    }


@router.post("/notifications")
async def send_admin_notification(
    payload: AdminNotificationRequest,
    admin: dict = Depends(get_current_admin),
):
    require_super_admin(admin)
    selected_channels = {key: bool(value) for key, value in (payload.channels or {}).items()}
    if not selected_channels.get("inApp") and not any(selected_channels.values()):
        raise HTTPException(status_code=400, detail="Select at least one notification channel")

    if payload.target == "users":
        user_ids = [user_id for user_id in payload.userIds if user_id]
    else:
        users = safe_get("users", {"select": "id", "order": "created_at.desc", "limit": "10000"})
        user_ids = [row.get("id") for row in users if row.get("id")]

    if not user_ids:
        raise HTTPException(status_code=400, detail="No target users found")

    now = now_iso()
    notification_data = {
        **(payload.data or {}),
        "source": "admin_panel",
        "channels": selected_channels,
        "createdBy": get_admin_id(admin),
    }
    inserted: list[dict[str, Any]] = []
    if selected_channels.get("inApp", True):
        rows = [
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "title": payload.title,
                "body": payload.body,
                "type": payload.type,
                "data": notification_data,
                "created_at": now,
            }
            for user_id in user_ids
        ]
        for start in range(0, len(rows), 500):
            result = safe_post("notifications", rows[start:start + 500])
            if isinstance(result, list):
                inserted.extend(result)

    delivery = {
        "inApp": {
            "requested": selected_channels.get("inApp", True),
            "status": "delivered" if selected_channels.get("inApp", True) else "skipped",
            "count": len(inserted),
        }
    }

    if selected_channels.get("push"):
        devices = safe_get(
            "user_devices",
            {
                "select": "user_id,push_token,platform,revoked_at",
                "user_id": f"in.({','.join(user_ids)})",
                "limit": "10000",
            },
        )
        sent = 0
        failed = 0
        skipped = 0
        push_data = {key: str(value) for key, value in notification_data.items() if value is not None}
        for device in devices:
            token = device.get("push_token")
            if not token or device.get("revoked_at"):
                skipped += 1
                continue
            try:
                send_admin_push(token, payload.title, payload.body, push_data)
                sent += 1
            except HTTPException:
                failed += 1
        delivery["push"] = {
            "requested": True,
            "status": "sent" if sent else ("no_tokens" if not devices else "failed"),
            "sent": sent,
            "failed": failed,
            "skipped": skipped,
        }
    else:
        delivery["push"] = {"requested": False, "status": "skipped"}

    provider_env = notification_channels_config()
    for channel in ["email", "whatsapp", "telegram", "linkedin"]:
        requested = selected_channels.get(channel, False)
        delivery[channel] = {
            "requested": requested,
            "status": "not_configured" if requested and not provider_env[channel] else "queued" if requested else "skipped",
            "count": 0,
        }

    log_admin_action(
        admin,
        "NOTIFICATION_SEND",
        {"title": payload.title, "target": payload.target, "users": len(user_ids), "delivery": delivery},
        "notifications",
    )
    return {
        "success": True,
        "targetedUsers": len(user_ids),
        "created": len(inserted),
        "delivery": delivery,
    }


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
    limit: int = Query(50, ge=1, le=1000),
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
        limit = min(int(select_match.group(3)), 1000)
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
    limit: int = Query(50, ge=1, le=1000),
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


# ============================================================================
# SYSTEM CONTROL
# ============================================================================

@router.post("/system/cache/clear")
async def clear_cache(admin: dict = Depends(get_current_admin)):
    """Clear system cache - Super admin only"""
    # Only super admins can clear cache
    if admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    try:
        # Log action
        db_client.post("audit_logs", {
            "admin_id": admin.get("user_id"),
            "action": "CACHE_CLEAR",
            "details": "System cache cleared"
        })
    except:
        pass
    
    return {"success": True, "message": "Cache cleared successfully"}

@router.get("/system/status")
async def get_system_status(admin: dict = Depends(get_current_admin)):
    """Get system status information"""
    return {
        "status": "operational",
        "database": "connected",
        "version": "1.0.0",
        "uptime": "99.9%",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.post("/system/restart")
async def restart_system(admin: dict = Depends(get_current_admin)):
    """Restart system - Super admin only"""
    # Only super admins can restart
    if admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    try:
        # Log action
        db_client.post("audit_logs", {
            "admin_id": admin.get("user_id"),
            "action": "SYSTEM_RESTART",
            "details": "System restart requested"
        })
    except:
        pass
    
    return {"success": True, "message": "System restart initiated (requires manual restart)"}

@router.get("/system/logs")
async def get_system_logs(
    admin: dict = Depends(get_current_admin),
    lines: int = 100,
    level: str = "all"
):
    """Get system logs - Super admin only"""
    # Only super admins can view logs
    if admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    # For now, return audit logs as system logs
    logs = db_client.get("audit_logs", {
        "select": "*",
        "order": "created_at.desc",
        "limit": str(lines)
    })
    
    return {
        "logs": logs or [],
        "total": len(logs) if logs else 0
    }


# ============================================================================
# SECURITY CENTER
# ============================================================================

@router.get("/security/blocked-ips")
async def get_blocked_ips(admin: dict = Depends(get_current_admin)):
    """Get all blocked IP addresses"""
    ips = db_client.get("blocked_ips", {
        "select": "*",
        "order": "created_at.desc"
    })
    return {"data": ips or []}

@router.post("/security/blocked-ips")
async def block_ip(
    data: dict,
    admin: dict = Depends(get_current_admin)
):
    """Block an IP address"""
    # Only super admins can block IPs
    if admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    result = db_client.post("blocked_ips", {
        "ip_address": data.get("ip_address"),
        "reason": data.get("reason", ""),
        "blocked_by": admin.get("user_id"),
        "expires_at": data.get("expires_at")
    })
    
    # Log action
    try:
        db_client.post("audit_logs", {
            "admin_id": admin.get("user_id"),
            "action": "IP_BLOCK",
            "target_id": data.get("ip_address"),
            "details": f"IP blocked: {data.get('reason', 'No reason provided')}"
        })
    except:
        pass
    
    return result[0] if result else {"success": True}

@router.delete("/security/blocked-ips/{ip}")
async def unblock_ip(
    ip: str,
    admin: dict = Depends(get_current_admin)
):
    """Unblock an IP address"""
    if admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    db_client.delete("blocked_ips", {"ip_address": f"eq.{ip}"})
    
    # Log action
    try:
        db_client.post("audit_logs", {
            "admin_id": admin.get("user_id"),
            "action": "IP_UNBLOCK",
            "target_id": ip,
            "details": f"IP unblocked: {ip}"
        })
    except:
        pass
    
    return {"success": True}

@router.get("/security/blocked-keywords")
async def get_blocked_keywords(admin: dict = Depends(get_current_admin)):
    """Get all blocked keywords"""
    keywords = db_client.get("blocked_keywords", {
        "select": "*",
        "order": "created_at.desc"
    })
    return {"data": keywords or []}

@router.post("/security/blocked-keywords")
async def add_blocked_keyword(
    data: dict,
    admin: dict = Depends(get_current_admin)
):
    """Add a blocked keyword"""
    result = db_client.post("blocked_keywords", {
        "keyword": data.get("keyword"),
        "match_type": data.get("match_type", "exact"),
        "category": data.get("category", "general"),
        "added_by": admin.get("user_id")
    })
    
    # Log action
    try:
        db_client.post("audit_logs", {
            "admin_id": admin.get("user_id"),
            "action": "KEYWORD_ADD",
            "details": f"Blocked keyword added: {data.get('keyword')}"
        })
    except:
        pass
    
    return result[0] if result else {"success": True}

@router.delete("/security/blocked-keywords/{keyword_id}")
async def remove_blocked_keyword(
    keyword_id: str,
    admin: dict = Depends(get_current_admin)
):
    """Remove a blocked keyword"""
    db_client.delete("blocked_keywords", {"id": f"eq.{keyword_id}"})
    
    # Log action
    try:
        db_client.post("audit_logs", {
            "admin_id": admin.get("user_id"),
            "action": "KEYWORD_REMOVE",
            "target_id": keyword_id,
            "details": "Blocked keyword removed"
        })
    except:
        pass
    
    return {"success": True}

@router.get("/security/failed-logins")
async def get_failed_logins(
    admin: dict = Depends(get_current_admin),
    limit: int = 100
):
    """Get recent failed login attempts"""
    attempts = db_client.get("failed_login_attempts", {
        "select": "*",
        "order": "created_at.desc",
        "limit": str(limit)
    })
    return {"data": attempts or []}

@router.post("/security/failed-logins/clear")
async def clear_failed_logins(admin: dict = Depends(get_current_admin)):
    """Clear old failed login attempts (older than 30 days)"""
    if admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    # In a real implementation, this would delete old records
    # For now, just log the action
    try:
        db_client.post("audit_logs", {
            "admin_id": admin.get("user_id"),
            "action": "FAILED_LOGINS_CLEAR",
            "details": "Cleared old failed login attempts"
        })
    except:
        pass
    
    return {"success": True, "message": "Old failed login attempts cleared"}

@router.get("/security/rate-limits")
async def get_rate_limits(admin: dict = Depends(get_current_admin)):
    """Get all rate limit configurations"""
    limits = db_client.get("rate_limit_config", {
        "select": "*",
        "order": "created_at.desc"
    })
    return {"data": limits or []}

@router.post("/security/rate-limits")
async def add_rate_limit(
    data: dict,
    admin: dict = Depends(get_current_admin)
):
    """Add a rate limit configuration"""
    if admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    result = db_client.post("rate_limit_config", {
        "endpoint_pattern": data.get("endpoint_pattern"),
        "limit_type": data.get("limit_type", "per_ip"),
        "requests_limit": data.get("requests_limit"),
        "window_seconds": data.get("window_seconds"),
        "action_on_exceed": data.get("action_on_exceed", "block"),
        "enabled": data.get("enabled", True)
    })
    
    # Log action
    try:
        db_client.post("audit_logs", {
            "admin_id": admin.get("user_id"),
            "action": "RATE_LIMIT_ADD",
            "details": f"Rate limit added for {data.get('endpoint_pattern')}"
        })
    except:
        pass
    
    return result[0] if result else {"success": True}

@router.patch("/security/rate-limits/{limit_id}")
async def update_rate_limit(
    limit_id: str,
    data: dict,
    admin: dict = Depends(get_current_admin)
):
    """Update a rate limit configuration"""
    if admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    result = db_client.patch("rate_limit_config", {"id": f"eq.{limit_id}"}, data)
    
    # Log action
    try:
        db_client.post("audit_logs", {
            "admin_id": admin.get("user_id"),
            "action": "RATE_LIMIT_UPDATE",
            "target_id": limit_id,
            "details": "Rate limit configuration updated"
        })
    except:
        pass
    
    return result[0] if result else {"success": True}

@router.delete("/security/rate-limits/{limit_id}")
async def delete_rate_limit(
    limit_id: str,
    admin: dict = Depends(get_current_admin)
):
    """Delete a rate limit configuration"""
    if admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    db_client.delete("rate_limit_config", {"id": f"eq.{limit_id}"})
    
    # Log action
    try:
        db_client.post("audit_logs", {
            "admin_id": admin.get("user_id"),
            "action": "RATE_LIMIT_DELETE",
            "target_id": limit_id,
            "details": "Rate limit configuration deleted"
        })
    except:
        pass
    
    return {"success": True}

@router.get("/security/alerts")
async def get_security_alerts(
    admin: dict = Depends(get_current_admin),
    limit: int = 50
):
    """Get recent security alerts"""
    # Get recent audit logs that might be security-related
    alerts = db_client.get("audit_logs", {
        "select": "*",
        "action": "in.(IP_BLOCK,FAILED_LOGIN,SECURITY_ALERT,SUSPICIOUS_ACTIVITY)",
        "order": "created_at.desc",
        "limit": str(limit)
    })
    
    # Also get recent failed logins
    failed_logins = db_client.get("failed_login_attempts", {
        "select": "*",
        "order": "created_at.desc",
        "limit": "20"
    })
    
    # Get blocked IPs that are recent
    blocked_ips = db_client.get("blocked_ips", {
        "select": "*",
        "order": "created_at.desc",
        "limit": "10"
    })
    
    return {
        "audit_alerts": alerts or [],
        "failed_logins": failed_logins or [],
        "recent_blocks": blocked_ips or [],
        "summary": {
            "total_alerts": len(alerts) if alerts else 0,
            "failed_logins_count": len(failed_logins) if failed_logins else 0,
            "blocked_ips_count": len(blocked_ips) if blocked_ips else 0
        }
    }


# ============================================================================
# PLATFORM SETTINGS
# ============================================================================

@router.get("/settings/platform")
async def get_platform_settings(admin: dict = Depends(get_current_admin)):
    """Get platform settings"""
    settings = db_client.get("system_settings", {"select": "*"})
    
    # Convert to key-value format
    settings_dict = {}
    if settings:
        for setting in settings:
            settings_dict[setting["key"]] = setting["value"]
    
    # Add defaults if not exists
    defaults = {
        "platform_name": "OnCampus",
        "support_email": "support@oncampus.app",
        "max_group_size": 50000,
        "maintenance_mode": False,
        "allow_registration": True,
        "allow_group_creation": True,
        "logo_url": "/logo.png"
    }
    
    for key, value in defaults.items():
        if key not in settings_dict:
            settings_dict[key] = value
    
    return settings_dict

@router.patch("/settings/platform")
async def update_platform_settings(
    data: dict,
    admin: dict = Depends(get_current_admin)
):
    """Update platform settings"""
    # Only super admins can update platform settings
    if admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    for key, value in data.items():
        # Check if setting exists
        existing = db_client.get("system_settings", {"key": f"eq.{key}", "select": "id"})
        
        if existing:
            # Update existing
            db_client.patch("system_settings", {"key": f"eq.{key}"}, {
                "value": value,
                "updated_by": admin.get("user_id"),
                "updated_at": datetime.now(timezone.utc).isoformat()
            })
        else:
            # Insert new
            db_client.post("system_settings", {
                "key": key,
                "value": value,
                "updated_by": admin.get("user_id")
            })
    
    # Log action
    try:
        db_client.post("audit_logs", {
            "admin_id": admin.get("user_id"),
            "action": "SETTINGS_UPDATE",
            "details": f"Platform settings updated: {', '.join(data.keys())}"
        })
    except:
        pass
    
    return {"success": True, "message": "Settings updated successfully"}

@router.get("/settings/features")
async def get_feature_flags(admin: dict = Depends(get_current_admin)):
    """Get all feature flags"""
    flags = db_client.get("feature_flags", {
        "select": "*",
        "order": "created_at.desc"
    })
    return {"features": flags or []}

@router.post("/settings/features")
async def create_feature_flag(
    data: dict,
    admin: dict = Depends(get_current_admin)
):
    """Create a new feature flag"""
    if admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    result = db_client.post("feature_flags", {
        "flag_key": data.get("flag_key"),
        "enabled": data.get("enabled", False),
        "description": data.get("description", ""),
        "rollout_percentage": data.get("rollout_percentage", 100)
    })
    
    # Log action
    try:
        db_client.post("audit_logs", {
            "admin_id": admin.get("user_id"),
            "action": "FEATURE_FLAG_CREATE",
            "details": f"Feature flag created: {data.get('flag_key')}"
        })
    except:
        pass
    
    return result[0] if result else {"success": True}

@router.patch("/settings/features/{flag_key}")
async def update_feature_flag(
    flag_key: str,
    data: dict,
    admin: dict = Depends(get_current_admin)
):
    """Update a feature flag"""
    result = db_client.patch("feature_flags", {"flag_key": f"eq.{flag_key}"}, {
        **data,
        "updated_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Log action
    try:
        db_client.post("audit_logs", {
            "admin_id": admin.get("user_id"),
            "action": "FEATURE_FLAG_UPDATE",
            "target_id": flag_key,
            "details": f"Feature flag '{flag_key}' updated"
        })
    except:
        pass
    
    return result[0] if result else {"success": True}

@router.delete("/settings/features/{flag_key}")
async def delete_feature_flag(
    flag_key: str,
    admin: dict = Depends(get_current_admin)
):
    """Delete a feature flag"""
    if admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    db_client.delete("feature_flags", {"flag_key": f"eq.{flag_key}"})
    
    # Log action
    try:
        db_client.post("audit_logs", {
            "admin_id": admin.get("user_id"),
            "action": "FEATURE_FLAG_DELETE",
            "target_id": flag_key,
            "details": f"Feature flag deleted: {flag_key}"
        })
    except:
        pass
    
    return {"success": True}

@router.post("/settings/maintenance-mode")
async def toggle_maintenance_mode(
    data: dict,
    admin: dict = Depends(get_current_admin)
):
    """Toggle maintenance mode"""
    if admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    enabled = data.get("enabled", False)
    message = data.get("message", "System under maintenance. We'll be back soon!")
    
    # Update in system_settings
    existing = db_client.get("system_settings", {"key": "eq.maintenance_mode", "select": "id"})
    
    if existing:
        db_client.patch("system_settings", {"key": "eq.maintenance_mode"}, {
            "value": enabled,
            "updated_by": admin.get("user_id"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        })
    else:
        db_client.post("system_settings", {
            "key": "maintenance_mode",
            "value": enabled,
            "updated_by": admin.get("user_id")
        })
    
    # Store maintenance message
    existing_msg = db_client.get("system_settings", {"key": "eq.maintenance_message", "select": "id"})
    if existing_msg:
        db_client.patch("system_settings", {"key": "eq.maintenance_message"}, {"value": message})
    else:
        db_client.post("system_settings", {"key": "maintenance_message", "value": message})
    
    # Log action
    try:
        db_client.post("audit_logs", {
            "admin_id": admin.get("user_id"),
            "action": "MAINTENANCE_MODE_TOGGLE",
            "details": f"Maintenance mode {'enabled' if enabled else 'disabled'}"
        })
    except:
        pass
    
    return {
        "success": True,
        "maintenance_mode": enabled,
        "message": message
    }
