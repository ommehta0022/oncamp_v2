from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import server

router = APIRouter(prefix="/v1/campus/institution/studio", tags=["institution-studio-operations"])


def context(user: server.CurrentUser) -> tuple[str, str]:
    admin = server.require_institution_admin(user)
    iid = admin.get("institution_id")
    if not iid:
        raise HTTPException(status_code=403, detail="Approved institution administrator required")
    return str(iid), user.id


def owned(table: str, item_id: str, institution_id: str) -> dict[str, Any]:
    rows = server.safe_get(table, {"id": f"eq.{item_id}", "institution_id": f"eq.{institution_id}", "select": "*", "limit": "1"}) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Institution item not found")
    return rows[0]


class OpportunityPatch(BaseModel):
    kind: Optional[str] = Field(default=None, max_length=80)
    title: Optional[str] = Field(default=None, max_length=180)
    organization: Optional[str] = Field(default=None, max_length=180)
    description: Optional[str] = Field(default=None, max_length=8000)
    location: Optional[str] = Field(default=None, max_length=300)
    applyUrl: Optional[str] = Field(default=None, max_length=2000)
    deadline: Optional[str] = None
    status: Optional[str] = Field(default=None, max_length=30)
    metadata: Optional[dict[str, Any]] = None


class AnnouncementPatch(BaseModel):
    coverUrl: Optional[str] = Field(default=None, max_length=2000)
    metadata: Optional[dict[str, Any]] = None


class DepartmentStudioPatch(BaseModel):
    logoUrl: Optional[str] = Field(default=None, max_length=2000)
    coverUrl: Optional[str] = Field(default=None, max_length=2000)
    headStaffId: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    sortOrder: Optional[int] = Field(default=None, ge=0, le=100000)


class PlacePatch(BaseModel):
    name: Optional[str] = Field(default=None, max_length=180)
    category: Optional[str] = Field(default=None, max_length=80)
    description: Optional[str] = Field(default=None, max_length=2000)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    floor: Optional[str] = Field(default=None, max_length=30)
    metadata: Optional[dict[str, Any]] = None


class GroupStudioPatch(BaseModel):
    departmentId: Optional[str] = None
    studioCategory: Optional[str] = Field(default=None, max_length=80)
    featured: Optional[bool] = None
    avatarUrl: Optional[str] = Field(default=None, max_length=2000)


@router.patch("/announcements/{item_id}")
def update_announcement_media(item_id: str, payload: AnnouncementPatch, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid, _ = context(user)
    current = owned("scheduled_announcements", item_id, iid)
    data: dict[str, Any] = {}
    if "coverUrl" in payload.model_fields_set:
        data["cover_url"] = payload.coverUrl
    if "metadata" in payload.model_fields_set:
        data["metadata"] = payload.metadata or {}
    rows = server.db.patch("scheduled_announcements", {"id": f"eq.{item_id}", "institution_id": f"eq.{iid}"}, data) or []
    published_post_id = current.get("published_post_id")
    if published_post_id and "coverUrl" in payload.model_fields_set:
        server.db.patch(
            "posts",
            {"id": f"eq.{published_post_id}", "institution_id": f"eq.{iid}"},
            {"media_url": payload.coverUrl, "media_type": "image" if payload.coverUrl else None},
        )
    return rows[0] if rows else owned("scheduled_announcements", item_id, iid)


@router.patch("/departments/{item_id}")
def update_department_media(item_id: str, payload: DepartmentStudioPatch, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid, _ = context(user)
    owned("institution_departments", item_id, iid)
    mapping = {
        "logoUrl": "logo_url",
        "coverUrl": "cover_url",
        "headStaffId": "head_staff_id",
        "metadata": "metadata",
        "sortOrder": "sort_order",
    }
    data = {mapping[k]: v for k, v in payload.model_dump(exclude_unset=True).items() if k in mapping}
    rows = server.db.patch("institution_departments", {"id": f"eq.{item_id}", "institution_id": f"eq.{iid}"}, data) or []
    return rows[0] if rows else owned("institution_departments", item_id, iid)


@router.get("/opportunities")
def list_opportunities(user: server.CurrentUser = Depends(server.current_user)) -> list[dict[str, Any]]:
    iid, _ = context(user)
    return server.safe_get("campus_opportunities", {"institution_id": f"eq.{iid}", "select": "*", "order": "created_at.desc", "limit": "500"}) or []


@router.patch("/opportunities/{item_id}")
def update_opportunity(item_id: str, payload: OpportunityPatch, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid, _ = context(user); owned("campus_opportunities", item_id, iid)
    mapping = {"kind": "kind", "title": "title", "organization": "organization", "description": "description", "location": "location", "applyUrl": "apply_url", "deadline": "deadline", "status": "status", "metadata": "metadata"}
    data = {mapping[k]: v for k, v in payload.model_dump(exclude_unset=True).items() if k in mapping}
    rows = server.db.patch("campus_opportunities", {"id": f"eq.{item_id}", "institution_id": f"eq.{iid}"}, data) or []
    return rows[0] if rows else owned("campus_opportunities", item_id, iid)


@router.delete("/opportunities/{item_id}")
def archive_opportunity(item_id: str, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid, _ = context(user); owned("campus_opportunities", item_id, iid)
    server.db.patch("campus_opportunities", {"id": f"eq.{item_id}", "institution_id": f"eq.{iid}"}, {"status": "archived"})
    return {"success": True}


@router.get("/groups")
def studio_groups(user: server.CurrentUser = Depends(server.current_user)) -> list[dict[str, Any]]:
    iid, _ = context(user)
    rows = server.safe_get("groups", {"institution_id": f"eq.{iid}", "deleted_at": "is.null", "select": "*", "order": "featured.desc,created_at.desc", "limit": "500"}) or []
    ids = [row.get("id") for row in rows if row.get("id")]
    counts: dict[str, int] = {}
    if ids:
        safe_ids = [value for value in ids if "," not in value and "(" not in value and ")" not in value]
        members = server.safe_get("group_members", {"group_id": f"in.({','.join(safe_ids)})", "select": "group_id", "limit": "10000"}) or []
        for member in members:
            gid = member.get("group_id")
            if gid: counts[gid] = counts.get(gid, 0) + 1
    return [{**row, "memberCount": counts.get(row.get("id"), 0)} for row in rows]


@router.patch("/groups/{group_id}")
def patch_studio_group(group_id: str, payload: GroupStudioPatch, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid, _ = context(user); owned("groups", group_id, iid)
    mapping = {"departmentId": "department_id", "studioCategory": "studio_category", "featured": "featured", "avatarUrl": "avatar_url"}
    data = {mapping[k]: v for k, v in payload.model_dump(exclude_unset=True).items() if k in mapping}
    rows = server.db.patch("groups", {"id": f"eq.{group_id}", "institution_id": f"eq.{iid}"}, data) or []
    return rows[0] if rows else owned("groups", group_id, iid)


@router.get("/places")
def list_places(user: server.CurrentUser = Depends(server.current_user)) -> list[dict[str, Any]]:
    iid, _ = context(user)
    return server.safe_get("campus_places", {"institution_id": f"eq.{iid}", "select": "*", "order": "name.asc", "limit": "500"}) or []


@router.patch("/places/{item_id}")
def update_place(item_id: str, payload: PlacePatch, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid, _ = context(user); owned("campus_places", item_id, iid)
    mapping = {"name": "name", "category": "category", "description": "description", "latitude": "latitude", "longitude": "longitude", "floor": "floor", "metadata": "metadata"}
    data = {mapping[k]: v for k, v in payload.model_dump(exclude_unset=True).items() if k in mapping}
    rows = server.db.patch("campus_places", {"id": f"eq.{item_id}", "institution_id": f"eq.{iid}"}, data) or []
    return rows[0] if rows else owned("campus_places", item_id, iid)


@router.delete("/places/{item_id}")
def delete_place(item_id: str, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid, _ = context(user); owned("campus_places", item_id, iid)
    server.db.delete("campus_places", {"id": f"eq.{item_id}", "institution_id": f"eq.{iid}"})
    return {"success": True}
