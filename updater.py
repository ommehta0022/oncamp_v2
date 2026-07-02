import os
import uuid
from pathlib import Path

ROOT_DIR = Path("d:/2026-06-30/oncampuses-v1")
ALL_SET_DIR = ROOT_DIR / "all_info_for_api_referance_only" / "all_set"
BACKEND_DIR = ROOT_DIR / "backend"

def read_secret(name):
    path = ALL_SET_DIR / name
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    return ""

def value_after(label, text):
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.lower().startswith(label.lower()):
            if "=" in line:
                return line.split("=", 1)[-1].strip().strip("\"'")
            if ":" in line:
                return line.split(":", 1)[-1].strip().strip("\"'")
    return ""

supabase_txt = read_secret("supabase")
upstash_txt = read_secret("upstash_url")

anon_key = value_after("anon", supabase_txt)
service_role = value_after("service_role(secret)", supabase_txt)
db_url = value_after("API URL database_uri", supabase_txt).replace("/rest/v1/", "").replace("/rest/v1", "")
upstash_url = value_after("UPSTASH_REDIS_REST_URL", upstash_txt)
upstash_token = value_after("UPSTASH_REDIS_REST_TOKEN", upstash_txt)

env_content = f"""SUPABASE_URL={db_url}
SUPABASE_ANON_KEY={anon_key}
SUPABASE_SERVICE_ROLE_KEY={service_role}
UPSTASH_REDIS_REST_URL={upstash_url}
UPSTASH_REDIS_REST_TOKEN={upstash_token}
FIREBASE_SERVICE_ACCOUNT_PATH=../all_info_for_api_referance_only/all_set/oncampus-prod-firebase-adminsdk-fbsvc-11113b2908.json
JWT_SECRET=dev-only-change-me
CORS_ORIGINS=*
ALLOW_DEV_AUTH=false
OTP_WEBHOOK_URL=
"""

(BACKEND_DIR / ".env").write_text(env_content, encoding="utf-8")

server_path = BACKEND_DIR / "server.py"
new_apis = """
class UpdateProfileDto(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    course: Optional[str] = None
    avatarUrl: Optional[str] = None

@app.patch("/v1/auth/me")
def update_profile(payload: UpdateProfileDto, user: CurrentUser = Depends(current_user)) -> Any:
    data = {}
    if payload.name is not None: data["name"] = payload.name
    if payload.city is not None: data["city"] = payload.city
    if payload.course is not None: data["course"] = payload.course
    if payload.avatarUrl is not None: data["avatar_url"] = payload.avatarUrl
    if not data:
        return {"success": True}
    return db.patch("users", {"id": f"eq.{user.id}"}, data)[0]

@app.post("/v1/groups/{group_id}/join")
def join_group(group_id: str, user: CurrentUser = Depends(current_user)) -> Any:
    existing = db.get("group_members", {"group_id": f"eq.{group_id}", "user_id": f"eq.{user.id}"})
    if existing:
        return existing[0]
    return db.post("group_members", {
        "id": str(uuid.uuid4()),
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

@app.post("/v1/groups/{group_id}/messages")
def send_group_message(group_id: str, payload: SendMessageDto, user: CurrentUser = Depends(current_user)) -> Any:
    return db.post("group_messages", {
        "id": str(uuid.uuid4()),
        "group_id": group_id,
        "sender_id": user.id,
        "content": payload.content,
        "type": payload.type
    })[0]

@app.get("/v1/groups/{group_id}/messages")
def get_group_messages(group_id: str, limit: int = 50, user: CurrentUser = Depends(current_user)) -> Any:
    return db.get("group_messages", {
        "group_id": f"eq.{group_id}",
        "select": "*",
        "order": "created_at.desc",
        "limit": str(limit)
    })
"""

content = server_path.read_text(encoding="utf-8")
if '@app.patch("/v1/auth/me")' not in content:
    with open(server_path, "a", encoding="utf-8") as f:
        f.write(new_apis)

print("done writing apis")
