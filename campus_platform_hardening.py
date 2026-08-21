from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

import campus_platform as platform
import server

router = APIRouter(prefix="/v1/campus", tags=["campus-platform-security"])


class SecureInviteDto(BaseModel):
    inviteType: Literal["institution", "group", "event"]
    targetId: Optional[str] = Field(default=None, max_length=128)
    autoApprove: bool = False
    maxUses: Optional[int] = Field(default=None, ge=1, le=10000)
    expiresAt: Optional[str] = None


class SecureReactionDto(BaseModel):
    reaction: Optional[Literal["like", "love", "celebrate", "support", "insightful", "curious"]] = None


class SecurePollVoteDto(BaseModel):
    optionIds: list[str] = Field(default_factory=list, max_length=20)


def _institution_for_user(user: server.CurrentUser, *, require_verified: bool = True) -> str:
    admin = platform._admin_context(user)
    if admin:
        return str(admin["institution_id"])
    try:
        operator = platform.institution_operator(user)
        if operator:
            return str(operator["institution_id"])
    except HTTPException:
        pass
    return str(platform.student_membership(user.id, require_verified=require_verified)["institution_id"])


def _visible_post(post_id: str, user: server.CurrentUser, select: str = "id,institution_id,reactions_enabled") -> dict[str, Any]:
    iid = _institution_for_user(user)
    rows = server.db.get(
        "posts",
        {
            "id": f"eq.{post_id}",
            "institution_id": f"eq.{iid}",
            "deleted_at": "is.null",
            "status": "eq.published",
            "select": select,
            "limit": "1",
        },
    ) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Post not found")
    return rows[0]


def _validate_invite_target(iid: str, invite_type: str, target_id: Optional[str]) -> None:
    if invite_type == "institution":
        if target_id and target_id != iid:
            raise HTTPException(status_code=422, detail="Institution invite target must match the current institution")
        return
    if not target_id:
        raise HTTPException(status_code=422, detail=f"{invite_type.title()} invite requires a target")
    table = "groups" if invite_type == "group" else "campus_events"
    params: dict[str, Any] = {
        "id": f"eq.{target_id}",
        "institution_id": f"eq.{iid}",
        "select": "id,institution_id",
        "limit": "1",
    }
    if invite_type == "group":
        params["deleted_at"] = "is.null"
    else:
        params["status"] = "in.(published,scheduled)"
    if not (server.db.get(table, params) or []):
        raise HTTPException(status_code=422, detail=f"{invite_type.title()} does not belong to this institution or is unavailable")


def _invite_row(code: str) -> dict[str, Any]:
    rows = server.db.get("campus_invites", {"code": f"eq.{code}", "active": "eq.true", "select": "*", "limit": "1"}) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Invite is invalid or expired")
    row = rows[0]
    expires_at = row.get("expires_at")
    if expires_at and datetime.fromisoformat(str(expires_at).replace("Z", "+00:00")) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Invite has expired")
    if row.get("max_uses") is not None and int(row.get("use_count") or 0) >= int(row["max_uses"]):
        raise HTTPException(status_code=410, detail="Invite has reached its usage limit")
    _validate_invite_target(str(row["institution_id"]), str(row["invite_type"]), row.get("target_id"))
    return row


@router.get("/search")
def global_search(q: str = Query(..., min_length=2, max_length=160), user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    query = platform._safe_query(q)
    if len(query) < 2:
        raise HTTPException(status_code=422, detail="Search query is too short")
    iid = _institution_for_user(user)
    groups = platform._search_table("groups", "name", query, "id,name,description,category,city,avatar_url,official,is_official,institution_id", 15, {"institution_id": f"eq.{iid}", "deleted_at": "is.null"})
    posts = platform._search_table("posts", "title", query, "id,title,content,type,institution_id,group_id,created_at,published_at", 15, {"institution_id": f"eq.{iid}", "deleted_at": "is.null", "status": "eq.published"})
    events = platform._search_table("campus_events", "title", query, "id,title,description,location,start_at,end_at,image_url", 15, {"institution_id": f"eq.{iid}", "status": "in.(published,scheduled)"})
    opportunities = platform._search_table("campus_opportunities", "title", query, "id,kind,title,organization,description,location,deadline", 15, {"institution_id": f"eq.{iid}", "status": "eq.published"})
    marketplace = platform._search_table("campus_marketplace_items", "title", query, "id,title,description,category,price,currency,image_urls,status", 10, {"institution_id": f"eq.{iid}", "status": "eq.active"})
    lost_found = platform._search_table("campus_lost_found_items", "title", query, "id,kind,title,description,location,event_at,image_url,status", 10, {"institution_id": f"eq.{iid}", "status": "eq.open"})
    results = {"groups": groups, "posts": posts, "events": events, "opportunities": opportunities, "marketplace": marketplace, "lostFound": lost_found}
    count = sum(len(value) for value in results.values())
    server.db.post("user_search_history", {"user_id": user.id, "query": query, "scope": "global", "result_count": count})
    platform._activity(user.id, iid, "search", "query", None, {"query": query, "results": count})
    return {"query": query, "resultCount": count, "ranking": "oncampus-smart-v1", **results}


@router.get("/trending")
def trending(user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid = _institution_for_user(user)
    recent = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    posts = server.db.get("posts", {"institution_id": f"eq.{iid}", "status": "eq.published", "deleted_at": "is.null", "created_at": f"gte.{recent}", "select": "id,title,content,type,created_at,published_at", "order": "created_at.desc", "limit": "100"}) or []
    post_ids = {str(row["id"]) for row in posts}
    tags = server.db.get("post_hashtags", {"created_at": f"gte.{recent}", "select": "tag,post_id", "limit": "10000"}) or []
    tag_counts: dict[str, int] = {}
    for row in tags:
        if str(row.get("post_id")) not in post_ids:
            continue
        tag = str(row.get("tag") or "").strip()
        if tag:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
    scored = []
    for post in posts:
        reactions = len(server.db.get("post_reactions", {"post_id": f"eq.{post['id']}", "select": "user_id", "limit": "10000"}) or [])
        views = len(server.db.get("post_views", {"post_id": f"eq.{post['id']}", "select": "id", "limit": "10000"}) or [])
        scored.append({**post, "score": reactions * 4 + views, "reactions": reactions, "views": views})
    scored.sort(key=lambda item: item["score"], reverse=True)
    events = server.db.get("campus_events", {"institution_id": f"eq.{iid}", "end_at": f"gte.{platform.now_iso()}", "status": "in.(published,scheduled)", "select": "id,title,start_at,location,image_url", "order": "start_at.asc", "limit": "10"}) or []
    return {"hashtags": [{"tag": tag, "count": count} for tag, count in sorted(tag_counts.items(), key=lambda item: item[1], reverse=True)[:20]], "posts": scored[:20], "events": events}


@router.post("/institution/invites")
def create_invite(payload: SecureInviteDto, user: server.CurrentUser = Depends(server.current_user), ctx: dict[str, Any] = Depends(platform.require_operator("invites.manage"))) -> dict[str, Any]:
    iid = str(ctx["institution_id"])
    _validate_invite_target(iid, payload.inviteType, payload.targetId)
    if payload.expiresAt:
        expires = datetime.fromisoformat(payload.expiresAt.replace("Z", "+00:00"))
        if expires <= datetime.now(timezone.utc):
            raise HTTPException(status_code=422, detail="Invite expiry must be in the future")
    code = secrets.token_urlsafe(18).replace("-", "A").replace("_", "B")
    row = server.db.post("campus_invites", {"institution_id": iid, "code": code, "invite_type": payload.inviteType, "target_id": payload.targetId or (iid if payload.inviteType == "institution" else None), "auto_approve": payload.autoApprove, "max_uses": payload.maxUses, "expires_at": payload.expiresAt, "active": True, "created_by": user.id})[0]
    platform._audit(user, iid, "invite.created", "invite", row["id"], {"type": payload.inviteType, "targetId": row.get("target_id")})
    return {**row, "joinUrl": f"oncampus://join?code={code}", "qrUrl": f"/v1/campus/invites/{code}/qr"}


@router.get("/invites/{code}")
def get_invite(code: str) -> dict[str, Any]:
    row = _invite_row(code)
    inst = server.db.get("institutions", {"id": f"eq.{row['institution_id']}", "select": "id,name,logo_url,city,state", "limit": "1"}) or []
    target: Optional[dict[str, Any]] = None
    if row["invite_type"] == "group" and row.get("target_id"):
        items = server.db.get("groups", {"id": f"eq.{row['target_id']}", "institution_id": f"eq.{row['institution_id']}", "select": "id,name,avatar_url,description", "limit": "1"}) or []
        target = items[0] if items else None
    elif row["invite_type"] == "event" and row.get("target_id"):
        items = server.db.get("campus_events", {"id": f"eq.{row['target_id']}", "institution_id": f"eq.{row['institution_id']}", "select": "id,title,start_at,end_at,location,image_url", "limit": "1"}) or []
        target = items[0] if items else None
    return {"code": code, "inviteType": row["invite_type"], "institution": inst[0] if inst else None, "targetId": row.get("target_id"), "target": target, "autoApprove": bool(row.get("auto_approve")), "expiresAt": row.get("expires_at")}


@router.post("/invites/{code}/accept")
def accept_invite(code: str, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    row = _invite_row(code)
    # Resolve presentation data before consuming the final allowed use. Re-validating
    # after increment would incorrectly reject an acceptance that just exhausted maxUses.
    info = get_invite(code)
    iid = str(row["institution_id"])
    invite_type = str(row["invite_type"])
    target_id = row.get("target_id")
    status = "pending"

    if invite_type == "institution":
        verification = "verified" if row.get("auto_approve") else "pending"
        existing = server.db.get("user_institutions", {"user_id": f"eq.{user.id}", "institution_id": f"eq.{iid}", "select": "user_id", "limit": "1"}) or []
        values = {"verification_status": verification, "verified_at": platform.now_iso() if verification == "verified" else None}
        if existing:
            server.db.patch("user_institutions", {"user_id": f"eq.{user.id}", "institution_id": f"eq.{iid}"}, values)
        else:
            server.db.post("user_institutions", {"user_id": user.id, "institution_id": iid, "role": "student", **values})
        approvals = server.db.get("institution_student_approvals", {"user_id": f"eq.{user.id}", "institution_id": f"eq.{iid}", "select": "id", "limit": "1"}) or []
        approval_values = {"status": "approved" if verification == "verified" else "pending", "source": "invite", "updated_at": platform.now_iso()}
        if approvals:
            server.db.patch("institution_student_approvals", {"id": f"eq.{approvals[0]['id']}"}, approval_values)
        else:
            server.db.post("institution_student_approvals", {"institution_id": iid, "user_id": user.id, **approval_values})
        status = "approved" if verification == "verified" else "pending"
    else:
        membership = platform.student_membership(user.id)
        if str(membership["institution_id"]) != iid:
            raise HTTPException(status_code=403, detail="This invite belongs to another institution")
        if invite_type == "group" and target_id:
            member = server.db.get("group_members", {"group_id": f"eq.{target_id}", "user_id": f"eq.{user.id}", "select": "group_id", "limit": "1"}) or []
            if row.get("auto_approve") and not member:
                server.db.post("group_members", {"group_id": target_id, "user_id": user.id, "role": "member", "muted": False})
                status = "approved"
            elif not member:
                existing_request = server.db.get("join_requests", {"group_id": f"eq.{target_id}", "user_id": f"eq.{user.id}", "status": "eq.pending", "select": "id", "limit": "1"}) or []
                if not existing_request:
                    server.db.post("join_requests", {"group_id": target_id, "user_id": user.id, "status": "pending", "source": "invite"})
                status = "pending"
            else:
                status = "approved"
        elif invite_type == "event" and target_id:
            event = server.db.get("campus_events", {"id": f"eq.{target_id}", "institution_id": f"eq.{iid}", "status": "in.(published,scheduled)", "rsvp_enabled": "eq.true", "select": "id", "limit": "1"}) or []
            if not event:
                raise HTTPException(status_code=404, detail="Event is not available for RSVP")
            existing = server.db.get("campus_event_rsvps", {"event_id": f"eq.{target_id}", "user_id": f"eq.{user.id}", "select": "event_id", "limit": "1"}) or []
            values = {"status": "going", "guests": 0, "updated_at": platform.now_iso()}
            if existing:
                server.db.patch("campus_event_rsvps", {"event_id": f"eq.{target_id}", "user_id": f"eq.{user.id}"}, values)
            else:
                server.db.post("campus_event_rsvps", {"event_id": target_id, "user_id": user.id, **values})
            status = "approved"

    server.db.patch("campus_invites", {"id": f"eq.{row['id']}"}, {"use_count": int(row.get("use_count") or 0) + 1})
    platform._activity(user.id, iid, "invite.accepted", invite_type, target_id, {"inviteId": row["id"], "status": status})
    platform.emit_webhook(iid, "invite.accepted", {"userId": user.id, "inviteId": row["id"], "type": invite_type, "status": status})
    return {"accepted": True, "status": status, **info}


@router.post("/posts/{post_id}/reaction")
def set_reaction(post_id: str, payload: SecureReactionDto, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    post = _visible_post(post_id, user)
    if post.get("reactions_enabled") is False:
        raise HTTPException(status_code=404, detail="Post is not available for reactions")
    server.db.delete("post_reactions", {"post_id": f"eq.{post_id}", "user_id": f"eq.{user.id}"})
    if payload.reaction:
        server.db.post("post_reactions", {"post_id": post_id, "user_id": user.id, "reaction": payload.reaction})
    rows = server.db.get("post_reactions", {"post_id": f"eq.{post_id}", "select": "reaction", "limit": "10000"}) or []
    counts: dict[str, int] = {}
    for item in rows:
        counts[item["reaction"]] = counts.get(item["reaction"], 0) + 1
    platform._activity(user.id, post.get("institution_id"), "post.reaction", "post", post_id, {"reaction": payload.reaction})
    return {"reaction": payload.reaction, "counts": counts, "total": len(rows)}


@router.get("/posts/{post_id}/reactions")
def reaction_summary(post_id: str, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    _visible_post(post_id, user)
    rows = server.db.get("post_reactions", {"post_id": f"eq.{post_id}", "select": "user_id,reaction", "limit": "10000"}) or []
    counts: dict[str, int] = {}
    mine = None
    for item in rows:
        counts[item["reaction"]] = counts.get(item["reaction"], 0) + 1
        if item.get("user_id") == user.id:
            mine = item["reaction"]
    return {"counts": counts, "total": len(rows), "mine": mine}


@router.get("/posts/{post_id}/poll")
def get_poll(post_id: str, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    _visible_post(post_id, user)
    return platform.get_poll(post_id, user)


@router.post("/polls/{poll_id}/vote")
def vote_poll(poll_id: str, payload: SecurePollVoteDto, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    polls = server.db.get("post_polls", {"id": f"eq.{poll_id}", "select": "id,post_id,multiple_choice,closes_at", "limit": "1"}) or []
    if not polls:
        raise HTTPException(status_code=404, detail="Poll not found")
    poll = polls[0]
    _visible_post(str(poll["post_id"]), user)
    if poll.get("closes_at") and datetime.fromisoformat(str(poll["closes_at"]).replace("Z", "+00:00")) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=409, detail="Poll is closed")
    option_ids = sorted(set(payload.optionIds))
    if not option_ids:
        raise HTTPException(status_code=422, detail="Choose at least one option")
    if not poll.get("multiple_choice") and len(option_ids) != 1:
        raise HTTPException(status_code=422, detail="Choose exactly one option")
    valid = server.db.get("post_poll_options", {"poll_id": f"eq.{poll_id}", "select": "id"}) or []
    valid_ids = {str(item["id"]) for item in valid}
    if any(option_id not in valid_ids for option_id in option_ids):
        raise HTTPException(status_code=422, detail="Invalid poll option")
    server.db.delete("post_poll_votes", {"poll_id": f"eq.{poll_id}", "user_id": f"eq.{user.id}"})
    for option_id in option_ids:
        server.db.post("post_poll_votes", {"poll_id": poll_id, "option_id": option_id, "user_id": user.id})
    platform._activity(user.id, _institution_for_user(user), "poll.voted", "poll", poll_id, {"options": option_ids})
    return {"voted": True, "optionIds": option_ids}
