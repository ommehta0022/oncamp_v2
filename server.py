from datetime import datetime, timedelta, timezone
import base64
import hashlib
import json
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path
import uuid
from typing import Any, Optional

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
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
    allow_origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    print(f"✅ Twilio OTP service loaded successfully")
    print(f"✅ Twilio configured: {twilio_otp.enabled if twilio_otp else False}")
except ImportError as e:
    print(f"❌ CRITICAL: Twilio package not installed: {e}")
    print(f"❌ Install with: pip install twilio>=9.0.0")
except Exception as e:
    print(f"❌ CRITICAL: Twilio service initialization failed: {e}")
    print(f"❌ Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER")

# Include admin routes (AFTER db is initialized)
try:
    import admin_routes_simple as admin_routes_module
    admin_routes_module.set_db_client(db)  # Inject db dependency
    app.include_router(admin_routes_module.router)
    print("✅ Admin routes loaded successfully")
except ImportError as e:
    print(f"⚠️  Admin routes not loaded: {e}")
except Exception as e:
    print(f"⚠️  Admin routes error: {e}")


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
    allowed = {"/v1/health", "/v1/platform/settings", "/v1/integrations/health"}
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


def serialize_user(row: dict[str, Any]) -> dict[str, Any]:
    account_type = row.get("account_type") or "normal_user"
    return {
        "id": row["id"],
        "name": row.get("name"),
        "city": row.get("city"),
        "course": row.get("course"),
        "bio": row.get("bio"),
        "handle": row.get("handle"),
        "avatarUrl": row.get("avatar_url"),
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
        "unread": row.get("unread", 0),
        "lastMessage": row.get("last_message"),
        "lastMessageAt": row.get("last_message_at"),
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


def require_institution_admin(user: CurrentUser) -> dict[str, Any]:
    admin = current_institution_admin(user)
    if admin:
        return admin
    if user.role == "platform_admin":
        return {"institution_id": None, "role": "platform_admin"}
    raise HTTPException(status_code=403, detail="Institution admin access required")


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
    if _dev:
        _provider = "dev_mode"
    elif _twilio_ok:
        _provider = "twilio"
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


class VerifyOtpDevDto(BaseModel):
    phone: str
    code: str
    platform: Optional[str] = None


@app.post("/v1/auth/otp/start")
def start_otp(payload: StartOtpDevDto) -> dict[str, Any]:
    """Start OTP authentication - Sends real SMS via Twilio or uses dev mode."""
    phone = payload.phone.strip()

    if not phone or len(phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")

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
        print(f"⚠️  Failed to store OTP challenge: {e}")
        # Continue anyway - OTP was sent
    
    return {
        "success": True,
        "challengeId": challenge_id,
        "expiresInSeconds": 300,
        "message": message,
        "devMode": False,
    }


@app.post("/v1/auth/otp/verify-dev")
@app.post("/v1/auth/otp/verify-code")
def verify_otp(payload: VerifyOtpDevDto, x_device_id: Optional[str] = Header(default=None)) -> dict[str, Any]:
    """Verify OTP code - Works with both dev mode and Twilio."""
    phone = payload.phone.strip()
    code = payload.code.strip()

    if not phone or len(phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")

    # Development mode - check against dev OTP
    if DEV_MODE:
        if code != DEV_OTP_CODE:
            raise HTTPException(status_code=400, detail=f"Invalid OTP code. Dev mode expects: {DEV_OTP_CODE}")
    else:
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
            print(f"⚠️  OTP verification error: {e}")
            raise HTTPException(status_code=500, detail="Failed to verify OTP. Please try again.")
    
    # Find or create user by phone hash
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


class VerifyOtpDto(BaseModel):
    firebaseIdToken: str
    platform: Optional[str] = None


@app.post("/v1/auth/otp/verify")
def verify_otp(payload: VerifyOtpDto, x_device_id: Optional[str] = Header(default=None)) -> dict[str, Any]:
    """Verify Firebase phone auth ID token and create/login user."""
    try:
        req = google_requests.Request()
        project_id = firebase_project_id()
        if not project_id:
            raise HTTPException(status_code=503, detail="Firebase project ID not configured on backend")

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


@app.post("/v1/auth/logout")
def logout(user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    return {"success": True}


@app.get("/v1/feed")
def feed(
    limit: int = Query(default=30, ge=1, le=100),
    user: CurrentUser = Depends(current_user),
) -> dict[str, Any]:
    posts = db.get(
        "posts",
        {
            "select": "id,title,content,media_url,media_type,type,status,pinned,created_at,published_at,author_id,group_id,institution_id",
            "status": "eq.published",
            "order": "pinned.desc,created_at.desc",
            "limit": str(limit),
        },
    )
    author_ids = sorted({post.get("author_id") for post in posts if post.get("author_id")})
    group_ids = sorted({post.get("group_id") for post in posts if post.get("group_id")})
    authors = {}
    groups_by_id = {}
    if author_ids:
        rows = safe_get("users", {"id": f"in.({','.join(author_ids)})", "select": "id,name,avatar_url,verified,account_type"})
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
        ]
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
        users_rows = safe_get("users", {"id": f"in.({','.join(comment_user_ids)})", "select": "id,name,avatar_url,verified"})
        comment_users = {row["id"]: row for row in users_rows}
    return {
        "id": post["id"],
        "title": post.get("title"),
        "content": post.get("content"),
        "mediaUrl": post.get("media_url"),
        "mediaType": post.get("media_type"),
        "pinned": post.get("pinned", False),
        "announcement": post.get("type") in {"announcement", "emergency", "notice"},
        "createdAt": post.get("published_at") or post.get("created_at"),
        "author": serialize_user(author_rows[0]) if author_rows else {"id": post.get("author_id"), "name": "OnCampus user"},
        "group": group_rows[0] if group_rows else None,
        "comments": [
            {
                "id": row["id"],
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


@app.get("/v1/groups")
def my_groups(user: CurrentUser = Depends(current_user)) -> Any:
    memberships = db.get("group_members", {"user_id": f"eq.{user.id}", "status": "eq.active", "select": "group_id,role"})
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
    role_by_group = {row["group_id"]: row["role"] for row in memberships}
    return [
        serialize_group({**group, "member_count": group_member_count(group["id"])}, role_by_group.get(group["id"]))
        for group in groups
    ]


@app.get("/v1/discovery/groups")
def discover_groups(
    q: Optional[str] = None,
    city: Optional[str] = None,
    category: Optional[str] = None,
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
        params["category"] = f"eq.{category}"
    if q:
        params["name"] = f"ilike.*{q}*"
    rows = db.get("groups", params)
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
        {"group_id": f"eq.{group_id}", "user_id": f"eq.{user.id}", "status": "eq.active", "select": "role"},
    )
    return {
        **group,
        "avatarUrl": group.get("avatar_url"),
        "joinPolicy": group.get("join_policy"),
        "postingMode": group.get("posting_mode"),
        "role": memberships[0]["role"] if memberships else None,
        "memberCount": group_member_count(group_id),
    }


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
def register_institution(payload: InstitutionRegistrationDto) -> Any:
    return db.post(
        "institution_verification_requests",
        {
            "id": str(uuid.uuid4()),
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
        },
    )[0]


@app.get("/v1/institutions/me/dashboard")
def institution_dashboard(user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    """Get institution dashboard data with error handling for null institution_id"""
    admin = require_institution_admin(user)
    institution_id = admin.get("institution_id")
    
    # Handle case where institution_id is None (pending verification)
    institution = None
    if institution_id:
        rows = safe_get("institutions", {"id": f"eq.{institution_id}", "select": "*"})
        institution = rows[0] if rows else None

    # Scope queries by institution_id if available
    scoped = {"institution_id": f"eq.{institution_id}"} if institution_id else {}
    
    # Fetch posts with error handling
    posts = safe_get("posts", {**scoped, "select": "id,status,type,created_at", "order": "created_at.desc", "limit": "20"}) or []
    
    # Fetch groups with error handling
    groups = safe_get("groups", {**scoped, "deleted_at": "is.null", "select": "id,name,city,category,visibility,official"}) or []
    
    # Fetch verification requests
    if institution_id:
        requests = safe_get(
            "institution_verification_requests",
            {"institution_id": f"eq.{institution_id}", "select": "id,status,created_at", "order": "created_at.desc", "limit": "20"}
        ) or []
    else:
        # For admins without institution_id, check if they have any pending verification requests
        requests = safe_get(
            "institution_verification_requests",
            {"official_email": f"eq.{user.email}" if hasattr(user, 'email') else None, "select": "id,status,created_at", "order": "created_at.desc", "limit": "20"}
        ) or [] if hasattr(user, 'email') else []
    
    return {
        "institution": institution,
        "role": admin.get("role", "platform_admin"),
        "counts": {
            "posts": len(posts),
            "groups": len(groups),
            "members": sum(group_member_count(group["id"]) for group in groups) if groups else 0,
            "verificationRequests": len(requests),
        },
        "recentPosts": posts,
        "groups": groups,
        "verificationRequests": requests,
        "pendingVerification": institution_id is None,  # Flag to show pending verification state
    }


@app.get("/v1/institutions/me/analytics")
def institution_analytics(user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    admin = require_institution_admin(user)
    institution_id = admin.get("institution_id")
    scoped = {"institution_id": f"eq.{institution_id}"} if institution_id else {}
    institution = None
    if institution_id:
        rows = safe_get("institutions", {"id": f"eq.{institution_id}", "select": "*"})
        institution = rows[0] if rows else None
    groups = safe_get("groups", {**scoped, "deleted_at": "is.null", "select": "id,name,category"})
    posts = safe_get("posts", {**scoped, "select": "id,title,content,created_at", "order": "created_at.desc", "limit": "50"})
    group_count_by_id = {group["id"]: group_member_count(group["id"]) for group in groups}
    post_metrics = []
    total_reactions = 0
    total_comments = 0
    total_views = 0
    for post in posts:
        reactions = len(safe_get("post_reactions", {"post_id": f"eq.{post['id']}", "select": "user_id"}))
        comments = len(safe_get("post_comments", {"post_id": f"eq.{post['id']}", "deleted_at": "is.null", "select": "id"}))
        views = len(safe_get("post_views", {"post_id": f"eq.{post['id']}", "select": "user_id"}))
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
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    description: Optional[str] = None
    logoUrl: Optional[str] = None
    coverUrl: Optional[str] = None
    verificationPolicy: Optional[dict[str, Any]] = None


@app.patch("/v1/institutions/me")
def update_institution(payload: InstitutionUpdateDto, user: CurrentUser = Depends(current_user)) -> Any:
    admin = require_institution_admin(user)
    institution_id = admin.get("institution_id")
    if not institution_id:
        raise HTTPException(status_code=400, detail="No institution scope available")
    data: dict[str, Any] = {}
    for source, target in {
        "name": "name",
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
    admin_rows = db.get(
        "institution_admins",
        {"user_id": f"eq.{user.id}", "status": "eq.active", "select": "institution_id,role"},
    )
    if not admin_rows and user.role != "platform_admin":
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
            "role": row.get("role"),
            "status": row.get("status"),
            "createdAt": row.get("created_at"),
            "user": serialize_user(users_by_id[row["user_id"]]) if row["user_id"] in users_by_id else {"id": row["user_id"], "name": "Admin"},
        }
        for row in rows
    ]


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
    return db.patch(
        "group_post_requests",
        {"id": f"eq.{request_id}", "group_id": f"eq.{group_id}"},
        {"status": "approved", "decided_by": user.id, "decided_at": now_iso()},
    )[0]


class RejectRequestDto(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


@app.post("/v1/groups/{group_id}/post-requests/{request_id}/reject")
def reject_group_post_request(
    group_id: str,
    request_id: str,
    payload: RejectRequestDto,
    user: CurrentUser = Depends(current_user),
) -> Any:
    require_group_admin(group_id, user)
    return db.patch(
        "group_post_requests",
        {"id": f"eq.{request_id}", "group_id": f"eq.{group_id}"},
        {
            "status": "rejected",
            "decision_note": payload.reason,
            "decided_by": user.id,
            "decided_at": now_iso(),
        },
    )[0]


class RegisterDeviceDto(BaseModel):
    pushToken: str
    platform: str = "unknown"


@app.post("/v1/notifications/register-device")
def register_push_device(
    payload: RegisterDeviceDto,
    user: CurrentUser = Depends(current_user),
    x_device_id: Optional[str] = Header(default=None),
) -> dict[str, bool]:
    device_id = x_device_id or str(uuid.uuid4())
    existing = db.get("user_devices", {"id": f"eq.{device_id}", "select": "id"})
    data = {
        "push_token": payload.pushToken,
        "platform": payload.platform,
        "trusted": True,
        "last_seen_at": now_iso(),
    }
    if existing:
        db.patch("user_devices", {"id": f"eq.{device_id}"}, data)
    else:
        db.post("user_devices", {"id": device_id, "user_id": user.id, **data})
    return {"success": True}


class UpdateProfileDto(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    course: Optional[str] = None
    bio: Optional[str] = None
    handle: Optional[str] = None
    avatarUrl: Optional[str] = None
    profileCompleted: Optional[bool] = None
    onboardingSkipped: Optional[dict[str, Any]] = None
    defaultAvatarKey: Optional[str] = None

@app.patch("/v1/auth/me")
@app.patch("/v1/users/me")
def update_profile(payload: UpdateProfileDto, user: CurrentUser = Depends(current_user)) -> Any:
    data = {}
    if payload.name is not None: data["name"] = payload.name
    if payload.city is not None: data["city"] = payload.city
    if payload.course is not None: data["course"] = payload.course
    if payload.bio is not None: data["bio"] = payload.bio
    if payload.handle is not None: data["handle"] = payload.handle
    if payload.avatarUrl is not None: data["avatar_url"] = payload.avatarUrl
    if payload.onboardingSkipped is not None: data["onboarding_skipped"] = payload.onboardingSkipped
    if payload.defaultAvatarKey is not None: data["default_avatar_key"] = payload.defaultAvatarKey
    if payload.profileCompleted is not None:
        data["profile_completed"] = payload.profileCompleted
        if payload.profileCompleted:
            data["onboarding_completed_at"] = now_iso()
    if not data:
        return {"success": True}
    data["updated_at"] = now_iso()
    return serialize_user(db.patch("users", {"id": f"eq.{user.id}"}, data)[0])

@app.post("/v1/groups/{group_id}/join")
def join_group(group_id: str, user: CurrentUser = Depends(current_user)) -> Any:
    existing = db.get("group_members", {"group_id": f"eq.{group_id}", "user_id": f"eq.{user.id}"})
    if existing:
        return existing[0]
    groups = db.get("groups", {"id": f"eq.{group_id}", "select": "id,join_policy"})
    if not groups:
        raise HTTPException(status_code=404, detail="Group not found")
    if groups[0].get("join_policy") == "invite_only":
        raise HTTPException(status_code=403, detail="This group is invite-only")
    if groups[0].get("join_policy") == "request_to_join":
        requests_existing = db.get(
            "join_requests",
            {"group_id": f"eq.{group_id}", "user_id": f"eq.{user.id}", "status": "eq.pending", "select": "*"},
        )
        if requests_existing:
            return requests_existing[0]
        return db.post("join_requests", {
            "id": str(uuid.uuid4()),
            "group_id": group_id,
            "user_id": user.id,
            "status": "pending",
            "source": "mobile_app",
        })[0]
    return db.post("group_members", {
        "group_id": group_id,
        "user_id": user.id,
        "role": "member",
        "status": "active"
    })[0]

@app.post("/v1/groups/{group_id}/leave")
def leave_group(group_id: str, user: CurrentUser = Depends(current_user)) -> Any:
    db.patch("group_members", {"group_id": f"eq.{group_id}", "user_id": f"eq.{user.id}"}, {"status": "removed"})
    return {"success": True}

class SendMessageDto(BaseModel):
    content: str
    type: str = "text"
    clientMessageId: str = ""

@app.post("/v1/groups/{group_id}/messages")
def send_group_message(group_id: str, payload: SendMessageDto, user: CurrentUser = Depends(current_user)) -> Any:
    require_group_member(group_id, user)
    return db.post("messages", {
        "id": str(uuid.uuid4()),
        "group_id": group_id,
        "sender_id": user.id,
        "content": payload.content,
        "type": payload.type,
        "client_message_id": payload.clientMessageId or str(uuid.uuid4())
    })[0]

@app.get("/v1/groups/{group_id}/messages")
def get_group_messages(group_id: str, limit: int = 50, user: CurrentUser = Depends(current_user)) -> Any:
    require_group_member(group_id, user)
    messages = db.get("messages", {
        "group_id": f"eq.{group_id}",
        "select": "*,users(name)",
        "order": "created_at.desc",
        "limit": str(limit)
    })
    safe_get("message_reads", {"group_id": f"eq.{group_id}", "user_id": f"eq.{user.id}"})
    try:
        existing = db.get("message_reads", {"group_id": f"eq.{group_id}", "user_id": f"eq.{user.id}", "select": "group_id"})
        payload = {"last_read_at": now_iso()}
        if messages:
            payload["last_read_message_id"] = messages[0]["id"]
        if existing:
            db.patch("message_reads", {"group_id": f"eq.{group_id}", "user_id": f"eq.{user.id}"}, payload)
        else:
            db.post("message_reads", {"group_id": group_id, "user_id": user.id, **payload})
    except HTTPException:
        pass
    return messages

class CreateGroupDto(BaseModel):
    name: str
    description: Optional[str] = None
    city: str
    category: str
    visibility: str = "public"
    joinPolicy: str = "request_to_join"
    avatarUrl: Optional[str] = None
    institutionId: Optional[str] = None

@app.post("/v1/groups")
def create_group_api(payload: CreateGroupDto, user: CurrentUser = Depends(current_user)) -> Any:
    require_group_creator(user)
    group_id = str(uuid.uuid4())
    group = db.post("groups", {
        "id": group_id,
        "name": payload.name,
        "description": payload.description,
        "city": payload.city,
        "category": payload.category,
        "visibility": payload.visibility,
        "join_policy": payload.joinPolicy,
        "avatar_url": payload.avatarUrl,
        "institution_id": payload.institutionId,
        "created_by": user.id,
        "updated_at": now_iso(),
    })[0]
    db.post("group_members", {
        "group_id": group_id,
        "user_id": user.id,
        "role": "owner",
        "status": "active"
    })
    return serialize_group({**group, "member_count": 1}, "owner")


class UpdateGroupDto(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    city: Optional[str] = None
    category: Optional[str] = None
    visibility: Optional[str] = None
    joinPolicy: Optional[str] = None
    postingMode: Optional[str] = None
    avatarUrl: Optional[str] = None
    rules: Optional[str] = None


@app.patch("/v1/groups/{group_id}")
def update_group(group_id: str, payload: UpdateGroupDto, user: CurrentUser = Depends(current_user)) -> Any:
    """Update group details - only group admins can update"""
    require_group_admin(group_id, user)
    
    # Build update data
    data: dict[str, Any] = {"updated_at": now_iso()}
    if payload.name is not None:
        data["name"] = payload.name
    if payload.description is not None:
        data["description"] = payload.description
    if payload.city is not None:
        data["city"] = payload.city
    if payload.category is not None:
        data["category"] = payload.category
    if payload.visibility is not None:
        data["visibility"] = payload.visibility
    if payload.joinPolicy is not None:
        data["join_policy"] = payload.joinPolicy
    if payload.postingMode is not None:
        data["posting_mode"] = payload.postingMode
    if payload.avatarUrl is not None:
        data["avatar_url"] = payload.avatarUrl
    if payload.rules is not None:
        data["rules"] = payload.rules
    
    if len(data) == 1:  # Only updated_at
        return {"success": True, "message": "No changes provided"}
    
    result = db.patch("groups", {"id": f"eq.{group_id}"}, data)
    if not result:
        raise HTTPException(status_code=404, detail="Group not found")
    
    return result[0]


@app.delete("/v1/groups/{group_id}")
def delete_group(group_id: str, user: CurrentUser = Depends(current_user)) -> Any:
    """Soft delete group - only group owner can delete"""
    role = group_role(group_id, user.id)
    if role != "owner" and user.role != "platform_admin":
        raise HTTPException(status_code=403, detail="Only group owner can delete group")
    
    # Soft delete - set deleted_at timestamp
    result = db.patch("groups", {"id": f"eq.{group_id}"}, {
        "deleted_at": now_iso(),
        "updated_at": now_iso()
    })
    
    if not result:
        raise HTTPException(status_code=404, detail="Group not found")
    
    return {"success": True, "message": "Group deleted successfully"}


@app.get("/v1/groups/{group_id}/members")
def get_group_members(group_id: str, user: CurrentUser = Depends(current_user)) -> Any:
    require_group_member(group_id, user)
    members = db.get(
        "group_members",
        {"group_id": f"eq.{group_id}", "status": "eq.active", "select": "user_id,role,joined_at", "order": "joined_at.asc"},
    )
    user_ids = [row["user_id"] for row in members]
    users_by_id = {}
    if user_ids:
        users_rows = db.get("users", {"id": f"in.({','.join(user_ids)})", "select": "*"})
        users_by_id = {row["id"]: row for row in users_rows}
    return [
        {
            "user": serialize_user(users_by_id[row["user_id"]]) if row["user_id"] in users_by_id else {"id": row["user_id"], "name": "Member"},
            "role": row.get("role"),
            "joinedAt": row.get("joined_at"),
        }
        for row in members
    ]


@app.delete("/v1/groups/{group_id}/members/{user_id}")
def remove_group_member(group_id: str, user_id: str, user: CurrentUser = Depends(current_user)) -> Any:
    """Remove a member from the group - only admins can remove members"""
    require_group_admin(group_id, user)
    
    # Check if trying to remove self
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="Use leave endpoint to remove yourself")
    
    # Check target member's role
    target_role = group_role(group_id, user_id)
    if not target_role:
        raise HTTPException(status_code=404, detail="Member not found in group")
    
    # Owner cannot be removed
    if target_role == "owner":
        raise HTTPException(status_code=403, detail="Cannot remove group owner")
    
    # Only owner can remove admins
    current_role = group_role(group_id, user.id)
    if target_role in {"admin", "moderator"} and current_role != "owner" and user.role != "platform_admin":
        raise HTTPException(status_code=403, detail="Only owner can remove admins/moderators")
    
    # Remove member (set status to removed)
    result = db.patch("group_members", {
        "group_id": f"eq.{group_id}",
        "user_id": f"eq.{user_id}"
    }, {
        "status": "removed",
        "updated_at": now_iso()
    })
    
    return {"success": True, "message": "Member removed successfully"}


class UpdateMemberRoleDto(BaseModel):
    role: str  # member, moderator, admin


@app.patch("/v1/groups/{group_id}/members/{user_id}/role")
def update_member_role(
    group_id: str,
    user_id: str,
    payload: UpdateMemberRoleDto,
    user: CurrentUser = Depends(current_user)
) -> Any:
    """Update member role - only owner can change roles"""
    current_role = group_role(group_id, user.id)
    if current_role != "owner" and user.role != "platform_admin":
        raise HTTPException(status_code=403, detail="Only group owner can change member roles")
    
    # Cannot change owner role
    target_role = group_role(group_id, user_id)
    if not target_role:
        raise HTTPException(status_code=404, detail="Member not found")
    if target_role == "owner":
        raise HTTPException(status_code=403, detail="Cannot change owner role")
    
    # Validate new role
    valid_roles = {"member", "moderator", "admin"}
    if payload.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}")
    
    # Update role
    result = db.patch("group_members", {
        "group_id": f"eq.{group_id}",
        "user_id": f"eq.{user_id}"
    }, {
        "role": payload.role,
        "updated_at": now_iso()
    })
    
    return {"success": True, "message": f"Member role updated to {payload.role}"}


class BanMemberDto(BaseModel):
    reason: Optional[str] = None
    duration: Optional[str] = None  # "permanent", "24h", "7d", "30d"


@app.post("/v1/groups/{group_id}/members/{user_id}/ban")
def ban_group_member(
    group_id: str,
    user_id: str,
    payload: BanMemberDto,
    user: CurrentUser = Depends(current_user)
) -> Any:
    """Ban a member from the group"""
    require_group_admin(group_id, user)
    
    # Cannot ban owner
    target_role = group_role(group_id, user_id)
    if not target_role:
        raise HTTPException(status_code=404, detail="Member not found")
    if target_role == "owner":
        raise HTTPException(status_code=403, detail="Cannot ban group owner")
    
    # Only owner can ban admins/moderators
    current_role = group_role(group_id, user.id)
    if target_role in {"admin", "moderator"} and current_role != "owner" and user.role != "platform_admin":
        raise HTTPException(status_code=403, detail="Only owner can ban admins/moderators")
    
    # Calculate ban expiry
    ban_until = None
    if payload.duration and payload.duration != "permanent":
        duration_map = {"24h": 1, "7d": 7, "30d": 30}
        days = duration_map.get(payload.duration, 30)
        ban_until = (datetime.utcnow() + timedelta(days=days)).isoformat()
    
    # Update member status to banned
    db.patch("group_members", {
        "group_id": f"eq.{group_id}",
        "user_id": f"eq.{user_id}"
    }, {
        "status": "banned",
        "updated_at": now_iso()
    })
    
    # Create ban record
    db.post("group_member_bans", {
        "id": str(uuid.uuid4()),
        "group_id": group_id,
        "user_id": user_id,
        "banned_by": user.id,
        "reason": payload.reason,
        "banned_until": ban_until,
        "created_at": now_iso()
    })
    
    return {"success": True, "message": "Member banned successfully"}


@app.post("/v1/groups/{group_id}/members/{user_id}/unban")
def unban_group_member(group_id: str, user_id: str, user: CurrentUser = Depends(current_user)) -> Any:
    """Unban a member from the group"""
    require_group_admin(group_id, user)
    
    # Update member status back to active
    db.patch("group_members", {
        "group_id": f"eq.{group_id}",
        "user_id": f"eq.{user_id}",
        "status": "eq.banned"
    }, {
        "status": "active",
        "updated_at": now_iso()
    })
    
    return {"success": True, "message": "Member unbanned successfully"}


class MuteMemberDto(BaseModel):
    duration: str = "24h"  # "1h", "24h", "7d"
    reason: Optional[str] = None


@app.post("/v1/groups/{group_id}/members/{user_id}/mute")
def mute_group_member(
    group_id: str,
    user_id: str,
    payload: MuteMemberDto,
    user: CurrentUser = Depends(current_user)
) -> Any:
    """Mute a member in the group (cannot post messages)"""
    require_group_admin(group_id, user)
    
    # Calculate mute expiry
    duration_map = {"1h": 1/24, "24h": 1, "7d": 7}
    days = duration_map.get(payload.duration, 1)
    muted_until = (datetime.utcnow() + timedelta(days=days)).isoformat()
    
    # Create or update mute record
    existing = db.get("group_member_mutes", {
        "group_id": f"eq.{group_id}",
        "user_id": f"eq.{user_id}",
        "select": "id"
    })
    
    if existing:
        db.patch("group_member_mutes", {
            "group_id": f"eq.{group_id}",
            "user_id": f"eq.{user_id}"
        }, {
            "muted_until": muted_until,
            "reason": payload.reason,
            "muted_by": user.id,
            "updated_at": now_iso()
        })
    else:
        db.post("group_member_mutes", {
            "id": str(uuid.uuid4()),
            "group_id": group_id,
            "user_id": user_id,
            "muted_by": user.id,
            "reason": payload.reason,
            "muted_until": muted_until,
            "created_at": now_iso()
        })
    
    return {"success": True, "message": f"Member muted for {payload.duration}"}


@app.post("/v1/groups/{group_id}/members/{user_id}/unmute")
def unmute_group_member(group_id: str, user_id: str, user: CurrentUser = Depends(current_user)) -> Any:
    """Unmute a member in the group"""
    require_group_admin(group_id, user)
    
    # Delete mute record
    db.delete("group_member_mutes", {
        "group_id": f"eq.{group_id}",
        "user_id": f"eq.{user_id}"
    })
    
    return {"success": True, "message": "Member unmuted successfully"}
        for row in members
    ]

@app.get("/v1/groups/{group_id}/join-requests")
def get_join_requests(group_id: str, user: CurrentUser = Depends(current_user)) -> Any:
    require_group_admin(group_id, user)
    return db.get("join_requests", {"group_id": f"eq.{group_id}", "status": "eq.pending", "select": "*,users(name)"})

@app.post("/v1/groups/{group_id}/join-requests/{request_id}/approve")
def approve_join_request(group_id: str, request_id: str, user: CurrentUser = Depends(current_user)) -> Any:
    require_group_admin(group_id, user)
    db.patch("join_requests", {"id": f"eq.{request_id}"}, {"status": "approved", "decided_by": user.id, "decided_at": now_iso()})
    reqs = db.get("join_requests", {"id": f"eq.{request_id}"})
    if reqs:
        db.post("group_members", {
            "group_id": group_id,
            "user_id": reqs[0]["user_id"],
            "role": "member",
            "status": "active"
        })
    return {"success": True}

@app.post("/v1/groups/{group_id}/join-requests/{request_id}/reject")
def reject_join_request(group_id: str, request_id: str, user: CurrentUser = Depends(current_user)) -> Any:
    require_group_admin(group_id, user)
    db.patch("join_requests", {"id": f"eq.{request_id}"}, {"status": "rejected", "decided_by": user.id, "decided_at": now_iso()})
    return {"success": True}

@app.get("/v1/notifications")
def get_notifications(user: CurrentUser = Depends(current_user)) -> Any:
    return db.get(
        "notifications",
        {
            "user_id": f"eq.{user.id}",
            "select": "id,title,body,type,data,read_at,created_at",
            "order": "created_at.desc",
            "limit": "50",
        },
    )


@app.patch("/v1/notifications/read-all")
def mark_notifications_read(user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    db.patch("notifications", {"user_id": f"eq.{user.id}", "read_at": "is.null"}, {"read_at": now_iso()})
    return {"success": True}


@app.patch("/v1/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str, user: CurrentUser = Depends(current_user)) -> Any:
    rows = db.patch(
        "notifications",
        {"id": f"eq.{notification_id}", "user_id": f"eq.{user.id}"},
        {"read_at": now_iso()},
    )
    return rows[0] if rows else {"success": True}


@app.get("/v1/saved-posts")
def get_saved_posts(user: CurrentUser = Depends(current_user)) -> Any:
    rows = safe_get("saved_posts", {"user_id": f"eq.{user.id}", "select": "post_id,created_at", "order": "created_at.desc"})
    post_ids = [row["post_id"] for row in rows]
    if not post_ids:
        return []
    posts = db.get(
        "posts",
        {"id": f"in.({','.join(post_ids)})", "status": "eq.published", "select": "id,title,content,media_url,media_type,created_at,published_at,author_id,group_id"},
    )
    author_ids = sorted({post.get("author_id") for post in posts if post.get("author_id")})
    authors = {}
    if author_ids:
        authors = {row["id"]: row for row in safe_get("users", {"id": f"in.({','.join(author_ids)})", "select": "id,name,avatar_url,verified"})}
    return [
        {
            "id": post["id"],
            "title": post.get("title"),
            "content": post.get("content"),
            "mediaUrl": post.get("media_url"),
            "mediaType": post.get("media_type"),
            "createdAt": post.get("published_at") or post.get("created_at"),
            "author": {
                "id": post.get("author_id"),
                "name": authors.get(post.get("author_id"), {}).get("name") or "OnCampus user",
                "avatarUrl": authors.get(post.get("author_id"), {}).get("avatar_url"),
                "verified": authors.get(post.get("author_id"), {}).get("verified", False),
            },
        }
        for post in posts
    ]


class SavePostDto(BaseModel):
    postId: str


@app.post("/v1/saved-posts")
def save_post(payload: SavePostDto, user: CurrentUser = Depends(current_user)) -> Any:
    existing = safe_get("saved_posts", {"user_id": f"eq.{user.id}", "post_id": f"eq.{payload.postId}", "select": "post_id"})
    if existing:
        return {"success": True}
    db.post("saved_posts", {"user_id": user.id, "post_id": payload.postId})
    return {"success": True}


@app.delete("/v1/saved-posts/{post_id}")
def unsave_post(post_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    try:
        db.delete("saved_posts", {"user_id": f"eq.{user.id}", "post_id": f"eq.{post_id}"})
    except HTTPException:
        pass
    return {"success": True}


@app.get("/v1/blocked-users")
def get_blocked_users(user: CurrentUser = Depends(current_user)) -> Any:
    rows = safe_get("user_blocks", {"blocker_id": f"eq.{user.id}", "select": "blocked_user_id,created_at", "order": "created_at.desc"})
    user_ids = [row["blocked_user_id"] for row in rows]
    if not user_ids:
        return []
    users_rows = safe_get("users", {"id": f"in.({','.join(user_ids)})", "select": "*"})
    return [serialize_user(row) for row in users_rows]


class UserSettingsDto(BaseModel):
    privacy: Optional[dict[str, Any]] = None
    preferences: Optional[dict[str, Any]] = None


@app.get("/v1/users/me/settings")
def get_user_settings(user: CurrentUser = Depends(current_user)) -> Any:
    rows = safe_get("user_settings", {"user_id": f"eq.{user.id}", "select": "*"})
    if rows:
        return rows[0]
    return {"user_id": user.id, "privacy": {}, "preferences": {}}


@app.patch("/v1/users/me/settings")
def update_user_settings(payload: UserSettingsDto, user: CurrentUser = Depends(current_user)) -> Any:
    existing = safe_get("user_settings", {"user_id": f"eq.{user.id}", "select": "user_id,privacy,preferences"})
    current = existing[0] if existing else {"privacy": {}, "preferences": {}}
    data = {
        "privacy": {**(current.get("privacy") or {}), **(payload.privacy or {})},
        "preferences": {**(current.get("preferences") or {}), **(payload.preferences or {})},
        "updated_at": now_iso(),
    }
    if existing:
        return db.patch("user_settings", {"user_id": f"eq.{user.id}"}, data)[0]
    return db.post("user_settings", {"user_id": user.id, **data})[0]


class NotificationPreferencesDto(BaseModel):
    pushEnabled: Optional[bool] = None
    emailEnabled: Optional[bool] = None
    mentions: Optional[bool] = None
    announcements: Optional[bool] = None
    joinRequests: Optional[bool] = None
    postActivity: Optional[bool] = None


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
    users_rows = safe_get("users", {"name": f"ilike.*{query}*", "select": "id,name,city,course,avatar_url,verified,account_type", "limit": "20"})
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
                "title": row.get("title"),
                "content": row.get("content"),
                "mediaUrl": row.get("media_url"),
                "createdAt": row.get("published_at") or row.get("created_at"),
                "author": {"id": row.get("author_id")},
            }
            for row in posts
        ],
    }


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
    user: CurrentUser = Depends(current_user),
) -> dict[str, str]:
    """Upload institution logo (PNG/SVG)."""
    allowed = {"image/png", "image/svg+xml", "image/jpeg", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Only PNG/SVG/JPEG/WEBP allowed. Got: {file.content_type}")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File too large. Max {MAX_IMAGE_SIZE_MB} MB.")

    ext          = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "png"
    unique_name  = f"{uuid.uuid4()}.{ext}"
    storage_path = f"institution-logos/{user.id}/{unique_name}"
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
    user: CurrentUser = Depends(current_user),
) -> dict[str, str]:
    """Upload a verification document for institution registration."""
    allowed = ALLOWED_IMAGE_TYPES | ALLOWED_DOC_TYPES
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Only images/PDFs allowed. Got: {file.content_type}")

    file_bytes = await file.read()
    if len(file_bytes) > _max_bytes(file.content_type):
        raise HTTPException(status_code=400, detail=f"File too large. Max {MAX_DOC_SIZE_MB} MB.")

    ext          = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "pdf"
    unique_name  = f"{uuid.uuid4()}.{ext}"
    storage_path = f"institution-docs/{user.id}/{unique_name}"
    public_url   = _storage_upload(file_bytes, storage_path, file.content_type, SUPABASE_MEDIA_BUCKET)

    return {"url": public_url, "type": "institution_document"}


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    is_dev = os.environ.get("DEV_MODE", "true").lower() == "true"
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=is_dev)
