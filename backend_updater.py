import os

new_apis = """
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
    return db.get("join_requests", {"group_id": f"eq.{group_id}", "status": "eq.pending"})

@app.post("/v1/groups/{group_id}/join-requests/{request_id}/approve")
def approve_join_request(group_id: str, request_id: str, user: CurrentUser = Depends(current_user)) -> Any:
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
    db.patch("join_requests", {"id": f"eq.{request_id}"}, {"status": "rejected", "decided_by": user.id, "decided_at": now_iso()})
    return {"success": True}

@app.get("/v1/notifications")
def get_notifications(user: CurrentUser = Depends(current_user)) -> Any:
    return []
"""

server_path = r"d:\2026-06-30\oncampuses-v1\backend\server.py"
with open(server_path, "r", encoding="utf-8") as f:
    content = f.read()

if 'class CreateGroupDto' not in content:
    with open(server_path, "a", encoding="utf-8") as f:
        f.write(new_apis)
    print("Added missing APIs to server.py")
else:
    print("APIs already exist")
