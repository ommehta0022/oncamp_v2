# -*- coding: utf-8 -*-
import os
import uuid

server_path = r"d:\2026-06-30\oncampuses-v1\backend\server.py"

with open(server_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace SendMessageDto and endpoints
old_msgs = """class SendMessageDto(BaseModel):
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
    })"""

new_msgs = """class SendMessageDto(BaseModel):
    content: str
    type: str = "text"
    clientMessageId: str = ""

@app.post("/v1/groups/{group_id}/messages")
def send_group_message(group_id: str, payload: SendMessageDto, user: CurrentUser = Depends(current_user)) -> Any:
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
    return db.get("messages", {
        "group_id": f"eq.{group_id}",
        "select": "*,users(name)",
        "order": "created_at.desc",
        "limit": str(limit)
    })"""
content = content.replace(old_msgs, new_msgs)

# Replace get_join_requests
old_reqs = """@app.get("/v1/groups/{group_id}/join-requests")
def get_join_requests(group_id: str, user: CurrentUser = Depends(current_user)) -> Any:
    return db.get("join_requests", {"group_id": f"eq.{group_id}", "status": "eq.pending"})"""
    
new_reqs = """@app.get("/v1/groups/{group_id}/join-requests")
def get_join_requests(group_id: str, user: CurrentUser = Depends(current_user)) -> Any:
    return db.get("join_requests", {"group_id": f"eq.{group_id}", "status": "eq.pending", "select": "*,users(name)"})"""
    
content = content.replace(old_reqs, new_reqs)

with open(server_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Backend patched for real data relationships.")
