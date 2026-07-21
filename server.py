from datetime import datetime, timedelta, timezone
import base64
import hashlib
import json
import logging
import re
import sys

import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path
import uuid
from typing import Any, Optional

try:
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
except Exception:
    id_token = None
    google_requests = None
import jwt
import requests
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")

ROOT_DIR = Path(__file__).resolve().parents[1]
ALL_SET_DIRS = [
    ROOT_DIR / "important" / "all_set",
    ROOT_DIR / "all_info_for_api_referance_only" / "all_set",
]
ALL_SET_DIR = next((path for path in ALL_SET_DIRS if path.exists()), ALL_SET_DIRS[0])

# Configure Structured JSON Logging
class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_obj = {
            'timestamp': self.formatTime(record, self.datefmt),
            'level': record.levelname,
            'message': record.getMessage(),
            'module': record.module,
            'funcName': record.funcName
        }
        if record.exc_info:
            log_obj['exc_info'] = self.formatException(record.exc_info)
        return json.dumps(log_obj)

logger = logging.getLogger('oncampus')
logger.setLevel(logging.INFO)
handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JSONFormatter())
if not logger.handlers:
    logger.addHandler(handler)



def read_secret_file(name: str) -> str:
    path = ALL_SET_DIR / name
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="ignore")


def value_after(label: str, text: str) -> str:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.lower().startswith(label.lower()):
            if "=" in line:
                return line.split("=", 1)[-1].strip().strip("\"'")
            if ":" in line:
                return line.split(":", 1)[-1].strip().strip("\"'")
    return ""


def decode_supabase_ref(token: str) -> str:
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload.encode("utf-8")))
        return data.get("ref", "")
    except Exception:
        return ""


supabase_ref_file = read_secret_file("supabase")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or value_after("service_role(secret)", supabase_ref_file)
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or value_after("anon", supabase_ref_file)
SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
if not SUPABASE_URL and SUPABASE_ANON_KEY:
    supabase_ref = decode_supabase_ref(SUPABASE_ANON_KEY)
    if supabase_ref:
        SUPABASE_URL = f"https://{supabase_ref}.supabase.co"

upstash_ref_file = read_secret_file("upstash_url")
UPSTASH_REDIS_REST_URL = os.getenv("UPSTASH_REDIS_REST_URL") or value_after("UPSTASH_REDIS_REST_URL", upstash_ref_file)
UPSTASH_REDIS_REST_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN") or value_after("UPSTASH_REDIS_REST_TOKEN", upstash_ref_file)

firebase_default_path = ALL_SET_DIR / "oncampus-prod-firebase-adminsdk-fbsvc-11113b2908.json"
firebase_env_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
if firebase_env_path and not Path(firebase_env_path).is_absolute():
    firebase_env_path = str((BACKEND_DIR / firebase_env_path).resolve())
FIREBASE_SERVICE_ACCOUNT_PATH = firebase_env_path or (
    str(firebase_default_path) if firebase_default_path.exists() else ""
)
FIREBASE_SERVICE_ACCOUNT_JSON = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")

JWT_SECRET = os.getenv("JWT_SECRET") or value_after("JWT_SECRET", read_secret_file("JWT")) or "dev-only-change-me"

# Twilio Configuration
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")

# Development OTP Configuration
DEV_MODE = os.getenv("DEV_MODE", "false").lower() == "true"
DEV_OTP_CODE = os.getenv("DEV_OTP_CODE", "123456")

# Initialize FastAPI app
app = FastAPI(title="OnCampus API", version="1.0.0")

# SECURITY: Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "https://admin-panel-gray-rho.vercel.app",
        "https://oncampus-admin.vercel.app",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:4000",
        *[origin.strip() for origin in os.getenv("CORS_ORIGINS", "").split(",") if origin.strip()],
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def maintenance_mode_middleware(request: Request, call_next):
    health_paths = {"/health", "/v1/health", "/v1/integrations/health"}
    if request.url.path.startswith("/admin") or request.url.path in health_paths:
        return await call_next(request)
        
    try:
        # Avoid direct DB object initialization overhead per request if possible,
        # but since db is global here we can just do a quick fetch
        settings = db.get("system_settings", {"key": "eq.maintenance_mode"})
        if settings and len(settings) > 0 and settings[0].get("value") == True:
            # We also try to get the message
            msg_settings = db.get("system_settings", {"key": "eq.maintenance_message"})
            message = "System under maintenance"
            if msg_settings and len(msg_settings) > 0:
                message = msg_settings[0].get("value", message)
            
            return JSONResponse(
                status_code=503,
                content={"message": message, "maintenance": True}
            )
    except Exception:
        pass
        
    return await call_next(request)


class SupabaseRest:
    def __init__(self) -> None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            self.enabled = False
            return
        self.enabled = True
        self.base = f"{SUPABASE_URL}/rest/v1"
        self.headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
        }

    def ensure(self) -> None:
        if not self.enabled:
            raise HTTPException(
                status_code=503,
                detail="Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
            )

    def get(self, table: str, params: Optional[dict[str, Any]] = None) -> Any:
        self.ensure()
        response = requests.get(f"{self.base}/{table}", headers=self.headers, params=params, timeout=20)
        return self._json(response)

    def post(self, table: str, payload: dict[str, Any]) -> Any:
        self.ensure()
        headers = {**self.headers, "Prefer": "return=representation"}
        response = requests.post(f"{self.base}/{table}", headers=headers, json=payload, timeout=20)
        return self._json(response)

    def patch(self, table: str, params: dict[str, Any], payload: dict[str, Any]) -> Any:
        self.ensure()
        headers = {**self.headers, "Prefer": "return=representation"}
        response = requests.patch(f"{self.base}/{table}", headers=headers, params=params, json=payload, timeout=20)
        return self._json(response)

    def delete(self, table: str, params: dict[str, Any]) -> Any:
        self.ensure()
        headers = {**self.headers, "Prefer": "return=representation"}
        response = requests.delete(f"{self.base}/{table}", headers=headers, params=params, timeout=20)
        return self._json(response)

    @staticmethod
    def _json(response: requests.Response) -> Any:
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        if not response.text:
            return None
        return response.json()


db = SupabaseRest()

# Initialize Twilio OTP Service
twilio_otp = None
send_otp_sms = None
verify_otp_code = None
hash_otp_code = None

# Try to import Twilio - this is critical for production
try:
    from twilio_service import twilio_otp as _twilio_otp, send_otp_sms as _send_otp_sms, verify_otp_code as _verify_otp_code, hash_otp_code as _hash_otp_code
    twilio_otp = _twilio_otp
    send_otp_sms = _send_otp_sms
    verify_otp_code = _verify_otp_code
    hash_otp_code = _hash_otp_code
    logger.info(f"✅ Twilio OTP service loaded successfully")
    logger.info(f"✅ Twilio configured: {twilio_otp.enabled if twilio_otp else False}")
except ImportError as e:
    logger.info(f"❌ CRITICAL: Twilio package not installed: {e}")
    logger.info(f"❌ Install with: pip install twilio>=9.0.0")
except Exception as e:
    logger.info(f"❌ CRITICAL: Twilio service initialization failed: {e}")
    logger.info(f"❌ Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER")

# Include admin routes (AFTER db is initialized)
try:
    import admin_routes_simple as admin_routes_module
    admin_routes_module.set_db_client(db)  # Inject db dependency
    app.include_router(admin_routes_module.router)
    logger.info(f"✅ Admin routes loaded successfully")
except ImportError as e:
    logger.info(f"⚠️  Admin routes not loaded: {e}")
except Exception as e:
    logger.info(f"⚠️  Admin routes error: {e}")


def get_system_setting(key: str, default: Any = None) -> Any:
    try:
        rows = db.get("system_settings", {"key": f"eq.{key}", "select": "value", "limit": "1"})
        if not rows:
            return default
        return rows[0].get("value", default)
    except HTTPException:
        return default


def setting_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in {"true", "1", "yes", "on"}
    return bool(value)


def public_platform_settings() -> dict[str, Any]:
    return {
        "appName": get_system_setting("platform_name", "OnCampus"),
        "supportEmail": get_system_setting("support_email", "support@oncampus.app"),
        "maintenanceMode": setting_bool(get_system_setting("maintenance_mode", False)),
        "maintenanceMessage": get_system_setting(
            "maintenance_message",
            "System under maintenance. We'll be back soon!",
        ),
        "registrationEnabled": setting_bool(get_system_setting("registration_enabled", True), True),
        "groupCreationEnabled": setting_bool(get_system_setting("group_creation_enabled", True), True),
        "pushNotificationsEnabled": setting_bool(get_system_setting("push_notifications_enabled", True), True),
        "emailNotificationsEnabled": setting_bool(get_system_setting("email_notifications_enabled", True), True),
    }


@app.middleware("http")
async def enforce_maintenance_mode(request: Request, call_next):
    path = request.url.path
    allowed = {"/v1/health", "/v1/platform/settings", "/v1/settings/features", "/v1/integrations/health"}
    if path.startswith("/v1/") and path not in allowed and request.method != "OPTIONS":
        settings = public_platform_settings()
        if settings["maintenanceMode"]:
            return JSONResponse(
                status_code=503,
                content={
                    "detail": settings["maintenanceMessage"],
                    "maintenanceMode": True,
                    "appName": settings["appName"],
                },
            )
    return await call_next(request)


@app.get("/v1/platform/settings")
def get_public_platform_settings() -> dict[str, Any]:
    return public_platform_settings()


@app.get("/v1/settings/features")
def get_feature_flags() -> dict[str, bool]:
    rows = safe_get("feature_flags", {"select": "flag_key,enabled"})
    return {row.get("flag_key"): bool(row.get("enabled")) for row in rows if row.get("flag_key")}


class UpstashRedis:
    def __init__(self) -> None:
        self.enabled = bool(UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN)
        self.base = UPSTASH_REDIS_REST_URL.rstrip("/")
        self.headers = {"Authorization": f"Bearer {UPSTASH_REDIS_REST_TOKEN}"}

    def command(self, *parts: Any) -> Any:
        if not self.enabled:
            return None
        response = requests.post(
            self.base,
            headers=self.headers,
            json=list(parts),
            timeout=10,
        )
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        data = response.json()
        return data.get("result")

    def ping(self) -> bool:
        try:
            return self.command("PING") == "PONG"
        except Exception:
            return False

    def check_rate_limit(self, key: str, limit: int, window_seconds: int) -> bool:
        if not self.enabled:
            return True
        count = self.command("INCR", key)
        if int(count) == 1:
            self.command("EXPIRE", key, window_seconds)
        return int(count) <= limit


redis = UpstashRedis()


def firebase_project_id() -> str:
    if FIREBASE_SERVICE_ACCOUNT_JSON:
        try:
            return json.loads(FIREBASE_SERVICE_ACCOUNT_JSON).get("project_id", "")
        except Exception:
            return ""
    if not FIREBASE_SERVICE_ACCOUNT_PATH:
        return ""
    try:
        data = json.loads(Path(FIREBASE_SERVICE_ACCOUNT_PATH).read_text(encoding="utf-8"))
        return data.get("project_id", "")
    except Exception:
        return ""


def firebase_access_token() -> str:
    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Firebase auth dependency missing: {exc}")

    if not FIREBASE_SERVICE_ACCOUNT_PATH:
        if not FIREBASE_SERVICE_ACCOUNT_JSON:
            raise HTTPException(status_code=503, detail="Firebase service account is not configured")
        credentials = service_account.Credentials.from_service_account_info(
            json.loads(FIREBASE_SERVICE_ACCOUNT_JSON),
            scopes=["https://www.googleapis.com/auth/firebase.messaging"],
        )
    else:
        credentials = service_account.Credentials.from_service_account_file(
            FIREBASE_SERVICE_ACCOUNT_PATH,
            scopes=["https://www.googleapis.com/auth/firebase.messaging"],
        )
    credentials.refresh(Request())
    return credentials.token


def send_push(token: str, title: str, body: str, data: Optional[dict[str, str]] = None) -> Any:
    project_id = firebase_project_id()
    if not project_id:
        raise HTTPException(status_code=503, detail="Firebase project id is not configured")
    access_token = firebase_access_token()
    response = requests.post(
        f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send",
        headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
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


class CurrentUser(BaseModel):
    id: str
    role: str = "normal_user"


def current_user(
    authorization: Optional[str] = Header(default=None),
) -> CurrentUser:
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            user_id = payload["sub"]
            
            # SECURITY: Check if user is blacklisted (deleted/banned)
            blacklist_check = safe_get("token_blacklist", {
                "user_id": f"eq.{user_id}",
                "select": "reason,expires_at",
                "limit": "1"
            })
            
            if blacklist_check:
                blacklist = blacklist_check[0]
                expires_at = blacklist.get("expires_at")
                
                # Check if blacklist is still active
                if expires_at is None or datetime.fromisoformat(expires_at.replace('Z', '+00:00')) > datetime.now(timezone.utc):
                    reason = blacklist.get("reason", "access_revoked")
                    
                    # Log the blocked attempt
                    try:
                        db.post("audit_logs", {
                            "action": "BLOCKED_TOKEN_ATTEMPT",
                            "target_type": "user",
                            "target_id": user_id,
                            "details": f"Blacklisted user attempted access: {reason}"
                        })
                    except:
                        pass
                    
                    raise HTTPException(
                        status_code=403, 
                        detail="Access revoked. Your account has been deleted or banned."
                    )
            
            # Also check user status directly
            user_check = safe_get("users", {
                "id": f"eq.{user_id}",
                "select": "status",
                "limit": "1"
            })
            
            if user_check:
                status = user_check[0].get("status")
                if status == "banned":
                    raise HTTPException(
                        status_code=403, 
                        detail="Account banned. Please contact support."
                    )
            else:
                # User doesn't exist in database
                raise HTTPException(
                    status_code=403, 
                    detail="Account not found. Your account may have been deleted."
                )
            
            return CurrentUser(id=user_id, role=payload.get("role", "normal_user"))
            
        except jwt.PyJWTError:
            raise HTTPException(status_code=401, detail="Invalid access token")

    raise HTTPException(status_code=401, detail="Authentication required")

def optional_user(authorization: Optional[str] = Header(default=None)) -> Optional[CurrentUser]:
    if not authorization:
        return None
    try:
        return current_user(authorization)
    except HTTPException:
        return None


def require_publisher(user: CurrentUser) -> None:
    if user.role in {"institution_admin", "group_owner", "group_admin", "platform_admin"}:
        return
    rows = db.get("users", {"id": f"eq.{user.id}", "select": "can_create_posts,can_create_groups,account_type"})
    profile = rows[0] if rows else {}
    if profile.get("can_create_posts") or profile.get("account_type") in {"institution_admin", "platform_admin"}:
        return
    raise HTTPException(status_code=403, detail="Only verified institution or group admins can publish")


def require_group_creator(user: CurrentUser) -> None:
    if user.role in {"institution_admin", "platform_admin"}:
        return
    rows = db.get("users", {"id": f"eq.{user.id}", "select": "can_create_groups,account_type"})
    profile = rows[0] if rows else {}
    if profile.get("can_create_groups") or profile.get("account_type") in {"institution_admin", "platform_admin"}:
        return
    raise HTTPException(status_code=403, detail="Only verified institutions can create groups")


def group_role(group_id: str, user_id: str) -> Optional[str]:
    rows = db.get(
        "group_members",
        {"group_id": f"eq.{group_id}", "user_id": f"eq.{user_id}", "status": "eq.active", "select": "role"},
    )
    return rows[0]["role"] if rows else None


def require_group_member(group_id: str, user: CurrentUser) -> str:
    role = group_role(group_id, user.id)
    if role or user.role == "platform_admin":
        return role or "platform_admin"
    raise HTTPException(status_code=403, detail="Join this group before using this feature")


def require_group_admin(group_id: str, user: CurrentUser) -> str:
    role = group_role(group_id, user.id)
    if role in {"owner", "admin", "moderator"} or user.role == "platform_admin":
        return role or "platform_admin"
    raise HTTPException(status_code=403, detail="Only group admins can manage this")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def phone_hash(phone: str) -> str:
    return sha256(f"phone:{phone}")


def create_access_token(user_id: str, role: str = "normal_user") -> str:
    return jwt.encode(
        {
            "sub": user_id,
            "role": role,
            "iat": int(datetime.now(timezone.utc).timestamp()),
            "exp": int((datetime.now(timezone.utc) + timedelta(days=7)).timestamp()),
        },
        JWT_SECRET,
        algorithm="HS256",
    )


def safe_get(table: str, params: Optional[dict[str, Any]] = None, fallback: Any = None) -> Any:
    try:
        return db.get(table, params)
    except HTTPException:
        return [] if fallback is None else fallback


def safe_post(table: str, payload: dict[str, Any], fallback: Any = None) -> Any:
    try:
        return db.post(table, payload)
    except HTTPException as exc:
        logger.info(f"Optional insert into {table} failed: {exc.detail}")
        return fallback


def safe_delete(table: str, params: dict[str, Any], fallback: Any = None) -> Any:
    try:
        return db.delete(table, params)
    except HTTPException as exc:
        logger.info(f"Optional delete from {table} failed: {exc.detail}")
        return fallback


def notify_admins(title: str, body: str, notification_type: str, data: Optional[dict[str, Any]] = None) -> None:
    safe_post(
        "notifications",
        {
            "title": title,
            "body": body,
            "type": notification_type,
            "data": data or {},
            "created_at": now_iso(),
        },
    )


def serialize_user(row: dict[str, Any]) -> dict[str, Any]:
    account_type = row.get("account_type") or "normal_user"
    return {
        "id": row["id"],
        "email": row.get("email"),
        "name": row.get("name"),
        "city": row.get("city"),
        "course": row.get("course"),
        "bio": row.get("bio"),
        "handle": row.get("handle"),
        "avatarUrl": row.get("avatar_url"),
        "coverUrl": row.get("cover_url"),
        "verified": row.get("verified", False),
        "accountType": account_type,
        "roles": [account_type],
        "canCreatePosts": row.get("can_create_posts", False),
        "canCreateGroups": row.get("can_create_groups", False),
        "profileCompleted": row.get("profile_completed"),
        "onboardingSkipped": row.get("onboarding_skipped") or {},
        "defaultAvatarKey": row.get("default_avatar_key"),
    }


def serialize_group(row: dict[str, Any], role: Optional[str] = None) -> dict[str, Any]:
    return {
        "id": row["id"],
        "email": row.get("email"),
        "name": row.get("name"),
        "description": row.get("description"),
        "city": row.get("city"),
        "category": row.get("category"),
        "visibility": row.get("visibility"),
        "avatarUrl": row.get("avatar_url"),
        "official": row.get("official", False),
        "postingMode": row.get("posting_mode"),
        "joinPolicy": row.get("join_policy"),
        "institutionId": row.get("institution_id"),
        "memberCount": row.get("member_count", 0),
        "role": role,
        "pinned": row.get("pinned", False),
        "muted": row.get("muted", False),
        "mutedAt": row.get("muted_at"),
        "unread": row.get("unread", 0),
        "lastMessage": row.get("last_message"),
        "lastMessageAt": row.get("last_message_at"),
    }


def group_payload_to_db(payload: dict[str, Any], allow_official: bool = False) -> dict[str, Any]:
    data: dict[str, Any] = {}
    mapping = {
        "name": "name",
        "description": "description",
        "city": "city",
        "category": "category",
        "visibility": "visibility",
        "avatarUrl": "avatar_url",
        "avatar_url": "avatar_url",
        "joinPolicy": "join_policy",
        "join_policy": "join_policy",
        "postingMode": "posting_mode",
        "posting_mode": "posting_mode",
        "institutionId": "institution_id",
        "institution_id": "institution_id",
    }
    for source, target in mapping.items():
        value = payload.get(source)
        if value is not None:
            data[target] = value.strip() if isinstance(value, str) else value
    if allow_official and payload.get("official") is not None:
        data["official"] = bool(payload.get("official"))
    return data


def serialize_comment(row: dict[str, Any], users_by_id: Optional[dict[str, dict[str, Any]]] = None) -> dict[str, Any]:
    users_by_id = users_by_id or {}
    author = users_by_id.get(row.get("user_id"), {})
    return {
        "id": row.get("id"),
        "content": row.get("content") or "",
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
        "user": {
            "id": row.get("user_id"),
            "name": author.get("name") or "Member",
            "avatarUrl": author.get("avatar_url"),
            "verified": author.get("verified", False),
        },
    }


def serialize_post_summary(row: dict[str, Any], user: Optional[CurrentUser] = None) -> dict[str, Any]:
    author_rows = safe_get("users", {"id": f"eq.{row.get('author_id')}", "select": "*", "limit": "1"}) if row.get("author_id") else []
    group_rows = safe_get("groups", {"id": f"eq.{row.get('group_id')}", "select": "id,name", "limit": "1"}) if row.get("group_id") else []
    liked = False
    bookmarked = False
    if user:
        liked = bool(safe_get("post_reactions", {"post_id": f"eq.{row['id']}", "user_id": f"eq.{user.id}", "select": "post_id", "limit": "1"}))
        bookmarked = bool(safe_get("saved_posts", {"post_id": f"eq.{row['id']}", "user_id": f"eq.{user.id}", "select": "post_id", "limit": "1"}))
    return {
        "id": row["id"],
        "title": row.get("title"),
        "content": row.get("content"),
        "mediaUrl": row.get("media_url"),
        "mediaType": row.get("media_type"),
        "pinned": row.get("pinned", False),
        "postType": row.get("type"),
        "announcement": row.get("type") in {"announcement", "emergency", "notice"},
        "createdAt": row.get("published_at") or row.get("created_at"),
        "author": serialize_user(author_rows[0]) if author_rows else {"id": row.get("author_id"), "name": "OnCampus user"},
        "group": group_rows[0] if group_rows else None,
        "counts": {
            "reactions": len(safe_get("post_reactions", {"post_id": f"eq.{row['id']}", "select": "user_id"})),
            "comments": len(safe_get("post_comments", {"post_id": f"eq.{row['id']}", "deleted_at": "is.null", "select": "id"})),
            "reposts": len(safe_get("posts", {"repost_of": f"eq.{row['id']}", "status": "eq.published", "select": "id"})),
        },
        "liked": liked,
        "bookmarked": bookmarked,
    }


def group_member_count(group_id: str) -> int:
    rows = safe_get("group_members", {"group_id": f"eq.{group_id}", "status": "eq.active", "select": "user_id"})
    return len(rows)


def current_institution_admin(user: CurrentUser) -> Optional[dict[str, Any]]:
    rows = safe_get(
        "institution_admins",
        {"user_id": f"eq.{user.id}", "status": "eq.active", "select": "institution_id,role"},
    )
    if rows:
        return rows[0]
    return None


def require_institution_admin(user: CurrentUser, institution_id: Optional[str] = None) -> dict[str, Any]:
    admin = current_institution_admin(user)
    if admin and (institution_id is None or admin.get("institution_id") == institution_id):
        return admin
    if user.role == "platform_admin":
        return {"institution_id": institution_id, "role": "platform_admin"}
    raise HTTPException(status_code=403, detail="Institution admin access required")


def require_institution_admin_for(institution_id: str, user: CurrentUser) -> dict[str, Any]:
    return require_institution_admin(user, institution_id)


def get_institution_policy_by_id(institution_id: str) -> dict[str, Any]:
    rows = safe_get("institutions", {"id": f"eq.{institution_id}", "select": "verification_policy", "limit": "1"})
    institution = rows[0] if rows else None
    return merged_institution_policy(institution)


@app.get("/")
@app.get("/health")
@app.get("/v1/health")
def health() -> dict[str, Any]:
    firebase_configured = bool(FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON)
    # Always re-read from env at request time to get Railway's live values
    _tw_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
    _tw_token = os.getenv("TWILIO_AUTH_TOKEN", "")
    _tw_phone = os.getenv("TWILIO_PHONE_NUMBER", "")
    _twilio_ok = bool(_tw_sid and _tw_token and _tw_phone)
    _dev = os.getenv("DEV_MODE", "false").lower() == "true"
    if _twilio_ok:
        _provider = "twilio"
    elif _dev:
        _provider = "dev_mode"
    else:
        _provider = "firebase_phone_auth"
    return {
        "status": "ok",
        "supabaseConfigured": db.enabled,
        "redisConfigured": redis.enabled,
        "redisReachable": redis.ping() if redis.enabled else False,
        "firebaseConfigured": firebase_configured,
        "firebaseProjectId": firebase_project_id(),
        "otpProviderConfigured": _twilio_ok or firebase_configured,
        "otpProvider": _provider,
        "twilioConfigured": _twilio_ok,
        "timestamp": now_iso(),
    }


@app.get("/v1/integrations/health")
def integrations_health() -> dict[str, Any]:
    firebase_configured = bool(FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON)
    # Always re-read from env at request time to get Railway's live values
    _tw_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
    _tw_token = os.getenv("TWILIO_AUTH_TOKEN", "")
    _tw_phone = os.getenv("TWILIO_PHONE_NUMBER", "")
    twilio_configured = bool(_tw_sid and _tw_token and _tw_phone)
    _dev = os.getenv("DEV_MODE", "false").lower() == "true"
    _dev_code = os.getenv("DEV_OTP_CODE", "123456")

    return {
        "supabase": {"configured": db.enabled},
        "upstashRedis": {"configured": redis.enabled, "reachable": redis.ping() if redis.enabled else False},
        "firebase": {"configured": firebase_configured, "projectId": firebase_project_id()},
        "twilio": {
            "configured": twilio_configured,
            "phoneNumber": _tw_phone if twilio_configured else None,
            "enabled": twilio_otp.enabled if twilio_otp else twilio_configured
        },
        "otp": {
            "provider": "dev_mode" if _dev else ("twilio" if twilio_configured else "firebase_phone_auth"),
            "configured": True if _dev else (twilio_configured or firebase_configured),
            "devMode": _dev,
            "devOtpCode": _dev_code if _dev else None
        },
        "render": {"configured": bool(os.getenv("RENDER_API_KEY"))},
        "railway": {"configured": bool(os.getenv("RAILWAY_TOKEN"))},
        "claude": {"configured": bool(os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY"))},
    }


class StartOtpDevDto(BaseModel):
    phone: str
    action: Optional[str] = None


class StartInstitutionOtpDto(BaseModel):
    identifier: str


class VerifyOtpDevDto(BaseModel):
    phone: str
    code: str
    platform: Optional[str] = None


class VerifyInstitutionOtpDto(BaseModel):
    phone: str
    code: str
    identifier: Optional[str] = None
    platform: Optional[str] = None


def normalized_login_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    if len(digits) == 10:
        return f"+91{digits}"
    if len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    if (value or "").strip().startswith("+") and len(digits) >= 10:
        return f"+{digits}"
    return (value or "").strip()


def is_email_identifier(value: str) -> bool:
    return bool(re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", (value or "").strip().lower()))


def user_has_institution_access(user_row: Optional[dict[str, Any]]) -> bool:
    if not user_row:
        return False
    if user_row.get("account_type") in {"institution_admin", "platform_admin"}:
        return True
    admin_rows = safe_get(
        "institution_admins",
        {"user_id": f"eq.{user_row.get('id')}", "status": "eq.active", "select": "id", "limit": "1"},
    )
    if admin_rows:
        return True
    requests = safe_get(
        "institution_verification_requests",
        {"submitted_by": f"eq.{user_row.get('id')}", "select": "id,status", "order": "created_at.desc", "limit": "1"},
    )
    return bool(requests)


def ensure_user_login_allowed(user_row: Optional[dict[str, Any]]) -> None:
    if user_has_institution_access(user_row):
        raise HTTPException(status_code=403, detail="Use Institution Login for this account.")


def find_institution_login(identifier: str) -> dict[str, Any]:
    raw = (identifier or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Enter your registered institution email or phone number.")

    request_row: Optional[dict[str, Any]] = None
    user_row: Optional[dict[str, Any]] = None
    phone = ""

    if is_email_identifier(raw):
        email = raw.lower()
        users = safe_get(
            "users",
            {"email": f"eq.{email}", "select": "*", "limit": "1"},
        )
        user_row = users[0] if users else None
        requests = safe_get(
            "institution_verification_requests",
            {"official_email": f"eq.{email}", "select": "*", "order": "created_at.desc", "limit": "1"},
        )
        request_row = requests[0] if requests else None
        if request_row and request_row.get("submitted_by"):
            submitted_users = safe_get(
                "users",
                {"id": f"eq.{request_row.get('submitted_by')}", "select": "*", "limit": "1"},
            )
            user_row = submitted_users[0] if submitted_users else user_row
        phone = normalized_login_phone(str((request_row or {}).get("phone") or ""))
    else:
        phone = normalized_login_phone(raw)
        if not phone or len(re.sub(r"\D", "", phone)) < 10:
            raise HTTPException(status_code=400, detail="Enter a valid registered institution phone number.")
        hashed_phone = phone_hash(phone)
        users = safe_get("users", {"phone_hash": f"eq.{hashed_phone}", "select": "*", "limit": "1"})
        user_row = users[0] if users else None
        phone_without_country_code = re.sub(r"^\+91", "", phone)
        request_filters = [
            {"phone": f"eq.{phone}", "select": "*", "order": "created_at.desc", "limit": "1"},
            {"phone": f"eq.{phone_without_country_code}", "select": "*", "order": "created_at.desc", "limit": "1"},
        ]
        for filters in request_filters:
            requests = safe_get("institution_verification_requests", filters)
            if requests:
                request_row = requests[0]
                break

    if not user_row and request_row and request_row.get("submitted_by"):
        users = safe_get("users", {"id": f"eq.{request_row.get('submitted_by')}", "select": "*", "limit": "1"})
        user_row = users[0] if users else None

    if not user_row or not user_has_institution_access(user_row):
        raise HTTPException(status_code=404, detail="No registered institution account found. Please register your institution first.")
    if not phone or len(re.sub(r"\D", "", phone)) < 10:
        raise HTTPException(status_code=400, detail="This institution account has no verified phone number. Contact support or log in with the registered phone.")

    return {"phone": phone, "user": user_row, "request": request_row}


def verify_phone_otp_code(phone: str, code: str) -> None:
    if not phone or len(phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")

    if DEV_MODE:
        if code != DEV_OTP_CODE:
            raise HTTPException(status_code=400, detail=f"Invalid OTP code. Dev mode expects: {DEV_OTP_CODE}")
        return

    try:
        challenges = db.get("otp_challenges", {
            "phone": f"eq.{phone}",
            "verified": "eq.false",
            "order": "created_at.desc",
            "limit": "1"
        })
        
        if not challenges:
            raise HTTPException(status_code=400, detail="No OTP found for this number. Please request a new one.")
        
        challenge = challenges[0]
        expires_at_str = challenge.get("expires_at", "")
        expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
        
        if challenge["attempts"] >= 3:
            raise HTTPException(status_code=429, detail="Too many failed attempts. Please request a new OTP.")
        
        if not verify_otp_code(code, challenge["code_hash"]):
            db.patch("otp_challenges", 
                {"id": f"eq.{challenge['id']}"}, 
                {"attempts": challenge["attempts"] + 1}
            )
            raise HTTPException(status_code=400, detail="Invalid OTP code. Please try again.")
        
        db.patch("otp_challenges",
            {"id": f"eq.{challenge['id']}"},
            {"verified": True, "verified_at": now_iso()}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.info(f"OTP verification error: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify OTP. Please try again.")


def create_auth_session_for_user(user: dict[str, Any], is_new_user: bool, platform: Optional[str], x_device_id: Optional[str]) -> dict[str, Any]:
    device_id = x_device_id or str(uuid.uuid4())
    existing_device = db.get("user_devices", {"id": f"eq.{device_id}", "select": "id"})
    device_data = {
        "platform": platform or "unknown",
        "trusted": True,
        "last_seen_at": now_iso(),
    }
    if existing_device:
        db.patch("user_devices", {"id": f"eq.{device_id}"}, device_data)
    else:
        db.post("user_devices", {"id": device_id, "user_id": user["id"], **device_data})
    
    role = user.get("account_type") or "normal_user"
    access = create_access_token(user["id"], role)
    refresh = str(uuid.uuid4())
    
    return {
        "accessToken": access,
        "refreshToken": refresh,
        "userId": user["id"],
        "isNewUser": is_new_user,
        "user": serialize_user(user),
    }


@app.post("/v1/auth/otp/start")
def start_otp(payload: StartOtpDevDto) -> dict[str, Any]:
    """Start OTP authentication - Sends real SMS via Twilio or uses dev mode."""
    phone = normalized_login_phone(payload.phone)

    if not phone or len(phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")

    # Fast DB check for registration/login
    if payload.action:
        hashed_phone = phone_hash(phone)
        user_rows = db.get("users", {"phone_hash": f"eq.{hashed_phone}", "select": "*", "limit": "1"})
        is_registered = bool(user_rows)

        if payload.action == "register" and is_registered:
            raise HTTPException(status_code=400, detail="This number is already registered.")
        
        if payload.action == "login" and not is_registered:
            raise HTTPException(status_code=400, detail="Number is not registered. Please register first.")
        if payload.action == "login" and user_rows:
            ensure_user_login_allowed(user_rows[0])


    # Development mode - return success without sending
    if DEV_MODE:
        return {
            "success": True,
            "challengeId": str(uuid.uuid4()),
            "expiresInSeconds": 300,
            "message": f"OTP sent to {phone}",
            "devMode": True,
            "devCode": DEV_OTP_CODE,
        }
    
    # Production mode - use Twilio
    if not twilio_otp or not twilio_otp.enabled:
        raise HTTPException(
            status_code=503,
            detail="OTP service not configured. Contact support."
        )
    
    # Generate and send OTP
    success, message, otp_code = send_otp_sms(phone)
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    # Store OTP in database with expiration
    challenge_id = str(uuid.uuid4())
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    
    try:
        db.post("otp_challenges", {
            "id": challenge_id,
            "phone": phone,
            "code_hash": hash_otp_code(otp_code),
            "attempts": 0,
            "verified": False,
            "expires_at": expires_at,
            "created_at": now_iso(),
        })
    except Exception as e:
        logger.info(f"⚠️  Failed to store OTP challenge: {e}")
        # Continue anyway - OTP was sent
    
    return {
        "success": True,
        "challengeId": challenge_id,
        "expiresInSeconds": 300,
        "message": message,
        "devMode": False,
    }


@app.post("/v1/auth/institution/otp/start")
def start_institution_otp(payload: StartInstitutionOtpDto) -> dict[str, Any]:
    """Start OTP for registered institution accounts only."""
    login = find_institution_login(payload.identifier)
    phone = login["phone"]

    if DEV_MODE:
        return {
            "success": True,
            "challengeId": str(uuid.uuid4()),
            "expiresInSeconds": 300,
            "message": f"OTP sent to {phone}",
            "phone": phone,
            "devMode": True,
            "devCode": DEV_OTP_CODE,
        }

    if not twilio_otp or not twilio_otp.enabled:
        raise HTTPException(
            status_code=503,
            detail="OTP service not configured. Contact support."
        )

    success, message, otp_code = send_otp_sms(phone)
    if not success:
        raise HTTPException(status_code=400, detail=message)

    challenge_id = str(uuid.uuid4())
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    try:
        db.post("otp_challenges", {
            "id": challenge_id,
            "phone": phone,
            "code_hash": hash_otp_code(otp_code),
            "attempts": 0,
            "verified": False,
            "expires_at": expires_at,
            "created_at": now_iso(),
        })
    except Exception as e:
        logger.info(f"Failed to store institution OTP challenge: {e}")

    return {
        "success": True,
        "challengeId": challenge_id,
        "expiresInSeconds": 300,
        "message": message,
        "phone": phone,
        "devMode": False,
    }


@app.post("/v1/auth/otp/verify-dev")
@app.post("/v1/auth/otp/verify-code")
def verify_otp(payload: VerifyOtpDevDto, x_device_id: Optional[str] = Header(default=None)) -> dict[str, Any]:
    """Verify OTP code - Works with both dev mode and Twilio."""
    phone = normalized_login_phone(payload.phone)
    code = payload.code.strip()

    if not phone or len(phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")

    verify_phone_otp_code(phone, code)

    # Development mode - check against dev OTP
    if False:
        if code != DEV_OTP_CODE:
            raise HTTPException(status_code=400, detail=f"Invalid OTP code. Dev mode expects: {DEV_OTP_CODE}")
    elif False:
        # Production mode - verify against stored OTP
        try:
            # Get OTP challenge from database
            challenges = db.get("otp_challenges", {
                "phone": f"eq.{phone}",
                "verified": "eq.false",
                "order": "created_at.desc",
                "limit": "1"
            })
            
            if not challenges:
                raise HTTPException(status_code=400, detail="No OTP found for this number. Please request a new one.")
            
            challenge = challenges[0]
            
            # Check expiration
            expires_at_str = challenge.get("expires_at", "")
            expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > expires_at:
                raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
            
            # Check attempts
            if challenge["attempts"] >= 3:
                raise HTTPException(status_code=429, detail="Too many failed attempts. Please request a new OTP.")
            
            # Verify code
            if not verify_otp_code(code, challenge["code_hash"]):
                # Increment attempts
                db.patch("otp_challenges", 
                    {"id": f"eq.{challenge['id']}"}, 
                    {"attempts": challenge["attempts"] + 1}
                )
                raise HTTPException(status_code=400, detail="Invalid OTP code. Please try again.")
            
            # Mark as verified
            db.patch("otp_challenges",
                {"id": f"eq.{challenge['id']}"},
                {"verified": True, "verified_at": now_iso()}
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.info(f"⚠️  OTP verification error: {e}")
            raise HTTPException(status_code=500, detail="Failed to verify OTP. Please try again.")
    
    # Find or create user by phone hash
    hashed_phone = phone_hash(phone)
    user_rows = db.get("users", {"phone_hash": f"eq.{hashed_phone}", "select": "*"})
    is_new_user = not bool(user_rows)
    
    if user_rows:
        user = user_rows[0]
        ensure_user_login_allowed(user)
    else:
        user = db.post(
            "users",
            {
                "id": str(uuid.uuid4()),
                "phone_hash": hashed_phone,
                "status": "active",
                "account_type": "normal_user",
                "updated_at": now_iso(),
            },
        )[0]

    # Register device
    device_id = x_device_id or str(uuid.uuid4())
    existing_device = db.get("user_devices", {"id": f"eq.{device_id}", "select": "id"})
    device_data = {
        "platform": payload.platform or "unknown",
        "trusted": True,
        "last_seen_at": now_iso(),
    }
    if existing_device:
        db.patch("user_devices", {"id": f"eq.{device_id}"}, device_data)
    else:
        db.post("user_devices", {"id": device_id, "user_id": user["id"], **device_data})
    
    # Generate tokens
    role = user.get("account_type") or "normal_user"
    access = create_access_token(user["id"], role)
    refresh = str(uuid.uuid4())
    
    return {
        "accessToken": access,
        "refreshToken": refresh,
        "userId": user["id"],
        "isNewUser": is_new_user,
        "user": serialize_user(user),
    }

    if not phone or len(phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")

    # In dev mode, check against dev OTP
    if DEV_MODE:
        if code != DEV_OTP_CODE:
            raise HTTPException(status_code=400, detail=f"Invalid OTP code. Dev mode expects: {DEV_OTP_CODE}")
    else:
        # In production, would verify against Firebase or Redis
        raise HTTPException(status_code=503, detail="Production OTP verification not configured")
    
    # Find or create user by phone hash
    hashed_phone = phone_hash(phone)
    user_rows = db.get("users", {"phone_hash": f"eq.{hashed_phone}", "select": "*"})
    is_new_user = not bool(user_rows)
    if user_rows:
        user = user_rows[0]
        ensure_user_login_allowed(user)
    else:
        user = db.post(
            "users",
            {
                "id": str(uuid.uuid4()),
                "phone_hash": hashed_phone,
                "status": "active",
                "account_type": "normal_user",
                "updated_at": now_iso(),
            },
        )[0]

    # Register device
    device_id = x_device_id or str(uuid.uuid4())
    existing_device = db.get("user_devices", {"id": f"eq.{device_id}", "select": "id"})
    device_data = {
        "platform": payload.platform or "unknown",
        "trusted": True,
        "last_seen_at": now_iso(),
    }
    if existing_device:
        db.patch("user_devices", {"id": f"eq.{device_id}"}, device_data)
    else:
        db.post("user_devices", {"id": device_id, "user_id": user["id"], **device_data})
    
    # Generate tokens
    role = user.get("account_type") or "normal_user"
    access = create_access_token(user["id"], role)
    refresh = str(uuid.uuid4())
    
    return {
        "accessToken": access,
        "refreshToken": refresh,
        "userId": user["id"],
        "isNewUser": is_new_user,
        "user": serialize_user(user),
    }


@app.post("/v1/auth/institution/otp/verify")
def verify_institution_otp(payload: VerifyInstitutionOtpDto, x_device_id: Optional[str] = Header(default=None)) -> dict[str, Any]:
    phone = normalized_login_phone(payload.phone)
    code = payload.code.strip()
    login = find_institution_login(payload.identifier or phone)

    if normalized_login_phone(login["phone"]) != phone:
        raise HTTPException(status_code=400, detail="This OTP does not match the registered institution account.")

    verify_phone_otp_code(phone, code)
    user = login["user"]
    if user.get("account_type") != "institution_admin":
        patched = db.patch(
            "users",
            {"id": f"eq.{user['id']}"},
            {"account_type": "institution_admin", "can_create_posts": True, "can_create_groups": True, "updated_at": now_iso()},
        )
        user = patched[0] if patched else {**user, "account_type": "institution_admin", "can_create_posts": True, "can_create_groups": True}

    return create_auth_session_for_user(user, False, payload.platform, x_device_id)


class RefreshRequest(BaseModel):
    refreshToken: str

class VerifyOtpDto(BaseModel):
    firebaseIdToken: str
    platform: Optional[str] = None


@app.post("/v1/auth/otp/verify")
def verify_otp(payload: VerifyOtpDto, x_device_id: Optional[str] = Header(default=None)) -> dict[str, Any]:
    """Verify Firebase phone auth ID token and create/login user."""
    try:
        project_id = firebase_project_id()
        if not project_id:
            raise HTTPException(status_code=503, detail="Firebase project ID not configured on backend")
        if id_token is None or google_requests is None:
            raise HTTPException(status_code=503, detail="Firebase auth dependency missing")

        req = google_requests.Request()
        decoded = id_token.verify_firebase_token(payload.firebaseIdToken, req, audience=project_id)
        phone = decoded.get("phone_number")
        if not phone:
            raise HTTPException(status_code=400, detail="Firebase token missing phone_number")
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Firebase token: {str(e)}")

    hashed_phone = phone_hash(phone)
    user_rows = db.get("users", {"phone_hash": f"eq.{hashed_phone}", "select": "*"})
    is_new_user = not bool(user_rows)
    if user_rows:
        user = user_rows[0]
    else:
        user = db.post(
            "users",
            {
                "id": str(uuid.uuid4()),
                "phone_hash": hashed_phone,
                "status": "active",
                "account_type": "normal_user",
                "updated_at": now_iso(),
            },
        )[0]

    device_id = x_device_id or str(uuid.uuid4())
    existing_device = db.get("user_devices", {"id": f"eq.{device_id}", "select": "id"})
    device_data = {
        "platform": payload.platform or "unknown",
        "trusted": True,
        "last_seen_at": now_iso(),
    }
    if existing_device:
        db.patch("user_devices", {"id": f"eq.{device_id}"}, device_data)
    else:
        db.post("user_devices", {"id": device_id, "user_id": user["id"], **device_data})
    role = user.get("account_type") or "normal_user"
    access = create_access_token(user["id"], role)
    refresh = str(uuid.uuid4())
    return {
        "accessToken": access,
        "refreshToken": refresh,
        "userId": user["id"],
        "isNewUser": is_new_user,
        "user": serialize_user(user),
    }



@app.post("/v1/auth/refresh")
def refresh_token(payload: RefreshRequest, x_device_id: Optional[str] = Header(default=None)) -> dict[str, Any]:
    import hashlib
    token_hash = hashlib.sha256(payload.refreshToken.encode()).hexdigest()
    tokens = db.get("refresh_tokens", {"token_hash": f"eq.{token_hash}"})
    if not tokens:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    token = tokens[0]
    if token.get("revoked_at"):
        raise HTTPException(status_code=401, detail="Refresh token revoked")
        
    # Mark old token as revoked
    db.patch("refresh_tokens", {"id": f"eq.{token['id']}"}, {"revoked_at": now_iso()})
    
    # Generate new tokens
    new_access = create_access_token(token["user_id"])
    new_refresh = str(uuid.uuid4())
    new_hash = hashlib.sha256(new_refresh.encode()).hexdigest()
    
    db.post("refresh_tokens", {
        "user_id": token["user_id"],
        "device_id": x_device_id or token.get("device_id") or "unknown",
        "token_hash": new_hash,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "created_at": now_iso()
    })
    
    return {
        "accessToken": new_access,
        "refreshToken": new_refresh
    }

@app.get("/v1/auth/me")
@app.get("/v1/users/me")
def me(user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    rows = db.get(
        "users",
        {
            "id": f"eq.{user.id}",
            "select": "*",
        },
    )
    if not rows:
        raise HTTPException(status_code=404, detail="User not found")
    return serialize_user(rows[0])



class UpdateUserDto(BaseModel):
    name: Optional[str] = None
    handle: Optional[str] = None
    course: Optional[str] = None
    city: Optional[str] = None
    bio: Optional[str] = None
    avatarUrl: Optional[str] = None
    coverUrl: Optional[str] = None
    email: Optional[str] = None
    profileCompleted: Optional[bool] = None
    defaultAvatarKey: Optional[str] = None
    onboardingSkipped: Optional[dict] = None

@app.patch("/v1/users/me")
def update_user_me(payload: UpdateUserDto, user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    data = {"updated_at": now_iso()}
    if payload.name is not None: data["name"] = payload.name
    if payload.handle is not None: data["handle"] = payload.handle
    if payload.course is not None: data["course"] = payload.course
    if payload.city is not None: data["city"] = payload.city
    if payload.bio is not None: data["bio"] = payload.bio
    if payload.avatarUrl is not None: data["avatar_url"] = payload.avatarUrl
    if payload.coverUrl is not None: data["cover_url"] = payload.coverUrl
    if payload.email is not None: data["email"] = payload.email
    if payload.profileCompleted is not None: data["profile_completed"] = payload.profileCompleted
    if payload.defaultAvatarKey is not None: data["default_avatar_key"] = payload.defaultAvatarKey
    if payload.onboardingSkipped is not None: data["onboarding_skipped"] = payload.onboardingSkipped

    if len(data) > 1:
        updated = db.patch("users", {"id": f"eq.{user.id}"}, data)
        if updated:
            return serialize_user(updated[0])
    return me(user=user)


@app.delete("/v1/users/me")
def delete_user_me(user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    db.patch(
        "users",
        {"id": f"eq.{user.id}"},
        {
            "status": "deleted",
            "deleted_at": now_iso(),
            "updated_at": now_iso(),
        },
    )
    safe_delete("refresh_tokens", {"user_id": f"eq.{user.id}"})
    safe_delete("user_devices", {"user_id": f"eq.{user.id}"})
    db.patch("group_members", {"user_id": f"eq.{user.id}"}, {"status": "left", "left_at": now_iso()})
    return {"deleted": True}


@app.get("/v1/users/me/stats")
def me_stats(user: CurrentUser = Depends(current_user)) -> dict[str, int]:
    groups = safe_get("group_members", {"user_id": f"eq.{user.id}", "status": "eq.active", "select": "group_id"})
    posts = safe_get("posts", {"author_id": f"eq.{user.id}", "select": "id"})
    followers = safe_get("user_follows", {"following_id": f"eq.{user.id}", "select": "follower_id"})
    following = safe_get("user_follows", {"follower_id": f"eq.{user.id}", "select": "following_id"})
    return {
        "groups": len(groups),
        "posts": len(posts),
        "followers": len(followers),
        "following": len(following),
    }


def serialize_user_settings(row: Optional[dict[str, Any]], user_id: str) -> dict[str, Any]:
    row = row or {}
    return {
        "userId": row.get("user_id", user_id),
        "privacy": row.get("privacy") or {},
        "preferences": row.get("preferences") or {},
        "storage": row.get("storage") or {},
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


@app.get("/v1/users/me/settings")
def get_user_settings(user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    rows = safe_get("user_settings", {"user_id": f"eq.{user.id}", "select": "*", "limit": "1"})
    return serialize_user_settings(rows[0], user.id) if rows else serialize_user_settings(None, user.id)


@app.patch("/v1/users/me/settings")
def update_user_settings(payload: dict[str, Any], user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    existing = safe_get("user_settings", {"user_id": f"eq.{user.id}", "select": "*", "limit": "1"})
    current = existing[0] if existing else {}
    data: dict[str, Any] = {}
    for key in ("privacy", "preferences", "storage"):
        value = payload.get(key)
        if isinstance(value, dict):
            data[key] = {**(current.get(key) or {}), **value}
    if not data:
        return serialize_user_settings(current, user.id)
    data["updated_at"] = now_iso()
    if existing:
        row = db.patch("user_settings", {"user_id": f"eq.{user.id}"}, data)[0]
    else:
        row = db.post("user_settings", {"user_id": user.id, **data, "created_at": now_iso()})[0]
    return serialize_user_settings(row, user.id)


@app.get("/v1/users/{user_id}")
def get_public_user(user_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    rows = db.get(
        "users",
        {"id": f"eq.{user_id}", "select": "id,email,name,city,course,bio,handle,avatar_url,cover_url,verified,account_type,can_create_posts,can_create_groups,profile_completed,onboarding_skipped,default_avatar_key", "limit": "1"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="User not found")
    profile = serialize_user(rows[0])
    profile["following"] = bool(safe_get("user_follows", {"follower_id": f"eq.{user.id}", "following_id": f"eq.{user_id}", "select": "following_id", "limit": "1"}))
    return profile


@app.get("/v1/users/{user_id}/posts")
def get_user_posts(user_id: str, user: CurrentUser = Depends(current_user)) -> list[dict[str, Any]]:
    posts = db.get(
        "posts",
        {
            "author_id": f"eq.{user_id}",
            "status": "eq.published",
            "select": "id,title,content,media_url,media_type,type,status,pinned,created_at,published_at,author_id,group_id,institution_id",
            "order": "created_at.desc",
            "limit": "50",
        },
    )
    return [serialize_post_summary(row, user) for row in posts]


def users_for_follow_rows(rows: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    ids = [row.get(key) for row in rows if row.get(key)]
    if not ids:
        return []
    users = safe_get(
        "users",
        {"id": f"in.({','.join(ids)})", "select": "id,email,name,city,course,bio,handle,avatar_url,cover_url,verified,account_type,can_create_posts,can_create_groups,profile_completed,onboarding_skipped,default_avatar_key"},
    )
    user_by_id = {row["id"]: serialize_user(row) for row in users}
    return [user_by_id[user_id] for user_id in ids if user_id in user_by_id]


@app.get("/v1/users/{user_id}/followers")
def get_user_followers(user_id: str, user: CurrentUser = Depends(current_user)) -> list[dict[str, Any]]:
    rows = safe_get("user_follows", {"following_id": f"eq.{user_id}", "select": "follower_id", "order": "created_at.desc"})
    return users_for_follow_rows(rows, "follower_id")


@app.get("/v1/users/{user_id}/following")
def get_user_following(user_id: str, user: CurrentUser = Depends(current_user)) -> list[dict[str, Any]]:
    rows = safe_get("user_follows", {"follower_id": f"eq.{user_id}", "select": "following_id", "order": "created_at.desc"})
    return users_for_follow_rows(rows, "following_id")


@app.post("/v1/users/{user_id}/follow")
def follow_user(user_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="You cannot follow yourself")
    target = safe_get("users", {"id": f"eq.{user_id}", "select": "id", "limit": "1"})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    existing = safe_get("user_follows", {"follower_id": f"eq.{user.id}", "following_id": f"eq.{user_id}", "select": "follower_id", "limit": "1"})
    if not existing:
        db.post("user_follows", {"follower_id": user.id, "following_id": user_id, "created_at": now_iso()})
    return {"following": True}


@app.delete("/v1/users/{user_id}/follow")
def unfollow_user(user_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    try:
        db.delete("user_follows", {"follower_id": f"eq.{user.id}", "following_id": f"eq.{user_id}"})
    except HTTPException:
        pass
    return {"following": False}


@app.post("/v1/users/{user_id}/block")
def block_user(user_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="You cannot block yourself")
    existing = safe_get("blocked_users", {"user_id": f"eq.{user.id}", "blocked_user_id": f"eq.{user_id}", "select": "user_id", "limit": "1"})
    if not existing:
        db.post("blocked_users", {"user_id": user.id, "blocked_user_id": user_id, "created_at": now_iso()})
    return {"blocked": True}


@app.delete("/v1/users/{user_id}/block")
def unblock_user(user_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    try:
        db.delete("blocked_users", {"user_id": f"eq.{user.id}", "blocked_user_id": f"eq.{user_id}"})
    except HTTPException:
        pass
    return {"blocked": False}


@app.get("/v1/blocked-users")
def list_blocked_users(user: CurrentUser = Depends(current_user)) -> list[dict[str, Any]]:
    rows = safe_get("blocked_users", {"user_id": f"eq.{user.id}", "select": "blocked_user_id", "order": "created_at.desc"})
    ids = [row.get("blocked_user_id") for row in rows if row.get("blocked_user_id")]
    if not ids:
        return []
    users = safe_get(
        "users",
        {"id": f"in.({','.join(ids)})", "select": "id,email,name,city,course,bio,handle,avatar_url,cover_url,verified,account_type,can_create_posts,can_create_groups,profile_completed,onboarding_skipped,default_avatar_key"},
    )
    user_by_id = {row["id"]: serialize_user(row) for row in users}
    return [user_by_id[user_id] for user_id in ids if user_id in user_by_id]


@app.post("/v1/auth/logout")
def logout(user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    return {"success": True}


@app.get("/v1/feed")
def feed(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=30, ge=1, le=100),
    user: CurrentUser = Depends(current_user),
) -> dict[str, Any]:
    offset = (page - 1) * limit
    posts = db.get(
        "posts",
        {
            "select": "id,title,content,media_url,media_type,type,status,pinned,created_at,published_at,author_id,group_id,institution_id",
            "status": "eq.published",
            "order": "pinned.desc,created_at.desc",
            "limit": str(limit),
            "offset": str(offset),
        },
    )
    author_ids = sorted({post.get("author_id") for post in posts if post.get("author_id")})
    group_ids = sorted({post.get("group_id") for post in posts if post.get("group_id")})
    authors = {}
    groups_by_id = {}
    if author_ids:
        rows = safe_get("users", {"id": f"in.({','.join(author_ids)})", "select": "id,name,avatar_url,cover_url,verified,account_type"})
        authors = {row["id"]: row for row in rows}
    if group_ids:
        rows = safe_get("groups", {"id": f"in.({','.join(group_ids)})", "select": "id,name"})
        groups_by_id = {row["id"]: row for row in rows}
    liked_ids = set()
    saved_ids = set()
    post_ids = [post["id"] for post in posts]
    if post_ids:
        liked_rows = safe_get(
            "post_reactions",
            {"post_id": f"in.({','.join(post_ids)})", "user_id": f"eq.{user.id}", "select": "post_id"},
        )
        liked_ids = {row["post_id"] for row in liked_rows}
        saved_rows = safe_get(
            "saved_posts",
            {"post_id": f"in.({','.join(post_ids)})", "user_id": f"eq.{user.id}", "select": "post_id"},
        )
        saved_ids = {row["post_id"] for row in saved_rows}
    return {
        "feed": [
            {
                "id": post["id"],
                "title": post.get("title"),
                "content": post.get("content"),
                "mediaUrl": post.get("media_url"),
                "mediaType": post.get("media_type"),
                "pinned": post.get("pinned", False),
                "postType": post.get("type"),
                "announcement": post.get("type") in {"announcement", "emergency", "notice"},
                "createdAt": post.get("published_at") or post.get("created_at"),
                "author": {
                    "id": post.get("author_id"),
                    "name": authors.get(post.get("author_id"), {}).get("name") or "OnCampus user",
                    "avatarUrl": authors.get(post.get("author_id"), {}).get("avatar_url"),
                    "verified": authors.get(post.get("author_id"), {}).get("verified", False),
                    "badge": "official" if authors.get(post.get("author_id"), {}).get("account_type") == "institution_admin" else None,
                },
                "group": groups_by_id.get(post["group_id"]) if post.get("group_id") else None,
                "counts": {
                    "reactions": len(safe_get("post_reactions", {"post_id": f"eq.{post['id']}", "select": "user_id"})),
                    "comments": len(safe_get("post_comments", {"post_id": f"eq.{post['id']}", "deleted_at": "is.null", "select": "id"})),
                },
                "liked": post["id"] in liked_ids,
                "bookmarked": post["id"] in saved_ids,
            }
            for post in posts
        ],
        "hasMore": len(posts) == limit,
        "page": page,
    }


@app.get("/v1/posts/{post_id}")
def get_post(post_id: str, user: CurrentUser = Depends(current_user)) -> Any:
    rows = db.get(
        "posts",
        {
            "id": f"eq.{post_id}",
            "select": "id,title,content,media_url,media_type,type,status,pinned,created_at,published_at,author_id,group_id,institution_id",
        },
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Post not found")
    post = rows[0]
    try:
        existing_view = db.get("post_views", {"post_id": f"eq.{post_id}", "user_id": f"eq.{user.id}", "select": "post_id"})
        if existing_view:
            db.patch("post_views", {"post_id": f"eq.{post_id}", "user_id": f"eq.{user.id}"}, {"viewed_at": now_iso()})
        else:
            db.post("post_views", {"post_id": post_id, "user_id": user.id})
    except HTTPException:
        pass
    author_rows = safe_get("users", {"id": f"eq.{post.get('author_id')}", "select": "*"})
    group_rows = safe_get("groups", {"id": f"eq.{post.get('group_id')}", "select": "id,name"}) if post.get("group_id") else []
    comments = safe_get(
        "post_comments",
        {"post_id": f"eq.{post_id}", "deleted_at": "is.null", "select": "id,user_id,content,created_at", "order": "created_at.asc"},
    )
    comment_user_ids = sorted({row.get("user_id") for row in comments if row.get("user_id")})
    comment_users = {}
    if comment_user_ids:
        users_rows = safe_get("users", {"id": f"in.({','.join(comment_user_ids)})", "select": "id,name,avatar_url,cover_url,verified"})
        comment_users = {row["id"]: row for row in users_rows}
    return {
        "id": post["id"],
        "title": post.get("title"),
        "content": post.get("content"),
        "mediaUrl": post.get("media_url"),
        "mediaType": post.get("media_type"),
        "pinned": post.get("pinned", False),
        "postType": post.get("type"),
        "announcement": post.get("type") in {"announcement", "emergency", "notice"},
        "createdAt": post.get("published_at") or post.get("created_at"),
        "author": serialize_user(author_rows[0]) if author_rows else {"id": post.get("author_id"), "name": "OnCampus user"},
        "group": group_rows[0] if group_rows else None,
        "comments": [
            {
                "id": row["id"],
        "email": row.get("email"),
                "content": row.get("content"),
                "createdAt": row.get("created_at"),
                "user": {
                    "id": row.get("user_id"),
                    "name": comment_users.get(row.get("user_id"), {}).get("name") or "Member",
                    "avatarUrl": comment_users.get(row.get("user_id"), {}).get("avatar_url"),
                    "verified": comment_users.get(row.get("user_id"), {}).get("verified", False),
                },
            }
            for row in comments
        ],
        "counts": {
            "reactions": len(safe_get("post_reactions", {"post_id": f"eq.{post_id}", "select": "user_id"})),
            "comments": len(comments),
            "views": len(safe_get("post_views", {"post_id": f"eq.{post_id}", "select": "user_id"})),
        },
        "liked": bool(safe_get("post_reactions", {"post_id": f"eq.{post_id}", "user_id": f"eq.{user.id}", "select": "post_id"})),
    }


class CreateCommentDto(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


@app.get("/v1/posts/{post_id}/comments")
def list_post_comments(post_id: str, limit: int = Query(default=50, ge=1, le=200), user: CurrentUser = Depends(current_user)) -> list[dict[str, Any]]:
    post_rows = db.get("posts", {"id": f"eq.{post_id}", "status": "eq.published", "select": "id", "limit": "1"})
    if not post_rows:
        raise HTTPException(status_code=404, detail="Post not found")
    comments = safe_get(
        "post_comments",
        {
            "post_id": f"eq.{post_id}",
            "deleted_at": "is.null",
            "select": "id,user_id,content,created_at,updated_at",
            "order": "created_at.asc",
            "limit": str(limit),
        },
    )
    user_ids = sorted({row.get("user_id") for row in comments if row.get("user_id")})
    users_by_id = {}
    if user_ids:
        users = safe_get("users", {"id": f"in.({','.join(user_ids)})", "select": "id,name,avatar_url,cover_url,verified"})
        users_by_id = {row["id"]: row for row in users}
    return [serialize_comment(row, users_by_id) for row in comments]


@app.post("/v1/posts/{post_id}/comments")
def create_comment(post_id: str, payload: CreateCommentDto, user: CurrentUser = Depends(current_user)) -> Any:
    rows = db.post(
        "post_comments",
        {
            "id": str(uuid.uuid4()),
            "post_id": post_id,
            "user_id": user.id,
            "content": payload.content,
        },
    )
    return rows[0]


@app.post("/v1/posts/{post_id}/reaction")
def like_post(post_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    existing = safe_get("post_reactions", {"post_id": f"eq.{post_id}", "user_id": f"eq.{user.id}", "select": "post_id"})
    if not existing:
        db.post("post_reactions", {"post_id": post_id, "user_id": user.id, "reaction": "like"})
    count = len(safe_get("post_reactions", {"post_id": f"eq.{post_id}", "select": "user_id"}))
    return {"liked": True, "reactions": count}


@app.delete("/v1/posts/{post_id}/reaction")
def unlike_post(post_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    try:
        db.delete("post_reactions", {"post_id": f"eq.{post_id}", "user_id": f"eq.{user.id}"})
    except HTTPException:
        pass
    count = len(safe_get("post_reactions", {"post_id": f"eq.{post_id}", "select": "user_id"}))
    return {"liked": False, "reactions": count}


@app.get("/v1/saved-posts")
def list_saved_posts(user: CurrentUser = Depends(current_user)) -> list[dict[str, Any]]:
    saved = safe_get("saved_posts", {"user_id": f"eq.{user.id}", "select": "post_id,created_at", "order": "created_at.desc"})
    post_ids = [row["post_id"] for row in saved if row.get("post_id")]
    if not post_ids:
        return []
    posts = safe_get(
        "posts",
        {
            "id": f"in.({','.join(post_ids)})",
            "status": "eq.published",
            "select": "id,title,content,media_url,media_type,type,status,pinned,created_at,published_at,author_id,group_id,institution_id",
        },
    )
    post_by_id = {row["id"]: serialize_post_summary(row, user) for row in posts}
    return [post_by_id[post_id] for post_id in post_ids if post_id in post_by_id]


class SavePostDto(BaseModel):
    postId: str


@app.post("/v1/saved-posts")
def save_post(payload: SavePostDto, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    post = safe_get("posts", {"id": f"eq.{payload.postId}", "status": "eq.published", "select": "id", "limit": "1"})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = safe_get("saved_posts", {"user_id": f"eq.{user.id}", "post_id": f"eq.{payload.postId}", "select": "post_id", "limit": "1"})
    if not existing:
        db.post("saved_posts", {"user_id": user.id, "post_id": payload.postId, "created_at": now_iso()})
    return {"saved": True}


@app.delete("/v1/saved-posts/{post_id}")
def remove_saved_post(post_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    try:
        db.delete("saved_posts", {"user_id": f"eq.{user.id}", "post_id": f"eq.{post_id}"})
    except HTTPException:
        pass
    return {"saved": False}


class CreatePostDto(BaseModel):
    title: Optional[str] = None
    content: str
    type: str = "general"
    visibility: str = "public"
    institutionId: Optional[str] = None
    groupId: Optional[str] = None
    mediaUrl: Optional[str] = None
    mediaType: Optional[str] = None
    scheduledAt: Optional[str] = None
    expiresAt: Optional[str] = None


@app.post("/v1/posts")
def create_post(payload: CreatePostDto, user: CurrentUser = Depends(current_user)) -> Any:
    require_publisher(user)
    status = "scheduled" if payload.scheduledAt else "published"
    return db.post(
        "posts",
        {
            "id": str(uuid.uuid4()),
            "author_id": user.id,
            "institution_id": payload.institutionId,
            "group_id": payload.groupId,
            "type": payload.type,
            "visibility": payload.visibility,
            "status": status,
            "title": payload.title,
            "content": payload.content,
            "media_url": payload.mediaUrl,
            "media_type": payload.mediaType,
            "scheduled_at": payload.scheduledAt,
            "published_at": None if payload.scheduledAt else now_iso(),
            "expires_at": payload.expiresAt,
        },
    )[0]


class UpdatePostDto(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    mediaUrl: Optional[str] = None
    mediaType: Optional[str] = None
    visibility: Optional[str] = None


@app.patch("/v1/posts/{post_id}")
def update_post(post_id: str, payload: UpdatePostDto, user: CurrentUser = Depends(current_user)) -> Any:
    """Update post - only author or institution admin can update"""
    # Get post
    posts = db.get("posts", {"id": f"eq.{post_id}", "select": "*", "limit": "1"})
    if not posts:
        raise HTTPException(status_code=404, detail="Post not found")
    
    post = posts[0]
    
    # Check permissions: author, institution admin, or platform admin
    is_author = post["author_id"] == user.id
    is_inst_admin = False
    if post.get("institution_id"):
        inst_admins = db.get("institution_admins", {
            "institution_id": f"eq.{post['institution_id']}",
            "user_id": f"eq.{user.id}",
            "status": "eq.active",
            "select": "role"
        })
        is_inst_admin = bool(inst_admins)
    
    if not (is_author or is_inst_admin or user.role == "platform_admin"):
        raise HTTPException(status_code=403, detail="Not authorized to update this post")
    
    # Build update data
    data: dict[str, Any] = {"updated_at": now_iso()}
    if payload.title is not None:
        data["title"] = payload.title
    if payload.content is not None:
        data["content"] = payload.content
    if payload.mediaUrl is not None:
        data["media_url"] = payload.mediaUrl
    if payload.mediaType is not None:
        data["media_type"] = payload.mediaType
    if payload.visibility is not None:
        data["visibility"] = payload.visibility
    
    if len(data) == 1:  # Only updated_at
        return {"success": True, "message": "No changes provided"}
    
    result = db.patch("posts", {"id": f"eq.{post_id}"}, data)
    return result[0] if result else {"success": True}


@app.delete("/v1/posts/{post_id}")
def delete_post(post_id: str, user: CurrentUser = Depends(current_user)) -> Any:
    """Delete post - only author or institution admin can delete"""
    # Get post
    posts = db.get("posts", {"id": f"eq.{post_id}", "select": "*", "limit": "1"})
    if not posts:
        raise HTTPException(status_code=404, detail="Post not found")
    
    post = posts[0]
    
    # Check permissions
    is_author = post["author_id"] == user.id
    is_inst_admin = False
    if post.get("institution_id"):
        inst_admins = db.get("institution_admins", {
            "institution_id": f"eq.{post['institution_id']}",
            "user_id": f"eq.{user.id}",
            "status": "eq.active",
            "select": "role"
        })
        is_inst_admin = bool(inst_admins)
    
    if not (is_author or is_inst_admin or user.role == "platform_admin"):
        raise HTTPException(status_code=403, detail="Not authorized to delete this post")
    
    # Soft delete
    db.patch("posts", {"id": f"eq.{post_id}"}, {
        "status": "deleted",
        "deleted_at": now_iso(),
        "updated_at": now_iso()
    })
    
    return {"success": True, "message": "Post deleted successfully"}



@app.delete("/v1/posts/{post_id}/pin")
def unpin_post(post_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    posts = db.get("posts", {"id": f"eq.{post_id}", "select": "*", "limit": "1"})
    post = posts[0] if posts else None
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if not (user.role == "platform_admin" or (_admin := current_institution_admin(user)) and post.get("institution_id") == _admin.get("institution_id")):
        raise HTTPException(status_code=403, detail="Not authorized to pin posts")
    db.patch("posts", {"id": f"eq.{post_id}"}, {"pinned": False})
    return {"pinned": False}

@app.post("/v1/posts/{post_id}/pin")
def pin_post(post_id: str, user: CurrentUser = Depends(current_user)) -> Any:
    """Pin/unpin post - only institution admin or group admin can pin"""
    # Get post
    posts = db.get("posts", {"id": f"eq.{post_id}", "select": "*", "limit": "1"})
    if not posts:
        raise HTTPException(status_code=404, detail="Post not found")
    
    post = posts[0]
    
    # Check if user can pin (institution admin or group admin)
    can_pin = False
    if post.get("institution_id"):
        inst_admins = db.get("institution_admins", {
            "institution_id": f"eq.{post['institution_id']}",
            "user_id": f"eq.{user.id}",
            "status": "eq.active",
            "select": "role"
        })
        can_pin = bool(inst_admins)
    elif post.get("group_id"):
        role = group_role(post["group_id"], user.id)
        can_pin = role in {"owner", "admin", "moderator"}
    
    if not (can_pin or user.role == "platform_admin"):
        raise HTTPException(status_code=403, detail="Not authorized to pin this post")
    
    # Toggle pinned status
    current_pinned = post.get("pinned", False)
    result = db.patch("posts", {"id": f"eq.{post_id}"}, {
        "pinned": not current_pinned,
        "updated_at": now_iso()
    })
    
    return {
        "success": True,
        "pinned": not current_pinned,
        "message": "Post unpinned" if current_pinned else "Post pinned"
    }


class UpdateCommentDto(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


@app.patch("/v1/comments/{comment_id}")
def update_comment(comment_id: str, payload: UpdateCommentDto, user: CurrentUser = Depends(current_user)) -> Any:
    rows = db.get("post_comments", {"id": f"eq.{comment_id}", "deleted_at": "is.null", "select": "*", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Comment not found")
    comment = rows[0]
    if comment.get("user_id") != user.id and user.role != "platform_admin":
        raise HTTPException(status_code=403, detail="Not authorized to edit this comment")
    result = db.patch("post_comments", {"id": f"eq.{comment_id}"}, {"content": payload.content, "updated_at": now_iso()})
    return result[0] if result else {"success": True}


@app.delete("/v1/comments/{comment_id}")
def delete_comment(comment_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    rows = db.get("post_comments", {"id": f"eq.{comment_id}", "deleted_at": "is.null", "select": "*", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Comment not found")
    comment = rows[0]
    posts = safe_get("posts", {"id": f"eq.{comment.get('post_id')}", "select": "group_id,institution_id", "limit": "1"})
    post = posts[0] if posts else {}
    can_moderate = comment.get("user_id") == user.id or user.role == "platform_admin"
    if post.get("group_id"):
        can_moderate = can_moderate or group_role(post["group_id"], user.id) in {"owner", "admin", "moderator"}
    if post.get("institution_id"):
        can_moderate = can_moderate or bool(current_institution_admin(user))
    if not can_moderate:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
    db.patch("post_comments", {"id": f"eq.{comment_id}"}, {"deleted_at": now_iso()})
    return {"deleted": True}


@app.post("/v1/posts/{post_id}/share")
def share_post(post_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    post = safe_get("posts", {"id": f"eq.{post_id}", "status": "eq.published", "select": "id", "limit": "1"})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    safe_post("post_shares", {"post_id": post_id, "user_id": user.id, "created_at": now_iso()})
    return {"shared": True}


@app.post("/v1/posts/{post_id}/view")
def track_post_view(post_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    post = safe_get("posts", {"id": f"eq.{post_id}", "select": "id", "limit": "1"})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = safe_get("post_views", {"post_id": f"eq.{post_id}", "user_id": f"eq.{user.id}", "select": "post_id", "limit": "1"})
    if existing:
        db.patch("post_views", {"post_id": f"eq.{post_id}", "user_id": f"eq.{user.id}"}, {"viewed_at": now_iso()})
    else:
        db.post("post_views", {"post_id": post_id, "user_id": user.id, "viewed_at": now_iso()})
    return {"viewed": True}


@app.post("/v1/posts/{post_id}/repost")
def repost_post(post_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    rows = db.get(
        "posts",
        {"id": f"eq.{post_id}", "status": "eq.published", "select": "id,title,content,media_url,media_type,type,status,pinned,created_at,published_at,author_id,group_id,institution_id", "limit": "1"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Post not found")
    original = rows[0]
    try:
        reposted = db.post(
            "posts",
            {
                "id": str(uuid.uuid4()),
                "author_id": user.id,
                "group_id": original.get("group_id"),
                "institution_id": original.get("institution_id"),
                "type": "repost",
                "visibility": "public",
                "status": "published",
                "title": original.get("title"),
                "content": original.get("content") or "",
                "media_url": original.get("media_url"),
                "media_type": original.get("media_type"),
                "published_at": now_iso(),
                "repost_of": post_id,
            },
        )[0]
        return serialize_post_summary(reposted, user)
    except HTTPException:
        safe_post("post_shares", {"post_id": post_id, "user_id": user.id, "share_type": "repost", "created_at": now_iso()})
        return {**serialize_post_summary(original, user), "reposted": True}


@app.get("/v1/groups")
def my_groups(user: CurrentUser = Depends(current_user)) -> Any:
    memberships = db.get("group_members", {"user_id": f"eq.{user.id}", "status": "eq.active", "select": "group_id,role,pinned,muted,muted_at,last_read_at"})
    group_ids = [row["group_id"] for row in memberships]
    if not group_ids:
        return []
    groups = db.get(
        "groups",
        {
            "id": f"in.({','.join(group_ids)})",
            "deleted_at": "is.null",
            "select": "id,name,description,city,category,visibility,join_policy,avatar_url,official,posting_mode",
        },
    )
    membership_by_group = {row["group_id"]: row for row in memberships}
    return [
        serialize_group({**group, **membership_by_group.get(group["id"], {}), "member_count": group_member_count(group["id"])}, membership_by_group.get(group["id"], {}).get("role"))
        for group in groups
    ]


@app.post("/v1/groups")
def create_group(payload: dict[str, Any], user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    is_official = bool(payload.get("official"))
    admin = current_institution_admin(user) if is_official else None
    if is_official and not admin and user.role != "platform_admin":
        raise HTTPException(status_code=403, detail="Only institution admins can create official groups")
    data = group_payload_to_db(payload, allow_official=True)
    if not data.get("name") or not data.get("description"):
        raise HTTPException(status_code=400, detail="Group name and description are required")
    data.setdefault("visibility", "public")
    data.setdefault("join_policy", "auto_approve_verified" if data["visibility"] == "public" else "request_to_join")
    data.setdefault("posting_mode", "members_can_request")
    data["id"] = str(uuid.uuid4())
    data["created_by"] = user.id
    data["created_at"] = now_iso()
    data["deleted_at"] = None
    if admin and not data.get("institution_id"):
        data["institution_id"] = admin.get("institution_id")
    group = db.post("groups", data)[0]
    db.post(
        "group_members",
        {
            "group_id": group["id"],
            "user_id": user.id,
            "role": "owner",
            "status": "active",
            "joined_at": now_iso(),
        },
    )
    return serialize_group({**group, "member_count": 1}, "owner")


@app.get("/v1/discovery/groups")
def discover_groups(
    q: Optional[str] = None,
    city: Optional[str] = None,
    category: Optional[str] = None,
    official: Optional[bool] = None,
) -> dict[str, Any]:
    params = {
        "deleted_at": "is.null",
        "visibility": "eq.public",
        "select": "id,name,description,city,category,visibility,join_policy,avatar_url,official,posting_mode",
        "order": "official.desc,created_at.desc",
        "limit": "50",
    }
    if city:
        params["city"] = f"eq.{city}"
    if category:
        params["category"] = f"ilike.*{category}*"
    if official is not None:
        params["official"] = f"is.{str(official).lower()}"
    if q:
        params["name"] = f"ilike.*{q}*"
        
    rows = db.get("groups", params)
    
    if q:
        q_lower = q.lower()
        rows.sort(key=lambda x: (
            0 if x.get("name", "").lower() == q_lower else 1,
            0 if x.get("name", "").lower().startswith(q_lower) else 1,
            0 if q_lower in x.get("name", "").lower() else 1
        ))
        
    return {"groups": [serialize_group({**row, "member_count": group_member_count(row["id"])}) for row in rows]}


@app.get("/v1/groups/{group_id}")
def get_group(group_id: str, user: CurrentUser = Depends(current_user)) -> Any:
    rows = db.get(
        "groups",
        {
            "id": f"eq.{group_id}",
            "deleted_at": "is.null",
            "select": "id,name,description,city,category,visibility,join_policy,avatar_url,official,posting_mode,created_by,institution_id",
        },
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Group not found")
    group = rows[0]
    memberships = db.get(
        "group_members",
        {"group_id": f"eq.{group_id}", "user_id": f"eq.{user.id}", "status": "eq.active", "select": "role,pinned,muted,muted_at"},
    )
    membership = memberships[0] if memberships else {}
    return {
        **group,
        "avatarUrl": group.get("avatar_url"),
        "joinPolicy": group.get("join_policy"),
        "postingMode": group.get("posting_mode"),
        "role": membership.get("role"),
        "pinned": membership.get("pinned", False),
        "muted": membership.get("muted", False),
        "mutedAt": membership.get("muted_at"),
        "memberCount": group_member_count(group_id),
    }


@app.patch("/v1/groups/{group_id}")
def update_group(group_id: str, payload: dict[str, Any], user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    role = require_group_admin(group_id, user)
    rows = db.get("groups", {"id": f"eq.{group_id}", "deleted_at": "is.null", "select": "*", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Group not found")
    group = rows[0]
    data = group_payload_to_db(payload, allow_official=role in {"owner", "platform_admin"} or user.role == "platform_admin")
    if payload.get("official") and not group.get("institution_id"):
        admin = current_institution_admin(user)
        if not admin and user.role != "platform_admin":
            raise HTTPException(status_code=403, detail="Only institution admins can mark groups official")
        if admin:
            data["institution_id"] = admin.get("institution_id")
    if not data:
        return serialize_group({**group, "member_count": group_member_count(group_id)}, role)
    data["updated_at"] = now_iso()
    updated = db.patch("groups", {"id": f"eq.{group_id}"}, data)[0]
    return serialize_group({**updated, "member_count": group_member_count(group_id)}, role)


@app.post("/v1/groups/{group_id}/join")
def join_group(group_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    group_rows = db.get("groups", {"id": f"eq.{group_id}", "deleted_at": "is.null", "select": "id,join_policy", "limit": "1"})
    if not group_rows:
        raise HTTPException(status_code=404, detail="Group not found")
    existing_member = safe_get("group_members", {"group_id": f"eq.{group_id}", "user_id": f"eq.{user.id}", "status": "eq.active", "select": "role", "limit": "1"})
    if existing_member:
        return {"joined": True, "role": existing_member[0].get("role") or "member"}

    join_policy = group_rows[0].get("join_policy") or "open"
    if join_policy in {"approval", "request", "private", "request_to_join", "approval_required"}:
        existing_request = safe_get("join_requests", {"group_id": f"eq.{group_id}", "user_id": f"eq.{user.id}", "status": "eq.pending", "select": "id", "limit": "1"})
        if existing_request:
            return {"joined": False, "pending": True, "requestId": existing_request[0]["id"]}
        request = db.post(
            "join_requests",
            {"id": str(uuid.uuid4()), "group_id": group_id, "user_id": user.id, "status": "pending", "source": "app", "created_at": now_iso()},
        )[0]
        return {"joined": False, "pending": True, "requestId": request["id"]}

    member = db.post(
        "group_members",
        {"group_id": group_id, "user_id": user.id, "role": "member", "status": "active", "joined_at": now_iso()},
    )[0]
    return {"joined": True, "role": member.get("role") or "member"}


@app.post("/v1/groups/{group_id}/leave")
def leave_group(group_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    role = require_group_member(group_id, user)
    if role == "owner":
        raise HTTPException(status_code=400, detail="Transfer ownership before leaving this group")
    db.patch("group_members", {"group_id": f"eq.{group_id}", "user_id": f"eq.{user.id}"}, {"status": "left", "left_at": now_iso()})
    return {"left": True}


@app.get("/v1/groups/{group_id}/members")
def list_group_members(group_id: str, user: CurrentUser = Depends(current_user)) -> list[dict[str, Any]]:
    require_group_member(group_id, user)
    rows = db.get(
        "group_members",
        {"group_id": f"eq.{group_id}", "status": "eq.active", "select": "group_id,user_id,role,joined_at", "order": "joined_at.asc"},
    )
    user_ids = [row["user_id"] for row in rows if row.get("user_id")]
    users_by_id = {}
    if user_ids:
        users = safe_get("users", {"id": f"in.({','.join(user_ids)})", "select": "id,email,name,city,course,bio,handle,avatar_url,cover_url,verified,account_type"})
        users_by_id = {row["id"]: serialize_user(row) for row in users}
    return [
        {
            "groupId": row.get("group_id"),
            "userId": row.get("user_id"),
            "role": row.get("role") or "member",
            "joinedAt": row.get("joined_at"),
            "user": users_by_id.get(row.get("user_id"), {"id": row.get("user_id"), "name": "Member"}),
        }
        for row in rows
    ]


@app.patch("/v1/groups/{group_id}/members/{member_user_id}")
def update_group_member_role(group_id: str, member_user_id: str, payload: dict[str, Any], user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    role = require_group_admin(group_id, user)
    new_role = str(payload.get("role") or "").strip().lower()
    if new_role not in {"member", "moderator", "admin"}:
        raise HTTPException(status_code=400, detail="Role must be member, moderator, or admin")
    target_rows = db.get(
        "group_members",
        {"group_id": f"eq.{group_id}", "user_id": f"eq.{member_user_id}", "status": "eq.active", "select": "role", "limit": "1"},
    )
    if not target_rows:
        raise HTTPException(status_code=404, detail="Member not found")
    if target_rows[0].get("role") == "owner" and role != "owner":
        raise HTTPException(status_code=403, detail="Only owners can change owner membership")
    updated = db.patch(
        "group_members",
        {"group_id": f"eq.{group_id}", "user_id": f"eq.{member_user_id}"},
        {"role": new_role, "updated_at": now_iso()},
    )[0]
    return {"groupId": group_id, "userId": member_user_id, "role": updated.get("role") or new_role}



class TransferOwnershipRequest(BaseModel):
    userId: str

@app.post("/v1/groups/{group_id}/transfer")
def transfer_group_ownership(group_id: str, req: TransferOwnershipRequest, user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    role = group_role(group_id, user.id)
    if role != "owner" and user.role != "platform_admin":
        raise HTTPException(status_code=403, detail="Only the group owner can transfer ownership")
        
    target_rows = db.get(
        "group_members",
        {"group_id": f"eq.{group_id}", "user_id": f"eq.{req.userId}", "status": "eq.active", "limit": "1"}
    )
    if not target_rows:
        raise HTTPException(status_code=400, detail="Target user must be an active member of the group")
        
    # Update target to owner
    db.patch("group_members", {"group_id": f"eq.{group_id}", "user_id": f"eq.{req.userId}"}, {"role": "owner"})
    
    # Downgrade current user to admin if they are the owner
    if role == "owner":
        db.patch("group_members", {"group_id": f"eq.{group_id}", "user_id": f"eq.{user.id}"}, {"role": "admin"})
        
    return {"groupId": group_id, "newOwnerId": req.userId}

@app.delete("/v1/groups/{group_id}/members/{member_user_id}")
def remove_group_member(group_id: str, member_user_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    role = require_group_admin(group_id, user)
    target_rows = db.get(
        "group_members",
        {"group_id": f"eq.{group_id}", "user_id": f"eq.{member_user_id}", "status": "eq.active", "select": "role", "limit": "1"},
    )
    if not target_rows:
        raise HTTPException(status_code=404, detail="Member not found")
    target_role = target_rows[0].get("role") or "member"
    if target_role == "owner":
        raise HTTPException(status_code=400, detail="Transfer ownership before removing the owner")
    if target_role == "admin" and role not in {"owner", "platform_admin"} and user.role != "platform_admin":
        raise HTTPException(status_code=403, detail="Only owners can remove admins")
    db.patch(
        "group_members",
        {"group_id": f"eq.{group_id}", "user_id": f"eq.{member_user_id}"},
        {"status": "removed", "left_at": now_iso()},
    )
    return {"removed": True}


@app.get("/v1/groups/{group_id}/join-requests")
def list_join_requests(group_id: str, user: CurrentUser = Depends(current_user)) -> list[dict[str, Any]]:
    require_group_admin(group_id, user)
    rows = safe_get("join_requests", {"group_id": f"eq.{group_id}", "status": "eq.pending", "select": "*", "order": "created_at.asc"})
    user_ids = [row.get("user_id") for row in rows if row.get("user_id")]
    users_by_id = {}
    if user_ids:
        users = safe_get("users", {"id": f"in.({','.join(user_ids)})", "select": "id,email,name,city,course,bio,handle,avatar_url,cover_url,verified,account_type"})
        users_by_id = {row["id"]: serialize_user(row) for row in users}
    return [{**row, "user": users_by_id.get(row.get("user_id")), "users": users_by_id.get(row.get("user_id"))} for row in rows]


@app.post("/v1/groups/{group_id}/join-requests/{request_id}/approve")
def approve_join_request(group_id: str, request_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    require_group_admin(group_id, user)
    rows = db.get("join_requests", {"id": f"eq.{request_id}", "group_id": f"eq.{group_id}", "select": "*", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Join request not found")
    request_row = rows[0]
    db.patch("join_requests", {"id": f"eq.{request_id}"}, {"status": "approved", "reviewed_at": now_iso(), "reviewed_by": user.id})
    existing = safe_get("group_members", {"group_id": f"eq.{group_id}", "user_id": f"eq.{request_row['user_id']}", "select": "user_id", "limit": "1"})
    if existing:
        db.patch("group_members", {"group_id": f"eq.{group_id}", "user_id": f"eq.{request_row['user_id']}"}, {"status": "active", "role": "member", "joined_at": now_iso()})
    else:
        db.post("group_members", {"group_id": group_id, "user_id": request_row["user_id"], "role": "member", "status": "active", "joined_at": now_iso()})
    return {"approved": True}


@app.post("/v1/groups/{group_id}/join-requests/{request_id}/reject")
def reject_join_request(group_id: str, request_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    require_group_admin(group_id, user)
    db.patch("join_requests", {"id": f"eq.{request_id}", "group_id": f"eq.{group_id}"}, {"status": "rejected", "reviewed_at": now_iso(), "reviewed_by": user.id})
    return {"rejected": True}


class SendMessageDto(BaseModel):
    content: str = ""
    type: str = "text"
    mediaUrl: Optional[str] = None
    replyToId: Optional[str] = None
    clientMessageId: Optional[str] = None


def serialize_message(row: dict[str, Any], users_by_id: Optional[dict[str, dict[str, Any]]] = None) -> dict[str, Any]:
    user_row = (users_by_id or {}).get(row.get("sender_id")) or {}
    return {
        "id": row["id"],
        "groupId": row.get("group_id"),
        "senderId": row.get("sender_id"),
        "senderName": user_row.get("name") or "Member",
        "senderAvatar": user_row.get("avatarUrl") or user_row.get("avatar_url"),
        "content": row.get("content") or "",
        "type": row.get("type") or "text",
        "mediaUrl": row.get("media_url"),
        "replyToId": row.get("reply_to_id"),
        "clientMessageId": row.get("client_message_id"),
        "createdAt": row.get("created_at"),
        "created_at": row.get("created_at"),
        "users": user_row,
        "own": False,
        "pinned": row.get("pinned", False),
    }


@app.get("/v1/groups/{group_id}/messages")
def list_group_messages(group_id: str, limit: int = Query(default=50, ge=1, le=100), user: CurrentUser = Depends(current_user)) -> list[dict[str, Any]]:
    require_group_member(group_id, user)
    rows = safe_get("messages", {"group_id": f"eq.{group_id}", "deleted_at": "is.null", "select": "*", "order": "created_at.desc", "limit": str(limit)})
    sender_ids = sorted({row.get("sender_id") for row in rows if row.get("sender_id")})
    users_by_id = {}
    if sender_ids:
        users = safe_get("users", {"id": f"in.({','.join(sender_ids)})", "select": "id,name,avatar_url,cover_url,verified"})
        users_by_id = {row["id"]: serialize_user(row) for row in users}
    return [serialize_message(row, users_by_id) for row in rows]


@app.post("/v1/groups/{group_id}/messages")
def send_group_message(group_id: str, payload: SendMessageDto, user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    require_group_member(group_id, user)
    if not payload.content.strip() and not payload.mediaUrl:
        raise HTTPException(status_code=400, detail="Message content or media is required")
    row = db.post(
        "messages",
        {
            "id": str(uuid.uuid4()),
            "group_id": group_id,
            "sender_id": user.id,
            "content": payload.content,
            "type": payload.type,
            "media_url": payload.mediaUrl,
            "reply_to_id": payload.replyToId,
            "client_message_id": payload.clientMessageId,
            "created_at": now_iso(),
        },
    )[0]
    users = safe_get("users", {"id": f"eq.{user.id}", "select": "id,name,avatar_url,cover_url,verified", "limit": "1"})
    return serialize_message(row, {user.id: serialize_user(users[0])} if users else {})



class PinMessageRequest(BaseModel):
    pinned: bool

@app.post("/v1/messages/{message_id}/pin")
def pin_group_message(message_id: str, req: PinMessageRequest, user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    rows = db.get("messages", {"id": f"eq.{message_id}", "deleted_at": "is.null", "select": "*", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Message not found")
    group_id = rows[0].get("group_id")
    require_group_admin(group_id, user)
    db.patch("messages", {"id": f"eq.{message_id}"}, {"pinned": req.pinned})
    return {"id": message_id, "pinned": req.pinned}

@app.delete("/v1/messages/{message_id}")
def delete_group_message(message_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    rows = db.get("messages", {"id": f"eq.{message_id}", "deleted_at": "is.null", "select": "*", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Message not found")
    row = rows[0]
    is_sender = row.get("sender_id") == user.id
    is_admin = group_role(row.get("group_id"), user.id) in {"owner", "admin", "moderator"} or user.role == "platform_admin"
    if not (is_sender or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized to delete this message")
    db.patch("messages", {"id": f"eq.{message_id}"}, {"deleted_at": now_iso()})
    return {"deleted": True}


@app.post("/v1/groups/{group_id}/messages/read")
def mark_group_messages_read(group_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    require_group_member(group_id, user)
    db.patch("group_members", {"group_id": f"eq.{group_id}", "user_id": f"eq.{user.id}"}, {"last_read_at": now_iso()})
    return {"read": True}


@app.get("/v1/groups/{group_id}/messages/unread")
def group_unread_count(group_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, int]:
    require_group_member(group_id, user)
    member = safe_get("group_members", {"group_id": f"eq.{group_id}", "user_id": f"eq.{user.id}", "select": "last_read_at", "limit": "1"})
    last_read = member[0].get("last_read_at") if member else None
    params = {"group_id": f"eq.{group_id}", "deleted_at": "is.null", "sender_id": f"neq.{user.id}", "select": "id"}
    if last_read:
        params["created_at"] = f"gt.{last_read}"
    return {"unread": len(safe_get("messages", params))}


@app.get("/v1/groups/{group_id}/messages/search")
def search_group_messages(group_id: str, q: str = Query(default="", max_length=80), user: CurrentUser = Depends(current_user)) -> list[dict[str, Any]]:
    require_group_member(group_id, user)
    query = q.strip()
    if len(query) < 2:
        return []
    rows = safe_get("messages", {"group_id": f"eq.{group_id}", "deleted_at": "is.null", "content": f"ilike.*{query}*", "select": "*", "order": "created_at.desc", "limit": "50"})
    return [serialize_message(row) for row in rows]


@app.post("/v1/groups/{group_id}/mute")
def mute_group(group_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    require_group_member(group_id, user)
    db.patch("group_members", {"group_id": f"eq.{group_id}", "user_id": f"eq.{user.id}"}, {"muted": True, "muted_at": now_iso()})
    return {"muted": True}


@app.delete("/v1/groups/{group_id}/mute")
def unmute_group(group_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    require_group_member(group_id, user)
    db.patch("group_members", {"group_id": f"eq.{group_id}", "user_id": f"eq.{user.id}"}, {"muted": False, "muted_at": None})
    return {"muted": False}


@app.post("/v1/groups/{group_id}/pin")
def pin_group(group_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    require_group_member(group_id, user)
    db.patch("group_members", {"group_id": f"eq.{group_id}", "user_id": f"eq.{user.id}"}, {"pinned": True})
    return {"pinned": True}


@app.delete("/v1/groups/{group_id}/pin")
def unpin_group(group_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    require_group_member(group_id, user)
    db.patch("group_members", {"group_id": f"eq.{group_id}", "user_id": f"eq.{user.id}"}, {"pinned": False})
    return {"pinned": False}


class InstitutionRegistrationDto(BaseModel):
    institutionName: str
    institutionType: str
    city: str
    state: Optional[str] = None
    country: Optional[str] = None
    officialEmail: str
    phone: Optional[str] = None
    website: Optional[str] = None
    adminName: str
    designation: Optional[str] = None
    logoUrl: Optional[str] = None
    documentUrl: Optional[str] = None


@app.post("/v1/institutions/register")
def register_institution(payload: InstitutionRegistrationDto, user: Optional[CurrentUser] = Depends(optional_user)) -> Any:
    """Register institution for verification - allows unauthenticated submission"""
    
    existing_filter = {"submitted_by": f"eq.{user.id}"} if user else {"official_email": f"eq.{payload.officialEmail}"}
    existing = safe_get("institution_verification_requests", {
        **existing_filter,
        "select": "id,status",
        "order": "created_at.desc",
        "limit": "1"
    })
    if existing:
        status = existing[0].get("status")
        if status == "pending":
            return {"success": True, "message": "Verification request is already pending", "request": existing[0]}
        if status == "approved":
            raise HTTPException(status_code=400, detail="Your institution is already verified")
        if status == "needs_changes":
            # Allow updating the existing request
            request_id = existing[0]["id"]
            db.patch("institution_verification_requests", {"id": f"eq.{request_id}"}, {
                "institution_name": payload.institutionName,
                "institution_type": payload.institutionType,
                "city": payload.city,
                "state": payload.state,
                "country": payload.country,
                "official_email": payload.officialEmail,
                "phone": payload.phone,
                "website": payload.website,
                "admin_name": payload.adminName,
                "designation": payload.designation,
                "document_url": payload.documentUrl,
                "logo_url": payload.logoUrl,
                "status": "pending",
                "review_notes": None
            })
            notify_admins(
                "Institution Request Updated",
                f"Institution {payload.institutionName} updated their request.",
                "institution_verification",
                {"request_id": request_id, "institution_name": payload.institutionName},
            )
            return {"success": True, "message": "Verification request updated"}
            
    # Create new request
    response = db.post(
        "institution_verification_requests",
        {
            "id": str(uuid.uuid4()),
            "submitted_by": user.id if user else None,  # Link to current user if exists
            "institution_name": payload.institutionName,
            "institution_type": payload.institutionType,
            "city": payload.city,
            "state": payload.state,
            "country": payload.country,
            "official_email": payload.officialEmail,
            "phone": payload.phone,
            "website": payload.website,
            "admin_name": payload.adminName,
            "designation": payload.designation,
            "logo_url": payload.logoUrl,
            "document_url": payload.documentUrl,
            "status": "pending",
            "created_at": now_iso(),
        },
    )
    
    notify_admins(
        "New Institution Request",
        f"New verification request from {payload.institutionName}",
        "institution_verification",
        {"request_id": response[0].get("id") if response else None, "institution_name": payload.institutionName},
    )
    
    return response[0]


@app.get("/v1/institutions/my-request")
def get_my_institution_request(user: CurrentUser = Depends(current_user)) -> Any:
    """Fetch the current user's latest verification request status"""
    existing = safe_get("institution_verification_requests", {
        "submitted_by": f"eq.{user.id}",
        "select": "*",
        "order": "created_at.desc",
        "limit": "1"
    })
    if not existing:
        return {"has_request": False}
    
    return {
        "has_request": True,
        "request": existing[0]
    }


@app.get("/v1/institutions/me/dashboard")
def institution_dashboard(user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    """Get institution dashboard data with error handling for null institution_id"""
    # Check if user is institution admin
    admin_rows = safe_get("institution_admins", {
        "user_id": f"eq.{user.id}",
        "status": "eq.active",
        "select": "institution_id,role"
    })
    
    admin = admin_rows[0] if admin_rows else None
    institution_id = admin.get("institution_id") if admin else None
    
    # Handle case where institution_id is None (pending verification)
    institution = None
    if institution_id:
        rows = safe_get("institutions", {"id": f"eq.{institution_id}", "select": "*"})
        institution = rows[0] if rows else None

    if institution_id:
        scoped = {"institution_id": f"eq.{institution_id}"}
        posts = safe_get("posts", {**scoped, "select": "id,status,type,created_at", "order": "created_at.desc", "limit": "20"}) or []
        groups = safe_get("groups", {**scoped, "deleted_at": "is.null", "select": "id,name,city,category,visibility,official"}) or []
    else:
        posts = []
        groups = []
    
    # Batch fetch group members
    group_ids = [g["id"] for g in groups]
    if group_ids:
        all_members = safe_get("group_members", {"group_id": f"in.({','.join(group_ids)})", "status": "eq.active", "select": "group_id"})
        members_count = len(all_members) if all_members else 0
    else:
        members_count = 0
    
    # Fetch verification requests - CRITICAL FIX: fetch by submitted_by user_id
    requests = safe_get(
        "institution_verification_requests",
        {
            "submitted_by": f"eq.{user.id}",
            "select": "id,status,institution_name,logo_url,document_url,created_at,review_notes",
            "order": "created_at.desc",
            "limit": "20"
        }
    ) or []
    
    return {
        "institution": institution,
        "role": admin.get("role") if admin else None,
        "counts": {
            "posts": len(posts),
            "groups": len(groups),
            "members": members_count,
            "verificationRequests": len(requests),
        },
        "recentPosts": posts,
        "groups": groups,
        "verificationRequests": requests,
        "pendingVerification": institution_id is None,  # Flag to show pending verification state
    }


@app.get("/v1/institutions/me/analytics")
def institution_analytics(user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    admin = current_institution_admin(user)
    if not admin and user.role != "platform_admin":
        requests = safe_get(
            "institution_verification_requests",
            {
                "submitted_by": f"eq.{user.id}",
                "select": "*",
                "order": "created_at.desc",
                "limit": "1",
            },
        )
        if requests:
            request = requests[0]
            return {
                "institution": {
                    "name": request.get("institution_name"),
                    "institution_type": request.get("institution_type"),
                    "city": request.get("city"),
                    "state": request.get("state"),
                    "country": request.get("country"),
                    "logo_url": request.get("logo_url"),
                    "status": request.get("status") or "pending",
                },
                "counts": {
                    "reach": 0,
                    "members": 0,
                    "groups": 0,
                    "posts": 0,
                    "engagements": 0,
                    "approvalRate": 0,
                },
                "topGroups": [],
                "topPosts": [],
                "pendingVerification": True,
            }
        raise HTTPException(status_code=403, detail="Institution admin access required")

    if not admin:
        admin = {"institution_id": None, "role": "platform_admin"}
    institution_id = admin.get("institution_id")
    scoped = {"institution_id": f"eq.{institution_id}"} if institution_id else {}
    institution = None
    if institution_id:
        rows = safe_get("institutions", {"id": f"eq.{institution_id}", "select": "*"})
        institution = rows[0] if rows else None
    groups = safe_get("groups", {**scoped, "deleted_at": "is.null", "select": "id,name,category"})
    group_ids = [group["id"] for group in groups]
    
    if group_ids:
        all_members = safe_get("group_members", {"group_id": f"in.({','.join(group_ids)})", "status": "eq.active", "select": "group_id"})
        group_count_by_id = {}
        for m in all_members:
            group_count_by_id[m["group_id"]] = group_count_by_id.get(m["group_id"], 0) + 1
    else:
        group_count_by_id = {}

    posts = safe_get("posts", {**scoped, "select": "id,title,content,created_at", "order": "created_at.desc", "limit": "50"})
    post_ids = [post["id"] for post in posts]
    
    if post_ids:
        all_reactions = safe_get("post_reactions", {"post_id": f"in.({','.join(post_ids)})", "select": "post_id"})
        all_comments = safe_get("post_comments", {"post_id": f"in.({','.join(post_ids)})", "deleted_at": "is.null", "select": "post_id"})
        all_views = safe_get("post_views", {"post_id": f"in.({','.join(post_ids)})", "select": "post_id"})
        
        reaction_counts = {}
        for r in all_reactions: reaction_counts[r["post_id"]] = reaction_counts.get(r["post_id"], 0) + 1
            
        comment_counts = {}
        for c in all_comments: comment_counts[c["post_id"]] = comment_counts.get(c["post_id"], 0) + 1
            
        view_counts = {}
        for v in all_views: view_counts[v["post_id"]] = view_counts.get(v["post_id"], 0) + 1
    else:
        reaction_counts, comment_counts, view_counts = {}, {}, {}

    post_metrics = []
    total_reactions = 0
    total_comments = 0
    total_views = 0
    for post in posts:
        reactions = reaction_counts.get(post["id"], 0)
        comments = comment_counts.get(post["id"], 0)
        views = view_counts.get(post["id"], 0)
        
        total_reactions += reactions
        total_comments += comments
        total_views += views
        post_metrics.append({
            "id": post["id"],
            "title": post.get("title") or (post.get("content") or "Post")[:80],
            "views": views,
            "likes": reactions,
            "comments": comments,
        })
    group_ids = [group["id"] for group in groups]
    post_requests = safe_get(
        "group_post_requests",
        {"group_id": f"in.({','.join(group_ids)})", "select": "id,status"} if group_ids else {"id": "eq.__none__", "select": "id,status"},
    )
    approved_requests = [row for row in post_requests if row.get("status") in {"approved", "scheduled", "published"}]
    approval_rate = round((len(approved_requests) / len(post_requests)) * 100) if post_requests else 0
    return {
        "institution": institution,
        "counts": {
            "reach": total_views,
            "members": sum(group_count_by_id.values()),
            "groups": len(groups),
            "posts": len(posts),
            "engagements": total_reactions + total_comments,
            "approvalRate": approval_rate,
        },
        "topGroups": sorted(
            [{"id": group["id"], "name": group.get("name"), "members": group_count_by_id[group["id"]]} for group in groups],
            key=lambda row: row["members"],
            reverse=True,
        )[:5],
        "topPosts": sorted(post_metrics, key=lambda row: (row["views"], row["likes"], row["comments"]), reverse=True)[:5],
    }


class InstitutionUpdateDto(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    description: Optional[str] = None
    logoUrl: Optional[str] = None
    coverUrl: Optional[str] = None
    documentUrl: Optional[str] = None
    verificationPolicy: Optional[dict[str, Any]] = None


@app.patch("/v1/institutions/me")
def update_institution(payload: InstitutionUpdateDto, user: CurrentUser = Depends(current_user)) -> Any:
    admin = current_institution_admin(user)
    if not admin and user.role != "platform_admin":
        requests = safe_get(
            "institution_verification_requests",
            {
                "submitted_by": f"eq.{user.id}",
                "select": "id,status",
                "order": "created_at.desc",
                "limit": "1",
            },
        )
        if not requests:
            raise HTTPException(status_code=403, detail="Institution admin access required")

        request_id = requests[0]["id"]
        request_data: dict[str, Any] = {}
        for source, target in {
            "name": "institution_name",
            "city": "city",
            "state": "state",
            "country": "country",
            "website": "website",
            "phone": "phone",
            "logoUrl": "logo_url",
            "documentUrl": "document_url",
        }.items():
            value = getattr(payload, source)
            if value is not None:
                request_data[target] = value

        updated = db.patch("institution_verification_requests", {"id": f"eq.{request_id}"}, request_data)[0] if request_data else requests[0]
        return {
            "success": True,
            "pendingVerification": True,
            "request": updated,
            "message": "Pending institution request updated",
        }

    if not admin:
        admin = {"institution_id": None, "role": "platform_admin"}
    institution_id = admin.get("institution_id")
    if not institution_id:
        raise HTTPException(status_code=400, detail="No institution scope available")
    data: dict[str, Any] = {}
    for source, target in {
        "name": "name",
        "domain": "domain",
        "city": "city",
        "state": "state",
        "country": "country",
        "website": "website",
        "phone": "phone",
        "description": "description",
        "logoUrl": "logo_url",
        "coverUrl": "cover_url",
        "verificationPolicy": "verification_policy",
    }.items():
        value = getattr(payload, source)
        if value is not None:
            data[target] = value
    if not data:
        return {"success": True}
    return db.patch("institutions", {"id": f"eq.{institution_id}"}, data)[0]


@app.get("/v1/institutions/me/admins")
def institution_admins(user: CurrentUser = Depends(current_user)) -> Any:
    admin_rows = safe_get(
        "institution_admins",
        {"user_id": f"eq.{user.id}", "status": "eq.active", "select": "institution_id,role"},
    )
    if not admin_rows and user.role != "platform_admin":
        requests = safe_get(
            "institution_verification_requests",
            {
                "submitted_by": f"eq.{user.id}",
                "select": "id,status",
                "order": "created_at.desc",
                "limit": "1",
            },
        )
        if requests:
            return []
        raise HTTPException(status_code=403, detail="Institution admin access required")
    if not admin_rows:
        return []

    institution_id = admin_rows[0]["institution_id"]
    rows = db.get(
        "institution_admins",
        {"institution_id": f"eq.{institution_id}", "status": "eq.active", "select": "id,user_id,role,status,created_at"},
    )
    user_ids = [row["user_id"] for row in rows]
    users_by_id = {}
    if user_ids:
        users_rows = safe_get("users", {"id": f"in.({','.join(user_ids)})", "select": "*"})
        users_by_id = {row["id"]: row for row in users_rows}
    return [
        {
            "id": row["id"],
        "email": row.get("email"),
            "role": row.get("role"),
            "status": row.get("status"),
            "createdAt": row.get("created_at"),
            "user": serialize_user(users_by_id[row["user_id"]]) if row["user_id"] in users_by_id else {"id": row["user_id"], "name": "Admin"},
        }
        for row in rows
    ]


ADMIN_ROLES = {"owner", "admin", "content_admin", "moderator"}


class InstitutionAdminInviteDto(BaseModel):
    email: str
    role: str = "admin"


class InstitutionAdminRoleDto(BaseModel):
    role: str


def current_admin_scope_or_400(user: CurrentUser) -> dict[str, Any]:
    admin = require_institution_admin(user)
    institution_id = admin.get("institution_id")
    if not institution_id:
        raise HTTPException(status_code=400, detail="No institution scope available")
    return admin


@app.post("/v1/institutions/me/admins")
def invite_institution_admin(payload: InstitutionAdminInviteDto, user: CurrentUser = Depends(current_user)) -> Any:
    admin = current_admin_scope_or_400(user)
    institution_id = admin["institution_id"]
    role = payload.role if payload.role in ADMIN_ROLES and payload.role != "owner" else "admin"
    email = payload.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email is required")

    users = safe_get("users", {"email": f"eq.{email}", "select": "id,email,name,avatar_url,cover_url,verified,account_type", "limit": "1"})
    if not users:
        log_institution_activity(user, institution_id, "admin_invite_pending", {"email": email, "role": role})
        return {"success": True, "pending": True, "email": email, "role": role, "message": "Invite recorded. The user can be activated after they join OnCampus."}

    target_user = users[0]
    existing = safe_get(
        "institution_admins",
        {"institution_id": f"eq.{institution_id}", "user_id": f"eq.{target_user['id']}", "select": "id,status", "limit": "1"},
    )
    if existing:
        row = db.patch(
            "institution_admins",
            {"id": f"eq.{existing[0]['id']}"},
            {"role": role, "status": "active"},
        )[0]
    else:
        row = db.post(
            "institution_admins",
            {
                "id": str(uuid.uuid4()),
                "institution_id": institution_id,
                "user_id": target_user["id"],
                "role": role,
                "status": "active",
                "created_at": now_iso(),
            },
        )[0]
    log_institution_activity(user, institution_id, "admin_invited", {"email": email, "role": role, "admin_id": row.get("id")})
    return {"success": True, "pending": False, "admin": row, "user": serialize_user(target_user)}


@app.patch("/v1/institutions/me/admins/{admin_id}")
def update_institution_admin_role(admin_id: str, payload: InstitutionAdminRoleDto, user: CurrentUser = Depends(current_user)) -> Any:
    admin = current_admin_scope_or_400(user)
    institution_id = admin["institution_id"]
    if payload.role not in ADMIN_ROLES or payload.role == "owner":
        raise HTTPException(status_code=400, detail="Invalid admin role")
    rows = safe_get("institution_admins", {"id": f"eq.{admin_id}", "institution_id": f"eq.{institution_id}", "select": "id,role,user_id", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Admin not found")
    if rows[0].get("role") == "owner":
        raise HTTPException(status_code=400, detail="Owner role cannot be changed")
    updated = db.patch("institution_admins", {"id": f"eq.{admin_id}"}, {"role": payload.role})[0]
    log_institution_activity(user, institution_id, "admin_role_changed", {"admin_id": admin_id, "role": payload.role})
    return updated


@app.delete("/v1/institutions/me/admins/{admin_id}")
def remove_institution_admin(admin_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    admin = current_admin_scope_or_400(user)
    institution_id = admin["institution_id"]
    rows = safe_get("institution_admins", {"id": f"eq.{admin_id}", "institution_id": f"eq.{institution_id}", "select": "id,role,user_id", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Admin not found")
    if rows[0].get("role") == "owner":
        raise HTTPException(status_code=400, detail="Owner cannot be removed")
    if rows[0].get("user_id") == user.id:
        raise HTTPException(status_code=400, detail="You cannot remove yourself")
    db.patch("institution_admins", {"id": f"eq.{admin_id}"}, {"status": "removed"})
    log_institution_activity(user, institution_id, "admin_removed", {"admin_id": admin_id})
    return {"success": True}


INSTITUTION_DEFAULT_POLICY: dict[str, Any] = {
    "publicPage": True,
    "autoApproveStudents": False,
    "allowExternalRequests": True,
    "membersCanCreateGroups": False,
    "verifiedBadgeVisible": True,
    "weeklyDigest": True,
    "brandPalette": "Moss",
    "rolePermissions": {
        "owner": ["manage_profile", "manage_admins", "billing", "moderation", "analytics"],
        "admin": ["manage_profile", "moderation", "analytics"],
        "content_admin": ["moderation", "analytics"],
        "moderator": ["moderation"],
    },
    "contentFilters": [],
    "slowMode": {"enabled": False, "seconds": 30},
    "pushChannels": {"critical": True, "reports": True, "weeklyDigest": True},
    "twoFactorRequired": False,
    "billing": {"plan": "free", "paymentContactEmail": "", "invoiceName": ""},
    "danger": {},
}


class InstitutionSettingsPatchDto(BaseModel):
    profile: Optional[dict[str, Any]] = None
    policy: Optional[dict[str, Any]] = None
    action: Optional[str] = None


def institution_scope_for_settings(user: CurrentUser) -> dict[str, Any]:
    admin = current_institution_admin(user)
    if admin or user.role == "platform_admin":
        institution_id = admin.get("institution_id") if admin else None
        institution = None
        if institution_id:
            rows = safe_get("institutions", {"id": f"eq.{institution_id}", "select": "*", "limit": "1"})
            institution = rows[0] if rows else None
        return {
            "admin": admin or {"institution_id": institution_id, "role": "platform_admin"},
            "institution_id": institution_id,
            "institution": institution,
            "request": None,
            "pending": False,
        }

    requests = safe_get(
        "institution_verification_requests",
        {
            "submitted_by": f"eq.{user.id}",
            "select": "*",
            "order": "created_at.desc",
            "limit": "1",
        },
    )
    if requests:
        return {
            "admin": None,
            "institution_id": None,
            "institution": None,
            "request": requests[0],
            "pending": True,
        }
    raise HTTPException(status_code=403, detail="Institution admin access required")


def merged_institution_policy(institution: Optional[dict[str, Any]], request: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    policy = dict(INSTITUTION_DEFAULT_POLICY)
    stored = (institution or {}).get("verification_policy") or {}
    if isinstance(stored, dict):
        policy.update(stored)
    if request and not institution:
        policy["billing"] = {**policy["billing"], "paymentContactEmail": request.get("official_email") or ""}
    return policy


def coerce_json_object(value: Any) -> Optional[dict[str, Any]]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            return None
    return None


def apply_latest_pending_settings_snapshot(user_id: str, policy: dict[str, Any]) -> dict[str, Any]:
    snapshots = safe_get(
        "audit_logs",
        {
            "target_type": "eq.institution",
            "target_id": f"eq.{user_id}",
            "action": "eq.pending_settings_updated",
            "select": "details,created_at",
            "order": "created_at.desc",
            "limit": "1",
        },
    )
    details = coerce_json_object(snapshots[0].get("details")) if snapshots else None
    if isinstance(details, dict) and isinstance(details.get("policy"), dict):
        policy.update(details["policy"])
    return policy


def apply_pending_profile_snapshot(request: Optional[dict[str, Any]], policy: dict[str, Any]) -> Optional[dict[str, Any]]:
    if not request:
        return request
    pending_profile = coerce_json_object(policy.get("pendingProfile"))
    if not pending_profile:
        return request
    next_request = dict(request)
    for source, target in {
        "name": "institution_name",
        "description": "description",
        "phone": "phone",
        "city": "city",
        "state": "state",
        "country": "country",
        "website": "website",
        "domain": "domain",
    }.items():
        if source in pending_profile and pending_profile[source] is not None:
            next_request[target] = pending_profile[source]
    return next_request


def log_institution_activity(user: CurrentUser, institution_id: Optional[str], action: str, details: dict[str, Any]) -> None:
    safe_post(
        "audit_logs",
        {
            "action": action,
            "target_type": "institution",
            "target_id": institution_id or user.id,
            "details": details,
            "created_at": now_iso(),
        },
    )


def institution_counts(institution_id: Optional[str]) -> dict[str, int]:
    if not institution_id:
        return {"posts": 0, "groups": 0, "members": 0, "reports": 0}
    groups = safe_get("groups", {"institution_id": f"eq.{institution_id}", "deleted_at": "is.null", "select": "id"})
    group_ids = [row["id"] for row in groups]
    posts = safe_get("posts", {"institution_id": f"eq.{institution_id}", "select": "id"})
    members = safe_get(
        "group_members",
        {"group_id": f"in.({','.join(group_ids)})", "status": "eq.active", "select": "user_id"} if group_ids else {"group_id": "eq.__none__", "select": "user_id"},
    )
    return {"posts": len(posts), "groups": len(groups), "members": len(members), "reports": 0}


@app.get("/v1/institutions/me/settings")
def institution_settings_summary(user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    scope = institution_scope_for_settings(user)
    institution = scope["institution"]
    request = scope["request"]
    institution_id = scope["institution_id"]
    policy = merged_institution_policy(institution, request)
    if scope["pending"]:
        policy = apply_latest_pending_settings_snapshot(user.id, policy)
        request = apply_pending_profile_snapshot(request, policy)
    counts = institution_counts(institution_id)

    activity = safe_get(
        "audit_logs",
        {
            "target_type": "eq.institution",
            "target_id": f"eq.{institution_id or user.id}",
            "select": "id,action,details,created_at",
            "order": "created_at.desc",
            "limit": "20",
        },
    )

    related_ids: list[str] = []
    if institution_id:
        groups = safe_get("groups", {"institution_id": f"eq.{institution_id}", "select": "id"})
        posts = safe_get("posts", {"institution_id": f"eq.{institution_id}", "select": "id"})
        related_ids = [row["id"] for row in groups + posts] + [institution_id]
    reports = safe_get(
        "reports",
        {"target_id": f"in.({','.join(related_ids)})", "select": "*", "order": "created_at.desc", "limit": "20"} if related_ids else {"id": "eq.__none__", "select": "*"},
    )
    counts["reports"] = len([row for row in reports if row.get("status") == "pending"])

    banned_users = safe_get(
        "users",
        {"status": "eq.banned", "select": "id,name,avatar_url,city,course,status", "limit": "20"},
    )

    billing = policy.get("billing") or {}
    plan = billing.get("plan") or "free"
    return {
        "institution": institution,
        "request": request,
        "pendingVerification": scope["pending"],
        "policy": policy,
        "counts": counts,
        "activity": activity,
        "reports": reports,
        "bannedUsers": [serialize_user(row) for row in banned_users],
        "billing": {
            "plan": plan,
            "status": "Free tier" if plan == "free" else "Upgrade requested",
            "paymentContactEmail": billing.get("paymentContactEmail") or "",
            "invoiceName": billing.get("invoiceName") or "",
            "invoices": billing.get("invoices") or [],
        },
    }


@app.patch("/v1/institutions/me/settings")
def update_institution_settings(payload: InstitutionSettingsPatchDto, user: CurrentUser = Depends(current_user)) -> Any:
    scope = institution_scope_for_settings(user)
    institution = scope["institution"]
    request = scope["request"]
    institution_id = scope["institution_id"]

    profile_snapshot: dict[str, Any] = {}
    if payload.profile:
        profile_snapshot = {key: value for key, value in payload.profile.items() if value is not None}
        profile_payload = InstitutionUpdateDto(**payload.profile)
        update_institution(profile_payload, user)

    next_policy = merged_institution_policy(institution, request)
    if scope["pending"]:
        next_policy = apply_latest_pending_settings_snapshot(user.id, next_policy)
        if profile_snapshot:
            next_policy["pendingProfile"] = {**(next_policy.get("pendingProfile") or {}), **profile_snapshot}
    if payload.policy:
        for key, value in payload.policy.items():
            if isinstance(value, dict) and isinstance(next_policy.get(key), dict):
                next_policy[key] = {**next_policy[key], **value}
            else:
                next_policy[key] = value

    if payload.action == "pause":
        next_policy["publicPage"] = False
        next_policy["danger"] = {**(next_policy.get("danger") or {}), "pausedAt": now_iso(), "pausedBy": user.id}
    elif payload.action == "resume":
        next_policy["publicPage"] = True
        danger = dict(next_policy.get("danger") or {})
        danger.pop("pausedAt", None)
        next_policy["danger"] = danger
    elif payload.action == "request_delete":
        next_policy["danger"] = {**(next_policy.get("danger") or {}), "deletionRequestedAt": now_iso(), "deletionRequestedBy": user.id}

    if institution_id:
        updated = db.patch("institutions", {"id": f"eq.{institution_id}"}, {"verification_policy": next_policy})[0]
        log_institution_activity(user, institution_id, payload.action or "settings_updated", {"policyKeys": list((payload.policy or {}).keys())})
        return {"success": True, "institution": updated, "policy": next_policy}

    log_institution_activity(user, None, "pending_settings_updated", {"policyKeys": list((payload.policy or {}).keys()), "policy": next_policy, "action": payload.action})
    return {"success": True, "pendingVerification": True, "policy": next_policy}


@app.get("/v1/institutions/me/export")
def export_institution_data(user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    scope = institution_scope_for_settings(user)
    institution_id = scope["institution_id"]
    institution = scope["institution"]
    request = scope["request"]
    groups = safe_get("groups", {"institution_id": f"eq.{institution_id}", "select": "*"} if institution_id else {"id": "eq.__none__", "select": "*"})
    posts = safe_get("posts", {"institution_id": f"eq.{institution_id}", "select": "*"} if institution_id else {"id": "eq.__none__", "select": "*"})
    admins = safe_get("institution_admins", {"institution_id": f"eq.{institution_id}", "select": "*"} if institution_id else {"id": "eq.__none__", "select": "*"})
    policy = merged_institution_policy(institution, request)
    if scope["pending"]:
        policy = apply_latest_pending_settings_snapshot(user.id, policy)
        request = apply_pending_profile_snapshot(request, policy)
    log_institution_activity(user, institution_id, "data_exported", {"groups": len(groups), "posts": len(posts)})
    return {
        "exportedAt": now_iso(),
        "institution": institution,
        "pendingRequest": request,
        "policy": policy,
        "groups": groups,
        "posts": posts,
        "admins": admins,
    }


class GroupPostRequestDto(BaseModel):
    title: str
    description: str
    category: str
    posterUrl: Optional[str] = None
    requestedPublishAt: Optional[str] = None
    expiresAt: Optional[str] = None
    contactName: str
    contactEmail: Optional[str] = None
    contactPhone: Optional[str] = None


@app.post("/v1/groups/{group_id}/post-requests")
def submit_group_post_request(
    group_id: str,
    payload: GroupPostRequestDto,
    user: CurrentUser = Depends(current_user),
) -> Any:
    return db.post(
        "group_post_requests",
        {
            "id": str(uuid.uuid4()),
            "group_id": group_id,
            "requester_id": user.id,
            "title": payload.title,
            "description": payload.description,
            "category": payload.category,
            "poster_url": payload.posterUrl,
            "requested_publish_at": payload.requestedPublishAt,
            "expires_at": payload.expiresAt,
            "contact_name": payload.contactName,
            "contact_email": payload.contactEmail,
            "contact_phone": payload.contactPhone,
            "status": "pending",
        },
    )[0]


@app.get("/v1/groups/{group_id}/post-requests")
def list_group_post_requests(group_id: str, user: CurrentUser = Depends(current_user)) -> Any:
    require_group_admin(group_id, user)
    return db.get(
        "group_post_requests",
        {
            "group_id": f"eq.{group_id}",
            "select": "*",
            "order": "created_at.desc",
        },
    )


@app.post("/v1/groups/{group_id}/post-requests/{request_id}/approve")
def approve_group_post_request(group_id: str, request_id: str, user: CurrentUser = Depends(current_user)) -> Any:
    require_group_admin(group_id, user)
    
    # 1. Fetch the request
    req = db.get("group_post_requests", {"id": f"eq.{request_id}", "group_id": f"eq.{group_id}"})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    req = req[0]
    
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request is already processed")
        
    # 2. Auto-Publish to the group
    new_post = db.post("posts", {
        "author_id": req["requester_id"],
        "institution_id": req.get("institution_id"),
        "group_id": group_id,
        "type": "standard",
        "visibility": "public",
        "status": "published",
        "title": req["title"],
        "content": req["description"],
        "media_url": req["poster_url"],
        "published_at": now_iso()
    })[0]
    
    # 3. Update Request Status
    updated_req = db.patch(
        "group_post_requests",
        {"id": f"eq.{request_id}"},
        {
            "status": "approved",
            "decided_by": user.id,
            "decided_at": now_iso(),
            "published_post_id": new_post["id"]
        }
    )[0]
    
    # 4. Notify Requester
    db.post("notifications", {
        "user_id": req["requester_id"],
        "title": "Post Request Approved",
        "body": f"Your request to post in the group has been approved and published!",
        "type": "post_request_approved",
        "data": {"group_id": group_id, "post_id": new_post["id"]}
    })
    
    return updated_req


class RejectRequestDto(BaseModel):
    reason: Optional[str] = None


@app.post("/v1/groups/{group_id}/post-requests/{request_id}/reject")
def reject_group_post_request(group_id: str, request_id: str, payload: RejectRequestDto = RejectRequestDto(), user: CurrentUser = Depends(current_user)) -> Any:
    require_group_admin(group_id, user)
    rows = db.get("group_post_requests", {"id": f"eq.{request_id}", "group_id": f"eq.{group_id}", "select": "*", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Request not found")
    request_row = rows[0]
    if request_row.get("status") not in {"pending", "needs_changes"}:
        raise HTTPException(status_code=400, detail="Request is already processed")
    updated = db.patch(
        "group_post_requests",
        {"id": f"eq.{request_id}"},
        {"status": "rejected", "decided_by": user.id, "decided_at": now_iso(), "rejection_reason": payload.reason},
    )[0]
    safe_post("notifications", {
        "user_id": request_row.get("requester_id"),
        "title": "Post Request Rejected",
        "body": "Your group post request was not approved.",
        "type": "post_request_rejected",
        "data": {"group_id": group_id, "request_id": request_id, "reason": payload.reason},
        "created_at": now_iso(),
    })
    return updated


class NotificationPreferencesDto(BaseModel):
    pushEnabled: Optional[bool] = None
    emailEnabled: Optional[bool] = None
    mentions: Optional[bool] = None
    announcements: Optional[bool] = None
    joinRequests: Optional[bool] = None
    postActivity: Optional[bool] = None


class DeviceRegistrationDto(BaseModel):
    pushToken: str = Field(min_length=8)
    platform: Optional[str] = None


def serialize_notification_preferences(row: dict[str, Any], user_id: str) -> dict[str, Any]:
    return {
        "userId": row.get("user_id", user_id),
        "pushEnabled": row.get("push_enabled", True),
        "emailEnabled": row.get("email_enabled", False),
        "mentions": row.get("mentions", True),
        "announcements": row.get("announcements", True),
        "joinRequests": row.get("join_requests", True),
        "postActivity": row.get("post_activity", True),
    }


def serialize_notification(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("id"),
        "type": row.get("type") or "notification",
        "title": row.get("title") or "",
        "body": row.get("body") or "",
        "data": row.get("data") or {},
        "read": bool(row.get("read") or row.get("read_at")),
        "createdAt": row.get("created_at"),
    }




@app.get("/v1/users/me/notification-preferences")
def get_notification_preferences(user: CurrentUser = Depends(current_user)) -> Any:
    rows = safe_get("notification_preferences", {"user_id": f"eq.{user.id}", "select": "*"})
    return serialize_notification_preferences(rows[0], user.id) if rows else serialize_notification_preferences({}, user.id)


@app.patch("/v1/users/me/notification-preferences")
def update_notification_preferences(payload: NotificationPreferencesDto, user: CurrentUser = Depends(current_user)) -> Any:
    existing = safe_get("notification_preferences", {"user_id": f"eq.{user.id}", "select": "user_id"})
    data = {}
    mapping = {
        "pushEnabled": "push_enabled",
        "emailEnabled": "email_enabled",
        "mentions": "mentions",
        "announcements": "announcements",
        "joinRequests": "join_requests",
        "postActivity": "post_activity",
    }
    for source, target in mapping.items():
        value = getattr(payload, source)
        if value is not None:
            data[target] = value
    data["updated_at"] = now_iso()
    row = db.patch("notification_preferences", {"user_id": f"eq.{user.id}"}, data)[0] if existing else db.post("notification_preferences", {"user_id": user.id, **data})[0]
    return serialize_notification_preferences(row, user.id)


@app.patch("/v1/notifications/preferences")
def update_notification_preferences_alias(payload: NotificationPreferencesDto, user: CurrentUser = Depends(current_user)) -> Any:
    return update_notification_preferences(payload, user)


@app.get("/v1/notifications")
def list_notifications(user: CurrentUser = Depends(current_user)) -> list[dict[str, Any]]:
    rows = safe_get(
        "notifications",
        {
            "user_id": f"eq.{user.id}",
            "select": "id,user_id,type,title,body,data,read,read_at,created_at",
            "order": "created_at.desc",
            "limit": "100",
        },
    )
    return [serialize_notification(row) for row in rows]


@app.get("/v1/notifications/unread")
def notification_unread_count(user: CurrentUser = Depends(current_user)) -> dict[str, int]:
    rows = safe_get(
        "notifications",
        {
            "user_id": f"eq.{user.id}",
            "read": "eq.false",
            "select": "id",
            "limit": "1000",
        },
    )
    return {"unread": len(rows)}


@app.patch("/v1/notifications/read-all")
def mark_all_notifications_read(user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    rows = safe_get("notifications", {"user_id": f"eq.{user.id}", "read": "eq.false", "select": "id"})
    if rows:
        db.patch(
            "notifications",
            {"user_id": f"eq.{user.id}", "read": "eq.false"},
            {"read": True, "read_at": now_iso()},
        )
    return {"updated": len(rows)}


@app.patch("/v1/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    updated = db.patch(
        "notifications",
        {"id": f"eq.{notification_id}", "user_id": f"eq.{user.id}"},
        {"read": True, "read_at": now_iso()},
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Notification not found")
    return serialize_notification(updated[0])


@app.delete("/v1/notifications/{notification_id}")
def delete_notification(notification_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    deleted = db.delete("notifications", {"id": f"eq.{notification_id}", "user_id": f"eq.{user.id}"})
    if not deleted:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"deleted": True}


@app.post("/v1/notifications/register-device")
def register_notification_device(payload: DeviceRegistrationDto, user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    existing = safe_get(
        "user_devices",
        {"push_token": f"eq.{payload.pushToken}", "select": "id", "limit": "1"},
    )
    data = {
        "user_id": user.id,
        "push_token": payload.pushToken,
        "platform": payload.platform or "unknown",
        "trusted": True,
        "last_seen_at": now_iso(),
    }
    if existing:
        row = db.patch("user_devices", {"id": f"eq.{existing[0]['id']}"}, data)[0]
    else:
        row = db.post("user_devices", {"id": str(uuid.uuid4()), **data, "created_at": now_iso()})[0]
    return {"registered": True, "deviceId": row.get("id")}


@app.get("/v1/search")
def search(q: str = Query(default="", max_length=80), user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    query = q.strip()
    if len(query) < 2:
        return {"groups": [], "users": [], "posts": []}
    groups = safe_get(
        "groups",
        {
            "deleted_at": "is.null",
            "visibility": "eq.public",
            "name": f"ilike.*{query}*",
            "select": "id,name,description,city,category,visibility,join_policy,avatar_url,official,posting_mode",
            "limit": "20",
        },
    )
    users_rows = safe_get("users", {"name": f"ilike.*{query}*", "select": "id,name,city,course,avatar_url,cover_url,verified,account_type", "limit": "20"})
    posts = safe_get(
        "posts",
        {
            "status": "eq.published",
            "content": f"ilike.*{query}*",
            "select": "id,title,content,media_url,created_at,published_at,author_id",
            "limit": "20",
        },
    )
    return {
        "groups": [serialize_group({**row, "member_count": group_member_count(row["id"])}) for row in groups],
        "users": [serialize_user(row) for row in users_rows],
        "posts": [
            {
                "id": row["id"],
        "email": row.get("email"),
                "title": row.get("title"),
                "content": row.get("content"),
                "mediaUrl": row.get("media_url"),
                "postType": row.get("type"),
                "createdAt": row.get("published_at") or row.get("created_at"),
                "author": {"id": row.get("author_id")},
            }
            for row in posts
        ],
    }


class ReportDto(BaseModel):
    targetType: str
    targetId: str
    reason: str
    details: Optional[str] = None


def create_report_record(target_type: str, target_id: str, reason: str, details: Optional[str], user: CurrentUser) -> dict[str, bool]:
    db.post("reports", {
        "id": str(uuid.uuid4()),
        "reported_by": user.id,
        "target_type": target_type,
        "target_id": target_id,
        "reason": reason,
        "details": details,
        "status": "pending",
        "created_at": now_iso()
    })
    return {"success": True}


@app.post("/v1/reports")
def create_report(payload: ReportDto, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    return create_report_record(payload.targetType, payload.targetId, payload.reason, payload.details, user)


class ReportTargetDto(BaseModel):
    reason: str
    details: Optional[str] = None


@app.post("/v1/reports/post/{post_id}")
def report_post(post_id: str, payload: ReportTargetDto, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    return create_report_record("post", post_id, payload.reason, payload.details, user)


@app.post("/v1/reports/group/{group_id}")
def report_group(group_id: str, payload: ReportTargetDto, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    return create_report_record("group", group_id, payload.reason, payload.details, user)


@app.post("/v1/reports/user/{user_id}")
def report_user(user_id: str, payload: ReportTargetDto, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    return create_report_record("user", user_id, payload.reason, payload.details, user)


@app.post("/v1/reports/message/{message_id}")
def report_message(message_id: str, payload: ReportTargetDto, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    return create_report_record("message", message_id, payload.reason, payload.details, user)


@app.post("/v1/reports/comment/{comment_id}")
def report_comment(comment_id: str, payload: ReportTargetDto, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    return create_report_record("comment", comment_id, payload.reason, payload.details, user)


@app.get("/v1/search/groups")
def search_groups(q: str = Query(default="", max_length=80), user: CurrentUser = Depends(current_user)) -> list[dict]:
    query = q.strip()
    if len(query) < 2: return []
    groups = safe_get(
        "groups",
        {
            "deleted_at": "is.null",
            "visibility": "eq.public",
            "name": f"ilike.*{query}*",
            "select": "id,name,description,city,category,visibility,join_policy,avatar_url,official,posting_mode",
            "limit": "20",
        },
    )
    return [serialize_group({**row, "member_count": group_member_count(row["id"])}) for row in groups]


@app.get("/v1/search/users")
def search_users(q: str = Query(default="", max_length=80), user: CurrentUser = Depends(current_user)) -> list[dict]:
    query = q.strip()
    if len(query) < 2: return []
    users_rows = safe_get("users", {"name": f"ilike.*{query}*", "select": "id,name,city,course,avatar_url,cover_url,verified,account_type", "limit": "20"})
    return [serialize_user(row) for row in users_rows]


@app.get("/v1/search/posts")
def search_posts(q: str = Query(default="", max_length=80), user: CurrentUser = Depends(current_user)) -> list[dict]:
    query = q.strip()
    if len(query) < 2: return []
    posts_rows = safe_get(
        "posts",
        {
            "status": "eq.published",
            "content": f"ilike.*{query}*",
            "select": "id,title,content,media_url,type,created_at,published_at,author_id",
            "limit": "20",
        },
    )
    return [
        {
            "id": row["id"],
        "email": row.get("email"),
            "title": row.get("title"),
            "content": row.get("content"),
            "mediaUrl": row.get("media_url"),
            "postType": row.get("type"),
            "createdAt": row.get("published_at") or row.get("created_at"),
            "author": {"id": row.get("author_id")},
        }
        for row in posts_rows
    ]
# ─────────────────────────────────────────────
# FILE / MEDIA UPLOAD  →  Supabase Storage
# ─────────────────────────────────────────────
# Uses existing buckets: 'avatars' and 'group-media'
SUPABASE_AVATAR_BUCKET = os.getenv("SUPABASE_AVATAR_BUCKET", "avatars")
SUPABASE_MEDIA_BUCKET  = os.getenv("SUPABASE_MEDIA_BUCKET", "group-media")

ALLOWED_IMAGE_TYPES  = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_VIDEO_TYPES  = {"video/mp4", "video/quicktime", "video/webm"}
ALLOWED_DOC_TYPES    = {"application/pdf"}
ALLOWED_MEDIA_TYPES  = ALLOWED_IMAGE_TYPES | ALLOWED_VIDEO_TYPES | ALLOWED_DOC_TYPES

MAX_IMAGE_SIZE_MB = int(os.getenv("MAX_IMAGE_SIZE_MB", "10"))
MAX_VIDEO_SIZE_MB = int(os.getenv("MAX_VIDEO_SIZE_MB", "100"))
MAX_DOC_SIZE_MB   = int(os.getenv("MAX_DOC_SIZE_MB",   "20"))


def _max_bytes(content_type: str) -> int:
    if content_type in ALLOWED_VIDEO_TYPES:
        return MAX_VIDEO_SIZE_MB * 1024 * 1024
    if content_type in ALLOWED_DOC_TYPES:
        return MAX_DOC_SIZE_MB * 1024 * 1024
    return MAX_IMAGE_SIZE_MB * 1024 * 1024


def _storage_upload(file_bytes: bytes, storage_path: str, content_type: str, bucket: str) -> str:
    """Upload bytes to Supabase Storage and return the public URL."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=503, detail="Supabase storage is not configured.")

    upload_url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{storage_path}"
    headers = {
        "apikey":        SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type":  content_type,
        "x-upsert":      "true",
    }
    resp = requests.post(upload_url, headers=headers, data=file_bytes, timeout=60)
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Storage upload failed: {resp.text}")
    return f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{storage_path}"


# ── 1. Avatar upload ────────────────────────────────────────────
@app.post("/v1/upload/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    user: CurrentUser = Depends(current_user),
) -> dict[str, str]:
    """
    Upload a profile avatar.
    Saves to Supabase Storage → updates users.avatar_url → returns url.
    """
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Only images allowed. Got: {file.content_type}")

    file_bytes = await file.read()
    if len(file_bytes) > _max_bytes(file.content_type):
        raise HTTPException(status_code=400, detail=f"File too large. Max {MAX_IMAGE_SIZE_MB} MB.")

    ext           = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
    storage_path  = f"avatars/{user.id}.{ext}"
    public_url    = _storage_upload(file_bytes, storage_path, file.content_type, SUPABASE_AVATAR_BUCKET)

    # Persist URL in user profile
    db.patch("users", {"id": f"eq.{user.id}"}, {"avatar_url": public_url, "updated_at": now_iso()})

    return {"url": public_url, "type": "avatar"}


# ── 2. Post / announcement media upload ─────────────────────────
@app.post("/v1/upload/post-media")
async def upload_post_media(
    file: UploadFile = File(...),
    user: CurrentUser = Depends(current_user),
) -> dict[str, str]:
    """
    Upload an image, video or PDF to attach to a post.
    Returns the public URL to pass as mediaUrl when creating the post.
    """
    if file.content_type not in ALLOWED_MEDIA_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    file_bytes = await file.read()
    if len(file_bytes) > _max_bytes(file.content_type):
        limit_mb = MAX_VIDEO_SIZE_MB if file.content_type in ALLOWED_VIDEO_TYPES else MAX_IMAGE_SIZE_MB
        raise HTTPException(status_code=400, detail=f"File too large. Max {limit_mb} MB.")

    ext          = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    unique_name  = f"{uuid.uuid4()}.{ext}"
    storage_path = f"posts/{user.id}/{unique_name}"
    public_url   = _storage_upload(file_bytes, storage_path, file.content_type, SUPABASE_MEDIA_BUCKET)

    media_type = (
        "image" if file.content_type in ALLOWED_IMAGE_TYPES else
        "video" if file.content_type in ALLOWED_VIDEO_TYPES else
        "document"
    )
    return {"url": public_url, "mediaType": media_type}


# ── 3. Group avatar upload ───────────────────────────────────────
@app.post("/v1/upload/group-avatar/{group_id}")
async def upload_group_avatar(
    group_id: str,
    file: UploadFile = File(...),
    user: CurrentUser = Depends(current_user),
) -> dict[str, str]:
    """Upload a group avatar. Only group admin/owner can do this."""
    require_group_admin(group_id, user)

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Only images allowed. Got: {file.content_type}")

    file_bytes = await file.read()
    if len(file_bytes) > _max_bytes(file.content_type):
        raise HTTPException(status_code=400, detail=f"File too large. Max {MAX_IMAGE_SIZE_MB} MB.")

    ext          = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
    storage_path = f"groups/{group_id}/avatar.{ext}"
    public_url   = _storage_upload(file_bytes, storage_path, file.content_type, SUPABASE_AVATAR_BUCKET)

    db.patch("groups", {"id": f"eq.{group_id}"}, {"avatar_url": public_url, "updated_at": now_iso()})

    return {"url": public_url, "type": "group_avatar"}


# ── 4. Group chat message media ──────────────────────────────────
@app.post("/v1/upload/message-media/{group_id}")
async def upload_message_media(
    group_id: str,
    file: UploadFile = File(...),
    user: CurrentUser = Depends(current_user),
) -> dict[str, str]:
    """Upload media to attach to a group chat message."""
    require_group_member(group_id, user)

    if file.content_type not in ALLOWED_MEDIA_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    file_bytes = await file.read()
    if len(file_bytes) > _max_bytes(file.content_type):
        limit_mb = MAX_VIDEO_SIZE_MB if file.content_type in ALLOWED_VIDEO_TYPES else MAX_IMAGE_SIZE_MB
        raise HTTPException(status_code=400, detail=f"File too large. Max {limit_mb} MB.")

    ext          = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    unique_name  = f"{uuid.uuid4()}.{ext}"
    storage_path = f"messages/{group_id}/{unique_name}"
    public_url   = _storage_upload(file_bytes, storage_path, file.content_type, SUPABASE_MEDIA_BUCKET)

    media_type = (
        "image" if file.content_type in ALLOWED_IMAGE_TYPES else
        "video" if file.content_type in ALLOWED_VIDEO_TYPES else
        "document"
    )
    return {"url": public_url, "mediaType": media_type}


# ── 5. Institution logo upload ──────────────────────────────────
@app.post("/v1/upload/institution-logo")
async def upload_institution_logo(
    file: UploadFile = File(...),
    user: Optional[CurrentUser] = Depends(optional_user),
) -> dict[str, str]:
    """Upload institution logo (PNG/SVG). Allows unauthenticated."""
    allowed = {"image/png", "image/svg+xml", "image/jpeg", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Only PNG/SVG/JPEG/WEBP allowed. Got: {file.content_type}")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File too large. Max {MAX_IMAGE_SIZE_MB} MB.")

    ext          = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "png"
    unique_name  = f"{uuid.uuid4()}.{ext}"
    storage_path = f"institution-logos/public/{unique_name}"
    public_url   = _storage_upload(file_bytes, storage_path, file.content_type, SUPABASE_MEDIA_BUCKET)

    return {"url": public_url, "type": "institution_logo"}


# ── 6. Institution cover/background upload ──────────────────────
@app.post("/v1/upload/institution-cover")
async def upload_institution_cover(
    file: UploadFile = File(...),
    user: CurrentUser = Depends(current_user),
) -> dict[str, str]:
    """Upload institution cover/background image."""
    allowed = {"image/png", "image/jpeg", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Only PNG/JPEG/WEBP allowed. Got: {file.content_type}")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File too large. Max {MAX_IMAGE_SIZE_MB} MB.")

    ext          = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
    unique_name  = f"{uuid.uuid4()}.{ext}"
    storage_path = f"institution-covers/{user.id}/{unique_name}"
    public_url   = _storage_upload(file_bytes, storage_path, file.content_type, SUPABASE_MEDIA_BUCKET)

    return {"url": public_url, "type": "institution_cover"}


# ── 7. Institution document upload ──────────────────────────────
@app.post("/v1/upload/institution-doc")
async def upload_institution_doc(
    file: UploadFile = File(...),
    user: Optional[CurrentUser] = Depends(optional_user),
) -> dict[str, str]:
    """Upload a verification document for institution registration. Allows unauthenticated."""
    allowed = ALLOWED_IMAGE_TYPES | ALLOWED_DOC_TYPES
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Only images/PDFs allowed. Got: {file.content_type}")

    file_bytes = await file.read()
    if len(file_bytes) > _max_bytes(file.content_type):
        raise HTTPException(status_code=400, detail=f"File too large. Max {MAX_DOC_SIZE_MB} MB.")

    ext          = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "pdf"
    unique_name  = f"{uuid.uuid4()}.{ext}"
    storage_path = f"institution-docs/public/{unique_name}"
    public_url   = _storage_upload(file_bytes, storage_path, file.content_type, SUPABASE_MEDIA_BUCKET)

    return {"url": public_url, "type": "institution_document"}


# -- POST REQUESTS (INSTITUTION LEVEL & MY REQUESTS) ---------

@app.get("/v1/users/me/post-requests")
def get_my_post_requests(user: CurrentUser = Depends(current_user)) -> Any:
    """Fetch all post requests sent by the current user."""
    return db.get("group_post_requests", {"requester_id": f"eq.{user.id}"})

class InstitutionPostRequestDto(BaseModel):
    title: str = Field(..., max_length=100)
    description: str = Field(..., max_length=2000)
    category: Optional[str] = None
    poster_url: Optional[str] = None

@app.post("/v1/institutions/{institution_id}/post-requests")
def create_institution_post_request(
    institution_id: str,
    payload: InstitutionPostRequestDto,
    user: CurrentUser = Depends(current_user),
) -> Any:
    """Create a post request for an institution."""
    policy = get_institution_policy_by_id(institution_id)
    requester_admin = current_institution_admin(user)
    is_admin_requester = user.role == "platform_admin" or bool(requester_admin and requester_admin.get("institution_id") == institution_id)
    if not policy.get("allowExternalRequests", True) and not is_admin_requester:
        raise HTTPException(status_code=403, detail="External post requests are disabled for this institution")
    return db.post(
        "group_post_requests",
        {
            "institution_id": institution_id,
            "requester_id": user.id,
            "title": payload.title,
            "description": payload.description,
            "category": payload.category,
            "poster_url": payload.poster_url,
            "status": "pending",
            "created_at": now_iso(),
            "updated_at": now_iso(),
        },
    )[0]

@app.get("/v1/institutions/{institution_id}/post-requests")
def get_institution_post_requests(
    institution_id: str, user: CurrentUser = Depends(current_user)
) -> Any:
    """Get all post requests for an institution (Admin only)."""
    require_institution_admin_for(institution_id, user)
    return db.get("group_post_requests", {"institution_id": f"eq.{institution_id}"})

class ApproveInstitutionRequestDto(BaseModel):
    target_group_id: str

@app.post("/v1/institutions/{institution_id}/post-requests/{request_id}/approve")
def approve_institution_post_request(
    institution_id: str,
    request_id: str,
    payload: ApproveInstitutionRequestDto,
    user: CurrentUser = Depends(current_user),
) -> Any:
    require_institution_admin_for(institution_id, user)
    
    req = db.get("group_post_requests", {"id": f"eq.{request_id}", "institution_id": f"eq.{institution_id}"})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    req = req[0]
    
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request is already processed")
        
    # Auto-Publish to the targeted group
    new_post = db.post("posts", {
        "author_id": req["requester_id"],
        "institution_id": institution_id,
        "group_id": payload.target_group_id,
        "type": "standard",
        "visibility": "public",
        "status": "published",
        "title": req["title"],
        "content": req["description"],
        "media_url": req["poster_url"],
        "published_at": now_iso()
    })[0]
    
    updated_req = db.patch(
        "group_post_requests",
        {"id": f"eq.{request_id}"},
        {
            "status": "approved",
            "group_id": payload.target_group_id,
            "decided_by": user.id,
            "decided_at": now_iso(),
            "published_post_id": new_post["id"]
        }
    )[0]
    
    db.post("notifications", {
        "user_id": req["requester_id"],
        "title": "Post Request Approved",
        "body": "Your request to share a post has been approved and published!",
        "type": "post_request_approved",
        "data": {"group_id": payload.target_group_id, "post_id": new_post["id"]}
    })
    
    return updated_req

@app.post("/v1/institutions/{institution_id}/post-requests/{request_id}/reject")
def reject_institution_post_request(
    institution_id: str,
    request_id: str,
    payload: RejectRequestDto,
    user: CurrentUser = Depends(current_user),
) -> Any:
    require_institution_admin_for(institution_id, user)
    req = db.patch(
        "group_post_requests",
        {"id": f"eq.{request_id}", "institution_id": f"eq.{institution_id}"},
        {
            "status": "rejected",
            "decision_note": payload.reason,
            "decided_by": user.id,
            "decided_at": now_iso(),
        },
    )[0]
    
    db.post("notifications", {
        "user_id": req["requester_id"],
        "title": "Post Request Rejected",
        "body": "Your request to share a post was declined.",
        "type": "post_request_rejected"
    })
    
    return req

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
