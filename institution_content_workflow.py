from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

import server

router = APIRouter(prefix="/v1/institutions/me/content", tags=["institution-content"])

ACTIVE_REQUEST_STATUSES = {"pending", "changes_requested", "revised"}
REVIEWABLE_STATUSES = {"pending", "revised", "changes_requested"}
PUBLISHABLE_STATUSES = {"approved", "partially_published", "published"}
POST_TYPES = {"general", "announcement", "event", "notice", "poster", "emergency"}
MEDIA_TYPES = {"image", "video", "document"}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4()}"


def institution_context(user: server.CurrentUser) -> dict[str, Any]:
    admin = server.require_institution_admin(user)
    institution_id = admin.get("institution_id")
    if not institution_id:
        raise HTTPException(status_code=403, detail="A current institution context is required")
    return {"institution_id": institution_id, "admin": admin}


def institution_row(institution_id: str) -> dict[str, Any]:
    rows = server.db.get(
        "institutions",
        {"id": f"eq.{institution_id}", "select": "id,name,city,state,country,logo_url,status", "limit": "1"},
    ) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Institution not found")
    return rows[0]


def active_admin_user_ids(institution_id: str) -> list[str]:
    rows = server.db.get(
        "institution_admins",
        {
            "institution_id": f"eq.{institution_id}",
            "status": "eq.active",
            "select": "user_id",
        },
    ) or []
    return sorted({row.get("user_id") for row in rows if row.get("user_id")})


def notify_institution(
    institution_id: str,
    *,
    title: str,
    body: str,
    event_type: str,
    request_id: str,
    exclude_user_id: Optional[str] = None,
) -> None:
    for user_id in active_admin_user_ids(institution_id):
        if user_id == exclude_user_id:
            continue
        try:
            server.db.post(
                "notifications",
                {
                    "id": new_id("notif"),
                    "user_id": user_id,
                    "title": title[:160],
                    "body": body[:500],
                    "type": "institution_post_request",
                    "data": {
                        "request_id": request_id,
                        "event_type": event_type,
                        "route": f"/institution/content-request/{request_id}",
                    },
                    "read": False,
                    "created_at": now_iso(),
                },
            )
        except Exception as exc:
            server.logger.warning("institution content notification failed: %s", type(exc).__name__)


def request_row(request_id: str) -> dict[str, Any]:
    rows = server.db.get(
        "institution_content_requests",
        {"id": f"eq.{request_id}", "select": "*", "limit": "1"},
    ) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Content request not found")
    row = rows[0]
    expires_at = row.get("expires_at")
    if expires_at and row.get("status") in ACTIVE_REQUEST_STATUSES:
        try:
            expiry = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            if expiry <= datetime.now(timezone.utc):
                patched = server.db.patch(
                    "institution_content_requests",
                    {"id": f"eq.{request_id}"},
                    {"status": "expired", "updated_at": now_iso()},
                ) or []
                if patched:
                    row = patched[0]
        except ValueError:
            pass
    return row


def require_request_party(row: dict[str, Any], institution_id: str) -> Literal["source", "target"]:
    if row.get("source_institution_id") == institution_id:
        return "source"
    if row.get("target_institution_id") == institution_id:
        return "target"
    raise HTTPException(status_code=403, detail="This request does not belong to your institution")


def add_event(
    row: dict[str, Any],
    *,
    user: server.CurrentUser,
    institution_id: str,
    event_type: str,
    message: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    return server.db.post(
        "institution_content_request_events",
        {
            "id": new_id("icre"),
            "request_id": row["id"],
            "actor_user_id": user.id,
            "actor_institution_id": institution_id,
            "event_type": event_type,
            "message": (message or "").strip()[:2000] or None,
            "metadata": metadata or {},
            "created_at": now_iso(),
        },
    )[0]


def validate_post_type(value: str) -> str:
    if value not in POST_TYPES:
        raise HTTPException(status_code=422, detail="Invalid post type")
    return value


def validate_media_type(value: Optional[str]) -> Optional[str]:
    if value is not None and value not in MEDIA_TYPES:
        raise HTTPException(status_code=422, detail="Invalid media type")
    return value


def validate_group_for_institution(group_id: str, institution_id: str) -> dict[str, Any]:
    rows = server.db.get(
        "groups",
        {
            "id": f"eq.{group_id}",
            "institution_id": f"eq.{institution_id}",
            "deleted_at": "is.null",
            "select": "id,name,institution_id,allow_external_post_requests",
            "limit": "1",
        },
    ) or []
    if not rows:
        raise HTTPException(status_code=403, detail="Selected group does not belong to your institution")
    return rows[0]


class RequestCreateDto(BaseModel):
    targetInstitutionId: str = Field(..., min_length=1, max_length=120)
    title: str = Field(..., min_length=1, max_length=180)
    content: str = Field(..., min_length=1, max_length=12000)
    category: str = Field(default="general", min_length=1, max_length=60)
    postType: str = Field(default="general", max_length=40)
    mediaUrl: Optional[str] = Field(default=None, max_length=2000)
    mediaType: Optional[str] = Field(default=None, max_length=30)
    tags: list[str] = Field(default_factory=list, max_length=20)
    requestedDestination: Literal["recipient_choice", "feed", "groups"] = "recipient_choice"
    requestedGroupIds: list[str] = Field(default_factory=list, max_length=20)
    commentsEnabled: bool = True
    reactionsEnabled: bool = True
    pinRequested: bool = False
    requestedPublishAt: Optional[str] = None
    expiresAt: Optional[str] = None
    sourcePostId: Optional[str] = None
    message: Optional[str] = Field(default=None, max_length=2000)


class RequestMessageDto(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


class RequestRevisionDto(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=180)
    content: Optional[str] = Field(default=None, min_length=1, max_length=12000)
    category: Optional[str] = Field(default=None, min_length=1, max_length=60)
    postType: Optional[str] = Field(default=None, max_length=40)
    mediaUrl: Optional[str] = Field(default=None, max_length=2000)
    mediaType: Optional[str] = Field(default=None, max_length=30)
    tags: Optional[list[str]] = Field(default=None, max_length=20)
    message: str = Field(..., min_length=1, max_length=2000)


class PublishDestinationDto(BaseModel):
    type: Literal["feed", "group"]
    groupId: Optional[str] = None


class PublishRequestDto(BaseModel):
    destinations: list[PublishDestinationDto] = Field(..., min_length=1, max_length=20)
    scheduledAt: Optional[str] = None
    complete: bool = True


class DirectPostCreateDto(BaseModel):
    title: Optional[str] = Field(default=None, max_length=180)
    content: str = Field(..., min_length=1, max_length=12000)
    postType: str = Field(default="general", max_length=40)
    mediaUrl: Optional[str] = Field(default=None, max_length=2000)
    mediaType: Optional[str] = Field(default=None, max_length=30)
    destinations: list[PublishDestinationDto] = Field(..., min_length=1, max_length=20)
    commentsEnabled: bool = True
    reactionsEnabled: bool = True
    pinned: bool = False
    scheduledAt: Optional[str] = None
    expiresAt: Optional[str] = None


class DraftDto(BaseModel):
    id: Optional[str] = None
    title: str = Field(default="", max_length=180)
    content: str = Field(default="", max_length=12000)
    category: str = Field(default="general", max_length=60)
    postType: str = Field(default="general", max_length=40)
    mediaUrl: Optional[str] = Field(default=None, max_length=2000)
    mediaType: Optional[str] = Field(default=None, max_length=30)
    tags: list[str] = Field(default_factory=list, max_length=20)
    editorState: dict[str, Any] = Field(default_factory=dict)


@router.get("/directory")
def institution_directory(
    q: Optional[str] = Query(default=None, max_length=80),
    user: server.CurrentUser = Depends(server.current_user),
) -> Any:
    ctx = institution_context(user)
    params: dict[str, Any] = {
        "status": "eq.approved",
        "select": "id,name,city,state,country,logo_url,status",
        "order": "name.asc",
        "limit": "100",
    }
    if q and q.strip():
        safe_q = q.strip().replace("%", "").replace(",", " ")
        params["name"] = f"ilike.%{safe_q}%"
    rows = server.db.get("institutions", params) or []
    return [row for row in rows if row.get("id") != ctx["institution_id"]]


@router.get("/overview")
def content_overview(user: server.CurrentUser = Depends(server.current_user)) -> Any:
    ctx = institution_context(user)
    iid = ctx["institution_id"]
    inbox = server.db.get("institution_content_requests", {"target_institution_id": f"eq.{iid}", "select": "id,status"}) or []
    sent = server.db.get("institution_content_requests", {"source_institution_id": f"eq.{iid}", "select": "id,status"}) or []
    drafts = server.db.get("institution_content_drafts", {"institution_id": f"eq.{iid}", "select": "id"}) or []
    return {
        "inboxPending": sum(1 for row in inbox if row.get("status") in REVIEWABLE_STATUSES),
        "sentPending": sum(1 for row in sent if row.get("status") in ACTIVE_REQUEST_STATUSES),
        "approvedReady": sum(1 for row in inbox if row.get("status") == "approved"),
        "drafts": len(drafts),
    }


@router.get("/requests")
def list_requests(
    box: Literal["inbox", "sent"] = "inbox",
    status: Optional[str] = Query(default=None, max_length=40),
    user: server.CurrentUser = Depends(server.current_user),
) -> Any:
    ctx = institution_context(user)
    field = "target_institution_id" if box == "inbox" else "source_institution_id"
    params: dict[str, Any] = {
        field: f"eq.{ctx['institution_id']}",
        "select": "*",
        "order": "created_at.desc",
        "limit": "200",
    }
    if status and status != "all":
        params["status"] = f"eq.{status}"
    rows = server.db.get("institution_content_requests", params) or []
    institution_ids = {row.get("source_institution_id") for row in rows} | {row.get("target_institution_id") for row in rows}
    names: dict[str, dict[str, Any]] = {}
    for iid in institution_ids:
        if not iid:
            continue
        try:
            names[iid] = institution_row(iid)
        except HTTPException:
            continue
    for row in rows:
        row["sourceInstitution"] = names.get(row.get("source_institution_id"))
        row["targetInstitution"] = names.get(row.get("target_institution_id"))
    return rows


@router.post("/requests")
def create_request(payload: RequestCreateDto, user: server.CurrentUser = Depends(server.current_user)) -> Any:
    ctx = institution_context(user)
    source_id = ctx["institution_id"]
    target_id = payload.targetInstitutionId.strip()
    if source_id == target_id:
        raise HTTPException(status_code=422, detail="Use direct publishing for your own institution")
    target = institution_row(target_id)
    if target.get("status") != "approved":
        raise HTTPException(status_code=409, detail="Target institution is not available for content requests")
    validate_post_type(payload.postType)
    validate_media_type(payload.mediaType)
    if payload.requestedGroupIds:
        for group_id in payload.requestedGroupIds:
            group = validate_group_for_institution(group_id, target_id)
            if group.get("allow_external_post_requests") is False:
                raise HTTPException(status_code=409, detail=f"{group.get('name') or 'Selected group'} does not accept external post requests")
    source_post_id = payload.sourcePostId
    if source_post_id:
        own_post = server.db.get(
            "posts",
            {"id": f"eq.{source_post_id}", "institution_id": f"eq.{source_id}", "select": "id", "limit": "1"},
        ) or []
        if not own_post:
            raise HTTPException(status_code=403, detail="Source post does not belong to your institution")
    row = server.db.post(
        "institution_content_requests",
        {
            "id": new_id("icr"),
            "source_institution_id": source_id,
            "target_institution_id": target_id,
            "created_by": user.id,
            "source_post_id": source_post_id,
            "title": payload.title.strip(),
            "content": payload.content.strip(),
            "category": payload.category.strip(),
            "post_type": payload.postType,
            "media_url": payload.mediaUrl,
            "media_type": payload.mediaType,
            "tags": [tag.strip()[:40] for tag in payload.tags if tag.strip()][:20],
            "requested_destination": payload.requestedDestination,
            "requested_group_ids": payload.requestedGroupIds,
            "comments_enabled": payload.commentsEnabled,
            "reactions_enabled": payload.reactionsEnabled,
            "pin_requested": payload.pinRequested,
            "requested_publish_at": payload.requestedPublishAt,
            "expires_at": payload.expiresAt,
            "status": "pending",
            "revision": 1,
            "latest_message": (payload.message or "").strip() or None,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        },
    )[0]
    add_event(row, user=user, institution_id=source_id, event_type="created", message=payload.message)
    source = institution_row(source_id)
    notify_institution(
        target_id,
        title="New institution post request",
        body=f"{source.get('name', 'An institution')} sent “{row['title']}” for review.",
        event_type="created",
        request_id=row["id"],
    )
    return row


@router.get("/requests/{request_id}")
def get_request(request_id: str, user: server.CurrentUser = Depends(server.current_user)) -> Any:
    ctx = institution_context(user)
    row = request_row(request_id)
    side = require_request_party(row, ctx["institution_id"])
    events = server.db.get(
        "institution_content_request_events",
        {"request_id": f"eq.{request_id}", "select": "*", "order": "created_at.asc"},
    ) or []
    publications = server.db.get(
        "institution_content_publications",
        {"request_id": f"eq.{request_id}", "select": "*", "order": "created_at.asc"},
    ) or []
    return {
        **row,
        "side": side,
        "sourceInstitution": institution_row(row["source_institution_id"]),
        "targetInstitution": institution_row(row["target_institution_id"]),
        "events": events,
        "publications": publications,
    }


@router.post("/requests/{request_id}/message")
def message_request(request_id: str, payload: RequestMessageDto, user: server.CurrentUser = Depends(server.current_user)) -> Any:
    ctx = institution_context(user)
    row = request_row(request_id)
    side = require_request_party(row, ctx["institution_id"])
    if row.get("status") in {"rejected", "withdrawn", "expired"}:
        raise HTTPException(status_code=409, detail="This request is closed")
    message = payload.message.strip()
    server.db.patch(
        "institution_content_requests",
        {"id": f"eq.{request_id}"},
        {"latest_message": message, "updated_at": now_iso()},
    )
    event = add_event(row, user=user, institution_id=ctx["institution_id"], event_type="message", message=message)
    notify_id = row["target_institution_id"] if side == "source" else row["source_institution_id"]
    notify_institution(
        notify_id,
        title="Post request message",
        body=message,
        event_type="message",
        request_id=request_id,
        exclude_user_id=user.id,
    )
    return event


@router.post("/requests/{request_id}/request-changes")
def request_changes(request_id: str, payload: RequestMessageDto, user: server.CurrentUser = Depends(server.current_user)) -> Any:
    ctx = institution_context(user)
    row = request_row(request_id)
    side = require_request_party(row, ctx["institution_id"])
    if side != "target":
        raise HTTPException(status_code=403, detail="Only the receiving institution can request changes")
    if row.get("status") not in {"pending", "revised"}:
        raise HTTPException(status_code=409, detail="Changes cannot be requested in the current status")
    message = payload.message.strip()
    updated = server.db.patch(
        "institution_content_requests",
        {"id": f"eq.{request_id}", "target_institution_id": f"eq.{ctx['institution_id']}"},
        {"status": "changes_requested", "latest_message": message, "updated_at": now_iso()},
    )[0]
    add_event(updated, user=user, institution_id=ctx["institution_id"], event_type="changes_requested", message=message)
    notify_institution(
        row["source_institution_id"],
        title="Changes requested",
        body=message,
        event_type="changes_requested",
        request_id=request_id,
    )
    return updated


@router.post("/requests/{request_id}/revise")
def revise_request(request_id: str, payload: RequestRevisionDto, user: server.CurrentUser = Depends(server.current_user)) -> Any:
    ctx = institution_context(user)
    row = request_row(request_id)
    side = require_request_party(row, ctx["institution_id"])
    if side != "source":
        raise HTTPException(status_code=403, detail="Only the sending institution can submit a revision")
    if row.get("status") != "changes_requested":
        raise HTTPException(status_code=409, detail="A revision is only allowed after changes are requested")
    patch: dict[str, Any] = {
        "status": "revised",
        "revision": int(row.get("revision") or 1) + 1,
        "latest_message": payload.message.strip(),
        "updated_at": now_iso(),
    }
    if payload.title is not None:
        patch["title"] = payload.title.strip()
    if payload.content is not None:
        patch["content"] = payload.content.strip()
    if payload.category is not None:
        patch["category"] = payload.category.strip()
    if payload.postType is not None:
        patch["post_type"] = validate_post_type(payload.postType)
    if payload.mediaUrl is not None:
        patch["media_url"] = payload.mediaUrl
    if payload.mediaType is not None:
        patch["media_type"] = validate_media_type(payload.mediaType)
    if payload.tags is not None:
        patch["tags"] = [tag.strip()[:40] for tag in payload.tags if tag.strip()][:20]
    updated = server.db.patch(
        "institution_content_requests",
        {"id": f"eq.{request_id}", "source_institution_id": f"eq.{ctx['institution_id']}"},
        patch,
    )[0]
    add_event(updated, user=user, institution_id=ctx["institution_id"], event_type="revised", message=payload.message, metadata={"revision": updated["revision"]})
    notify_institution(
        row["target_institution_id"],
        title="Post request revised",
        body=payload.message,
        event_type="revised",
        request_id=request_id,
    )
    return updated


@router.post("/requests/{request_id}/approve")
def approve_request(request_id: str, payload: Optional[RequestMessageDto] = None, user: server.CurrentUser = Depends(server.current_user)) -> Any:
    ctx = institution_context(user)
    row = request_row(request_id)
    side = require_request_party(row, ctx["institution_id"])
    if side != "target":
        raise HTTPException(status_code=403, detail="Only the receiving institution can approve this request")
    if row.get("status") not in {"pending", "revised"}:
        raise HTTPException(status_code=409, detail="Request cannot be approved in the current status")
    message = (payload.message if payload else "") or "Approved"
    updated = server.db.patch(
        "institution_content_requests",
        {"id": f"eq.{request_id}", "target_institution_id": f"eq.{ctx['institution_id']}"},
        {
            "status": "approved",
            "approved_by": user.id,
            "approved_at": now_iso(),
            "latest_message": message.strip()[:2000],
            "updated_at": now_iso(),
        },
    )[0]
    add_event(updated, user=user, institution_id=ctx["institution_id"], event_type="approved", message=message)
    notify_institution(
        row["source_institution_id"],
        title="Post request approved",
        body=f"{institution_row(ctx['institution_id']).get('name', 'The institution')} approved “{row['title']}”.",
        event_type="approved",
        request_id=request_id,
    )
    return updated


@router.post("/requests/{request_id}/reject")
def reject_request(request_id: str, payload: RequestMessageDto, user: server.CurrentUser = Depends(server.current_user)) -> Any:
    ctx = institution_context(user)
    row = request_row(request_id)
    side = require_request_party(row, ctx["institution_id"])
    if side != "target":
        raise HTTPException(status_code=403, detail="Only the receiving institution can reject this request")
    if row.get("status") not in REVIEWABLE_STATUSES:
        raise HTTPException(status_code=409, detail="Request cannot be rejected in the current status")
    message = payload.message.strip()
    updated = server.db.patch(
        "institution_content_requests",
        {"id": f"eq.{request_id}", "target_institution_id": f"eq.{ctx['institution_id']}"},
        {
            "status": "rejected",
            "rejected_by": user.id,
            "rejected_at": now_iso(),
            "latest_message": message,
            "updated_at": now_iso(),
        },
    )[0]
    add_event(updated, user=user, institution_id=ctx["institution_id"], event_type="rejected", message=message)
    notify_institution(
        row["source_institution_id"],
        title="Post request rejected",
        body=message,
        event_type="rejected",
        request_id=request_id,
    )
    return updated


@router.post("/requests/{request_id}/withdraw")
def withdraw_request(request_id: str, payload: Optional[RequestMessageDto] = None, user: server.CurrentUser = Depends(server.current_user)) -> Any:
    ctx = institution_context(user)
    row = request_row(request_id)
    side = require_request_party(row, ctx["institution_id"])
    if side != "source":
        raise HTTPException(status_code=403, detail="Only the sending institution can withdraw this request")
    if row.get("status") not in ACTIVE_REQUEST_STATUSES:
        raise HTTPException(status_code=409, detail="Request cannot be withdrawn in the current status")
    message = (payload.message if payload else "") or "Request withdrawn"
    updated = server.db.patch(
        "institution_content_requests",
        {"id": f"eq.{request_id}", "source_institution_id": f"eq.{ctx['institution_id']}"},
        {"status": "withdrawn", "withdrawn_by": user.id, "withdrawn_at": now_iso(), "latest_message": message, "updated_at": now_iso()},
    )[0]
    add_event(updated, user=user, institution_id=ctx["institution_id"], event_type="withdrawn", message=message)
    notify_institution(row["target_institution_id"], title="Post request withdrawn", body=message, event_type="withdrawn", request_id=request_id)
    return updated


def create_post_for_destination(
    *,
    institution_id: str,
    user: server.CurrentUser,
    title: Optional[str],
    content: str,
    post_type: str,
    media_url: Optional[str],
    media_type: Optional[str],
    comments_enabled: bool,
    reactions_enabled: bool,
    pinned: bool,
    destination: PublishDestinationDto,
    scheduled_at: Optional[str],
    expires_at: Optional[str],
) -> dict[str, Any]:
    group_id: Optional[str] = None
    visibility = "public"
    if destination.type == "group":
        if not destination.groupId:
            raise HTTPException(status_code=422, detail="groupId is required for a group destination")
        validate_group_for_institution(destination.groupId, institution_id)
        group_id = destination.groupId
        visibility = "group"
    status = "scheduled" if scheduled_at else "published"
    created = server.db.post(
        "posts",
        {
            "id": new_id("post"),
            "author_id": user.id,
            "institution_id": institution_id,
            "group_id": group_id,
            "type": validate_post_type(post_type),
            "visibility": visibility,
            "status": status,
            "title": title.strip() if title else None,
            "content": content.strip(),
            "media_url": media_url,
            "media_type": validate_media_type(media_type),
            "pinned": pinned,
            "comments_enabled": comments_enabled,
            "reactions_enabled": reactions_enabled,
            "scheduled_at": scheduled_at,
            "published_at": None if scheduled_at else now_iso(),
            "expires_at": expires_at,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        },
    )[0]
    return created


@router.post("/requests/{request_id}/publish")
def publish_request(request_id: str, payload: PublishRequestDto, user: server.CurrentUser = Depends(server.current_user)) -> Any:
    ctx = institution_context(user)
    row = request_row(request_id)
    side = require_request_party(row, ctx["institution_id"])
    if side != "target":
        raise HTTPException(status_code=403, detail="Only the receiving institution can publish an approved request")
    if row.get("status") not in PUBLISHABLE_STATUSES:
        raise HTTPException(status_code=409, detail="Approve the request before publishing")

    unique_keys: set[str] = set()
    destinations: list[tuple[str, PublishDestinationDto]] = []
    for destination in payload.destinations:
        key = "feed" if destination.type == "feed" else f"group:{destination.groupId or ''}"
        if key in unique_keys:
            continue
        unique_keys.add(key)
        if destination.type == "group":
            if not destination.groupId:
                raise HTTPException(status_code=422, detail="groupId is required for a group destination")
            validate_group_for_institution(destination.groupId, ctx["institution_id"])
        destinations.append((key, destination))

    results: list[dict[str, Any]] = []
    for key, destination in destinations:
        existing = server.db.get(
            "institution_content_publications",
            {"request_id": f"eq.{request_id}", "destination_key": f"eq.{key}", "select": "*", "limit": "1"},
        ) or []
        if existing:
            results.append({"publication": existing[0], "duplicate": True})
            continue
        post = create_post_for_destination(
            institution_id=ctx["institution_id"],
            user=user,
            title=row.get("title"),
            content=row.get("content") or "",
            post_type=row.get("post_type") or "general",
            media_url=row.get("media_url"),
            media_type=row.get("media_type"),
            comments_enabled=bool(row.get("comments_enabled", True)),
            reactions_enabled=bool(row.get("reactions_enabled", True)),
            pinned=bool(row.get("pin_requested", False)),
            destination=destination,
            scheduled_at=payload.scheduledAt,
            expires_at=row.get("expires_at"),
        )
        publication = server.db.post(
            "institution_content_publications",
            {
                "id": new_id("icp"),
                "request_id": request_id,
                "target_institution_id": ctx["institution_id"],
                "published_by": user.id,
                "destination_type": destination.type,
                "destination_key": key,
                "group_id": destination.groupId if destination.type == "group" else None,
                "post_id": post["id"],
                "created_at": now_iso(),
            },
        )[0]
        results.append({"publication": publication, "post": post, "duplicate": False})

    next_status = "published" if payload.complete else "partially_published"
    server.db.patch(
        "institution_content_requests",
        {"id": f"eq.{request_id}", "target_institution_id": f"eq.{ctx['institution_id']}"},
        {"status": next_status, "updated_at": now_iso()},
    )
    add_event(row, user=user, institution_id=ctx["institution_id"], event_type="published", message=f"Published to {len(destinations)} destination(s)", metadata={"destinations": [key for key, _ in destinations]})
    notify_institution(
        row["source_institution_id"],
        title="Your post request was published",
        body=f"“{row['title']}” is now available from {institution_row(ctx['institution_id']).get('name', 'the receiving institution')}.",
        event_type="published",
        request_id=request_id,
    )
    return {"status": next_status, "results": results}


@router.post("/posts")
def create_direct_post(payload: DirectPostCreateDto, user: server.CurrentUser = Depends(server.current_user)) -> Any:
    ctx = institution_context(user)
    validate_post_type(payload.postType)
    validate_media_type(payload.mediaType)
    seen: set[str] = set()
    posts: list[dict[str, Any]] = []
    for destination in payload.destinations:
        key = "feed" if destination.type == "feed" else f"group:{destination.groupId or ''}"
        if key in seen:
            continue
        seen.add(key)
        posts.append(
            create_post_for_destination(
                institution_id=ctx["institution_id"],
                user=user,
                title=payload.title,
                content=payload.content,
                post_type=payload.postType,
                media_url=payload.mediaUrl,
                media_type=payload.mediaType,
                comments_enabled=payload.commentsEnabled,
                reactions_enabled=payload.reactionsEnabled,
                pinned=payload.pinned,
                destination=destination,
                scheduled_at=payload.scheduledAt,
                expires_at=payload.expiresAt,
            )
        )
    return {"posts": posts, "count": len(posts)}


@router.get("/drafts")
def list_drafts(user: server.CurrentUser = Depends(server.current_user)) -> Any:
    ctx = institution_context(user)
    return server.db.get(
        "institution_content_drafts",
        {"institution_id": f"eq.{ctx['institution_id']}", "select": "*", "order": "updated_at.desc", "limit": "100"},
    ) or []


@router.post("/drafts")
def save_draft(payload: DraftDto, user: server.CurrentUser = Depends(server.current_user)) -> Any:
    ctx = institution_context(user)
    validate_post_type(payload.postType)
    validate_media_type(payload.mediaType)
    draft_id = payload.id or new_id("icd")
    data = {
        "institution_id": ctx["institution_id"],
        "created_by": user.id,
        "title": payload.title,
        "content": payload.content,
        "category": payload.category,
        "post_type": payload.postType,
        "media_url": payload.mediaUrl,
        "media_type": payload.mediaType,
        "tags": [tag.strip()[:40] for tag in payload.tags if tag.strip()][:20],
        "editor_state": payload.editorState,
        "updated_at": now_iso(),
    }
    existing = server.db.get(
        "institution_content_drafts",
        {"id": f"eq.{draft_id}", "institution_id": f"eq.{ctx['institution_id']}", "select": "id", "limit": "1"},
    ) or []
    if existing:
        return server.db.patch(
            "institution_content_drafts",
            {"id": f"eq.{draft_id}", "institution_id": f"eq.{ctx['institution_id']}"},
            data,
        )[0]
    data.update({"id": draft_id, "created_at": now_iso()})
    return server.db.post("institution_content_drafts", data)[0]


@router.delete("/drafts/{draft_id}")
def delete_draft(draft_id: str, user: server.CurrentUser = Depends(server.current_user)) -> Any:
    ctx = institution_context(user)
    deleted = server.db.delete(
        "institution_content_drafts",
        {"id": f"eq.{draft_id}", "institution_id": f"eq.{ctx['institution_id']}"},
    ) or []
    if not deleted:
        raise HTTPException(status_code=404, detail="Draft not found")
    return {"deleted": True}
