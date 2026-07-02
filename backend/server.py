from datetime import datetime, timedelta, timezone
import base64
import hashlib
import json
import os
from pathlib import Path
import uuid
from typing import Any, Optional

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import jwt
import requests
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")

ROOT_DIR = Path(__file__).resolve().parents[1]
ALL_SET_DIR = ROOT_DIR / "all_info_for_api_referance_only" / "all_set"


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

app = FastAPI(title="OnCampus API", version="1.0.0")

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

    @staticmethod
    def _json(response: requests.Response) -> Any:
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        if not response.text:
            return None
        return response.json()


db = SupabaseRest()


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
            return CurrentUser(id=payload["sub"], role=payload.get("role", "normal_user"))
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


@app.get("/health")
@app.get("/v1/health")
def health() -> dict[str, Any]:
    firebase_configured = bool(FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON)
    return {
        "status": "ok",
        "supabaseConfigured": db.enabled,
        "redisConfigured": redis.enabled,
        "redisReachable": redis.ping() if redis.enabled else False,
        "firebaseConfigured": firebase_configured,
        "firebaseProjectId": firebase_project_id(),
        "otpProviderConfigured": firebase_configured,
        "otpProvider": "firebase_phone_auth",
        "timestamp": now_iso(),
    }


@app.get("/v1/integrations/health")
def integrations_health() -> dict[str, Any]:
    firebase_configured = bool(FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON)
    return {
        "supabase": {"configured": db.enabled},
        "upstashRedis": {"configured": redis.enabled, "reachable": redis.ping() if redis.enabled else False},
        "firebase": {"configured": firebase_configured, "projectId": firebase_project_id()},
        "otp": {"provider": "firebase_phone_auth", "configured": firebase_configured},
        "render": {"configured": bool(os.getenv("RENDER_API_KEY"))},
        "railway": {"configured": bool(os.getenv("RAILWAY_TOKEN"))},
        "claude": {"configured": bool(os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY"))},
    }


class VerifyOtpDto(BaseModel):
    firebaseIdToken: str
    platform: Optional[str] = None


@app.post("/v1/auth/otp/verify")
def verify_otp(payload: VerifyOtpDto, x_device_id: Optional[str] = Header(default=None)) -> dict[str, Any]:
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
        "user": {
            "id": user["id"],
            "name": user.get("name"),
            "city": user.get("city"),
            "course": user.get("course"),
            "avatarUrl": user.get("avatar_url"),
            "verified": user.get("verified", False),
            "accountType": role,
            "roles": [role],
            "canCreatePosts": user.get("can_create_posts", False),
            "canCreateGroups": user.get("can_create_groups", False),
        },
    }


@app.get("/v1/auth/me")
@app.get("/v1/users/me")
def me(user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    rows = db.get(
        "users",
        {
            "id": f"eq.{user.id}",
            "select": "id,name,city,course,avatar_url,verified,account_type,can_create_posts,can_create_groups,status",
        },
    )
    if not rows:
        raise HTTPException(status_code=404, detail="User not found")
    profile = rows[0]
    account_type = profile.get("account_type") or "normal_user"
    return {
        "id": profile["id"],
        "name": profile.get("name"),
        "city": profile.get("city"),
        "course": profile.get("course"),
        "avatarUrl": profile.get("avatar_url"),
        "verified": profile.get("verified", False),
        "accountType": account_type,
        "roles": [account_type],
        "canCreatePosts": profile.get("can_create_posts", False),
        "canCreateGroups": profile.get("can_create_groups", False),
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
                "author": {"id": post.get("author_id")},
                "group": {"id": post["group_id"], "name": "Group"} if post.get("group_id") else None,
            }
            for post in posts
        ]
    }


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
            "select": "id,name,description,city,category,visibility,avatar_url,official,posting_mode",
        },
    )
    role_by_group = {row["group_id"]: row["role"] for row in memberships}
    return [{**group, "avatarUrl": group.get("avatar_url"), "role": role_by_group.get(group["id"])} for group in groups]


@app.get("/v1/discovery/groups")
def discover_groups(
    q: Optional[str] = None,
    city: Optional[str] = None,
    category: Optional[str] = None,
) -> dict[str, Any]:
    params = {
        "deleted_at": "is.null",
        "visibility": "eq.public",
        "select": "id,name,description,city,category,visibility,avatar_url,official,posting_mode",
        "order": "official.desc,created_at.desc",
        "limit": "50",
    }
    if city:
        params["city"] = f"eq.{city}"
    if category:
        params["category"] = f"eq.{category}"
    if q:
        params["name"] = f"ilike.*{q}*"
    return {"groups": db.get("groups", params)}


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
            "document_url": payload.documentUrl,
            "status": "pending",
        },
    )[0]


@app.get("/v1/institutions/me/dashboard")
def institution_dashboard(user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    admin_rows = db.get(
        "institution_admins",
        {"user_id": f"eq.{user.id}", "status": "eq.active", "select": "institution_id,role"},
    )
    if not admin_rows and user.role != "platform_admin":
        raise HTTPException(status_code=403, detail="Institution admin access required")

    institution_id = admin_rows[0]["institution_id"] if admin_rows else None
    institution = None
    if institution_id:
        rows = db.get("institutions", {"id": f"eq.{institution_id}", "select": "id,name,city"})
        institution = rows[0] if rows else None

    scoped = {"institution_id": f"eq.{institution_id}"} if institution_id else {}
    posts = db.get("posts", {**scoped, "select": "id,status,type,created_at", "order": "created_at.desc", "limit": "20"})
    groups = db.get("groups", {**scoped, "deleted_at": "is.null", "select": "id,name,city,category,visibility,official"})
    requests = db.get(
        "institution_verification_requests",
        {"institution_id": f"eq.{institution_id}", "select": "id,status,created_at", "order": "created_at.desc", "limit": "20"}
        if institution_id
        else {"select": "id,status,created_at", "order": "created_at.desc", "limit": "20"},
    )
    return {
        "institution": institution,
        "role": admin_rows[0]["role"] if admin_rows else "platform_admin",
        "counts": {
            "posts": len(posts),
            "groups": len(groups),
            "verificationRequests": len(requests),
        },
        "recentPosts": posts,
        "groups": groups,
        "verificationRequests": requests,
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
    avatarUrl: Optional[str] = None

@app.patch("/v1/auth/me")
@app.patch("/v1/users/me")
def update_profile(payload: UpdateProfileDto, user: CurrentUser = Depends(current_user)) -> Any:
    data = {}
    if payload.name is not None: data["name"] = payload.name
    if payload.city is not None: data["city"] = payload.city
    if payload.course is not None: data["course"] = payload.course
    if payload.avatarUrl is not None: data["avatar_url"] = payload.avatarUrl
    if not data:
        return {"success": True}
    data["updated_at"] = now_iso()
    return db.patch("users", {"id": f"eq.{user.id}"}, data)[0]

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
    db.patch("group_members", {"group_id": f"eq.{group_id}", "user_id": f"eq.{user.id}"}, {"status": "left"})
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
    return db.get("messages", {
        "group_id": f"eq.{group_id}",
        "select": "*,users(name)",
        "order": "created_at.desc",
        "limit": str(limit)
    })

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
    return group

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
