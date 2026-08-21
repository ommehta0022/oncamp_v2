from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

import server

router = APIRouter(prefix="/v1/campus", tags=["institution-studio"])
PUBLIC_BUCKET = "institution-public"
PUBLIC_MEDIA_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "video/mp4", "video/quicktime", "video/webm",
}
MAX_PUBLIC_MEDIA_BYTES = 50 * 1024 * 1024


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


def get_rows(table: str, params: dict[str, Any]) -> list[dict[str, Any]]:
    rows = server.safe_get(table, params)
    return rows if isinstance(rows, list) else []


def require_admin(user: server.CurrentUser) -> dict[str, Any]:
    admin = server.require_institution_admin(user)
    institution_id = admin.get("institution_id")
    if not institution_id:
        raise HTTPException(status_code=403, detail="An approved institution is required")
    return admin


def institution_or_404(institution_id: str, approved_only: bool = False) -> dict[str, Any]:
    params: dict[str, Any] = {"id": f"eq.{institution_id}", "select": "*", "limit": "1"}
    if approved_only:
        params["status"] = "eq.approved"
    rows = get_rows("institutions", params)
    if not rows:
        raise HTTPException(status_code=404, detail="Institution not found")
    return rows[0]


def ids_filter(values: list[str]) -> str:
    safe = [value for value in values if value and "," not in value and "(" not in value and ")" not in value]
    return f"in.({','.join(safe)})" if safe else "eq.__none__"


def counts_by(rows: list[dict[str, Any]], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for row in rows:
        value = row.get(key)
        if value:
            counts[value] = counts.get(value, 0) + 1
    return counts


def public_institution(row: dict[str, Any], counts: Optional[dict[str, int]] = None, following: bool = False) -> dict[str, Any]:
    counts = counts or {}
    return {
        "id": row.get("id"),
        "name": row.get("name"),
        "type": row.get("institution_type") or "Institution",
        "city": row.get("city"),
        "state": row.get("state"),
        "country": row.get("country"),
        "logoUrl": row.get("logo_url"),
        "coverUrl": row.get("cover_url"),
        "tagline": row.get("tagline"),
        "shortDescription": row.get("short_description") or row.get("description"),
        "description": row.get("description"),
        "website": row.get("website"),
        "establishedYear": row.get("established_year"),
        "verified": bool(row.get("verified_at")) or row.get("status") == "approved",
        "verifiedAt": row.get("verified_at"),
        "accreditation": row.get("accreditation") or [],
        "rankings": row.get("rankings") or [],
        "publicStats": row.get("public_stats") or {},
        "socialLinks": row.get("social_links") or {},
        "publicConfig": row.get("public_config") or {},
        "followersCount": counts.get("followers", 0),
        "groupsCount": counts.get("groups", 0),
        "eventsCount": counts.get("events", 0),
        "isFollowing": following,
    }


def build_public_bundle(institution_id: str, user_id: Optional[str] = None) -> dict[str, Any]:
    institution = institution_or_404(institution_id, approved_only=True)
    followers = get_rows("institution_followers", {"institution_id": f"eq.{institution_id}", "select": "user_id"})
    groups = get_rows("groups", {
        "institution_id": f"eq.{institution_id}", "deleted_at": "is.null", "visibility": "eq.public",
        "select": "id,name,description,category,avatar_url,official,is_official,join_policy,member_limit,department_id,studio_category,featured,created_at",
        "order": "featured.desc,created_at.desc", "limit": "100",
    })
    group_ids = [g["id"] for g in groups if g.get("id")]
    members = get_rows("group_members", {"group_id": ids_filter(group_ids), "select": "group_id"}) if group_ids else []
    member_counts = counts_by(members, "group_id")
    for group in groups:
        group["memberCount"] = member_counts.get(group.get("id"), 0)
        group["verified"] = bool(group.get("official") or group.get("is_official"))

    events = get_rows("campus_events", {
        "institution_id": f"eq.{institution_id}", "status": "eq.published",
        "select": "*", "order": "start_at.asc", "limit": "50",
    })
    opportunities = get_rows("campus_opportunities", {
        "institution_id": f"eq.{institution_id}", "status": "eq.published",
        "select": "*", "order": "deadline.asc", "limit": "50",
    })
    announcements = get_rows("scheduled_announcements", {
        "institution_id": f"eq.{institution_id}", "status": "eq.published",
        "select": "*", "order": "publish_at.desc", "limit": "30",
    })
    departments = get_rows("institution_departments", {
        "institution_id": f"eq.{institution_id}", "active": "eq.true",
        "select": "*", "order": "sort_order.asc,name.asc", "limit": "100",
    })
    story = get_rows("institution_story_milestones", {
        "institution_id": f"eq.{institution_id}", "published": "eq.true",
        "select": "*", "order": "sort_order.asc,year.asc", "limit": "100",
    })
    gallery = get_rows("institution_profile_media", {
        "institution_id": f"eq.{institution_id}", "published": "eq.true",
        "select": "*", "order": "featured.desc,sort_order.asc,created_at.desc", "limit": "100",
    })
    sections = get_rows("institution_profile_sections", {
        "institution_id": f"eq.{institution_id}", "enabled": "eq.true",
        "select": "*", "order": "sort_order.asc", "limit": "100",
    })
    programs = get_rows("institution_programs", {
        "institution_id": f"eq.{institution_id}", "status": "eq.published",
        "select": "*", "order": "sort_order.asc,name.asc", "limit": "100",
    })
    achievements = get_rows("institution_achievements", {
        "institution_id": f"eq.{institution_id}", "published": "eq.true",
        "select": "*", "order": "featured.desc,sort_order.asc,created_at.desc", "limit": "100",
    })
    places = get_rows("campus_places", {
        "institution_id": f"eq.{institution_id}", "select": "*", "order": "name.asc", "limit": "100",
    })
    staff = get_rows("institution_staff", {
        "institution_id": f"eq.{institution_id}", "status": "eq.active",
        "select": "id,name,title,department_id,metadata", "order": "name.asc", "limit": "30",
    })
    following = bool(user_id and any(row.get("user_id") == user_id for row in followers))
    profile = public_institution(
        institution,
        {"followers": len(followers), "groups": len(groups), "events": len(events)},
        following,
    )
    return {
        "institution": profile,
        "story": story,
        "gallery": gallery,
        "sections": sections,
        "groups": groups,
        "departments": departments,
        "events": events,
        "announcements": announcements,
        "opportunities": opportunities,
        "programs": programs,
        "achievements": achievements,
        "places": places,
        "staffHighlights": staff,
    }


@router.get("/directory/institutions")
def directory_institutions(
    q: str = "",
    type: str = "",
    city: str = "",
    verified: bool = False,
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=5000),
    user: server.CurrentUser = Depends(server.current_user),
) -> dict[str, Any]:
    params: dict[str, Any] = {
        "status": "eq.approved",
        "select": "*",
        "order": "verified_at.desc,created_at.desc",
        "limit": str(limit),
        "offset": str(offset),
    }
    if q.strip():
        term = q.strip().replace("%", "").replace(",", " ")[:80]
        params["or"] = f"(name.ilike.*{term}*,city.ilike.*{term}*,state.ilike.*{term}*)"
    if type.strip() and type.lower() != "all":
        params["institution_type"] = f"ilike.{type.strip()[:40]}"
    if city.strip():
        params["city"] = f"ilike.{city.strip()[:80]}"
    if verified:
        params["verified_at"] = "not.is.null"

    institutions = get_rows("institutions", params)
    ids = [row["id"] for row in institutions if row.get("id")]
    followers = get_rows("institution_followers", {"institution_id": ids_filter(ids), "select": "institution_id,user_id"}) if ids else []
    groups = get_rows("groups", {"institution_id": ids_filter(ids), "deleted_at": "is.null", "visibility": "eq.public", "select": "institution_id"}) if ids else []
    events = get_rows("campus_events", {"institution_id": ids_filter(ids), "status": "eq.published", "select": "institution_id"}) if ids else []
    follower_counts = counts_by(followers, "institution_id")
    group_counts = counts_by(groups, "institution_id")
    event_counts = counts_by(events, "institution_id")
    following_ids = {row.get("institution_id") for row in followers if row.get("user_id") == user.id}

    items = []
    for row in institutions:
        iid = row.get("id")
        item = public_institution(row, {
            "followers": follower_counts.get(iid, 0),
            "groups": group_counts.get(iid, 0),
            "events": event_counts.get(iid, 0),
        }, iid in following_ids)
        item["discoveryScore"] = (
            (100 if item["verified"] else 0)
            + item["followersCount"] * 3
            + item["groupsCount"] * 2
            + item["eventsCount"]
        )
        items.append(item)
    items.sort(key=lambda item: (item["discoveryScore"], item["name"] or ""), reverse=True)
    return {"items": items, "limit": limit, "offset": offset, "hasMore": len(items) == limit}


@router.get("/directory/institutions/{institution_id}")
def directory_institution_profile(
    institution_id: str,
    user: server.CurrentUser = Depends(server.current_user),
) -> dict[str, Any]:
    return build_public_bundle(institution_id, user.id)


@router.post("/directory/institutions/{institution_id}/follow")
def follow_institution(institution_id: str, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    institution_or_404(institution_id, approved_only=True)
    existing = get_rows("institution_followers", {"institution_id": f"eq.{institution_id}", "user_id": f"eq.{user.id}", "select": "institution_id", "limit": "1"})
    if not existing:
        server.db.post("institution_followers", {"institution_id": institution_id, "user_id": user.id})
    return {"following": True}


@router.delete("/directory/institutions/{institution_id}/follow")
def unfollow_institution(institution_id: str, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    server.db.delete("institution_followers", {"institution_id": f"eq.{institution_id}", "user_id": f"eq.{user.id}"})
    return {"following": False}


class ProfilePatch(BaseModel):
    tagline: Optional[str] = Field(default=None, max_length=160)
    shortDescription: Optional[str] = Field(default=None, max_length=500)
    description: Optional[str] = Field(default=None, max_length=10000)
    website: Optional[str] = Field(default=None, max_length=500)
    phone: Optional[str] = Field(default=None, max_length=40)
    city: Optional[str] = Field(default=None, max_length=120)
    state: Optional[str] = Field(default=None, max_length=120)
    country: Optional[str] = Field(default=None, max_length=120)
    establishedYear: Optional[int] = Field(default=None, ge=1000, le=3000)
    accreditation: Optional[list[Any]] = None
    rankings: Optional[list[Any]] = None
    publicStats: Optional[dict[str, Any]] = None
    socialLinks: Optional[dict[str, Any]] = None
    publicConfig: Optional[dict[str, Any]] = None


class StoryPayload(BaseModel):
    year: Optional[int] = Field(default=None, ge=1000, le=3000)
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=3000)
    imageUrl: Optional[str] = Field(default=None, max_length=1000)
    icon: Optional[str] = Field(default=None, max_length=80)
    sortOrder: int = Field(default=0, ge=0, le=10000)
    published: bool = True


class GalleryPayload(BaseModel):
    kind: Literal["image", "video"]
    category: str = Field(default="campus", max_length=80)
    url: str = Field(min_length=1, max_length=1500)
    caption: Optional[str] = Field(default=None, max_length=500)
    altText: Optional[str] = Field(default=None, max_length=500)
    sortOrder: int = Field(default=0, ge=0, le=10000)
    featured: bool = False
    published: bool = True


class SectionPayload(BaseModel):
    title: Optional[str] = Field(default=None, max_length=160)
    enabled: bool = True
    sortOrder: int = Field(default=0, ge=0, le=10000)
    config: dict[str, Any] = Field(default_factory=dict)


class ProgramPayload(BaseModel):
    name: str = Field(min_length=1, max_length=240)
    departmentId: Optional[str] = None
    degreeType: Optional[str] = Field(default=None, max_length=100)
    duration: Optional[str] = Field(default=None, max_length=100)
    description: str = Field(default="", max_length=5000)
    eligibility: Optional[str] = Field(default=None, max_length=3000)
    intake: Optional[int] = Field(default=None, ge=0, le=1000000)
    feesText: Optional[str] = Field(default=None, max_length=300)
    brochureUrl: Optional[str] = Field(default=None, max_length=1500)
    applicationUrl: Optional[str] = Field(default=None, max_length=1500)
    status: Literal["draft", "published", "archived"] = "published"
    metadata: dict[str, Any] = Field(default_factory=dict)
    sortOrder: int = Field(default=0, ge=0, le=10000)


class AchievementPayload(BaseModel):
    category: str = Field(default="institution", max_length=100)
    title: str = Field(min_length=1, max_length=240)
    description: str = Field(default="", max_length=5000)
    date: Optional[str] = Field(default=None, max_length=100)
    imageUrl: Optional[str] = Field(default=None, max_length=1500)
    featured: bool = False
    published: bool = True
    sortOrder: int = Field(default=0, ge=0, le=10000)


def studio_institution_id(user: server.CurrentUser) -> str:
    return str(require_admin(user)["institution_id"])


def story_row(payload: StoryPayload, institution_id: str, user_id: str, item_id: Optional[str] = None) -> dict[str, Any]:
    return {
        "id": item_id or new_id("story"), "institution_id": institution_id, "year": payload.year,
        "title": payload.title, "description": payload.description, "image_url": payload.imageUrl,
        "icon": payload.icon, "sort_order": payload.sortOrder, "published": payload.published,
        "created_by": user_id, "updated_at": now_iso(),
    }


def gallery_row(payload: GalleryPayload, institution_id: str, user_id: str, item_id: Optional[str] = None) -> dict[str, Any]:
    return {
        "id": item_id or new_id("media"), "institution_id": institution_id, "kind": payload.kind,
        "category": payload.category, "url": payload.url, "caption": payload.caption, "alt_text": payload.altText,
        "sort_order": payload.sortOrder, "featured": payload.featured, "published": payload.published,
        "created_by": user_id, "updated_at": now_iso(),
    }


def program_row(payload: ProgramPayload, institution_id: str, user_id: str, item_id: Optional[str] = None) -> dict[str, Any]:
    return {
        "id": item_id or new_id("program"), "institution_id": institution_id, "department_id": payload.departmentId,
        "name": payload.name, "degree_type": payload.degreeType, "duration": payload.duration,
        "description": payload.description, "eligibility": payload.eligibility, "intake": payload.intake,
        "fees_text": payload.feesText, "brochure_url": payload.brochureUrl, "application_url": payload.applicationUrl,
        "status": payload.status, "metadata": payload.metadata, "sort_order": payload.sortOrder,
        "created_by": user_id, "updated_at": now_iso(),
    }


def achievement_row(payload: AchievementPayload, institution_id: str, user_id: str, item_id: Optional[str] = None) -> dict[str, Any]:
    return {
        "id": item_id or new_id("achievement"), "institution_id": institution_id, "category": payload.category,
        "title": payload.title, "description": payload.description, "date": payload.date, "image_url": payload.imageUrl,
        "featured": payload.featured, "published": payload.published, "sort_order": payload.sortOrder,
        "created_by": user_id, "updated_at": now_iso(),
    }


def ensure_owned(table: str, item_id: str, institution_id: str) -> None:
    rows = get_rows(table, {"id": f"eq.{item_id}", "institution_id": f"eq.{institution_id}", "select": "id", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Studio item not found")


@router.get("/institution/studio")
def get_studio(user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    institution_id = studio_institution_id(user)
    bundle = build_public_bundle(institution_id, user.id)
    bundle["institution"]["officialEmail"] = institution_or_404(institution_id).get("official_email")
    bundle["versions"] = get_rows("institution_profile_versions", {"institution_id": f"eq.{institution_id}", "select": "id,version,status,created_by,created_at", "order": "version.desc", "limit": "50"})
    bundle["mediaAssets"] = get_rows("institution_media_assets", {"institution_id": f"eq.{institution_id}", "select": "*", "order": "created_at.desc", "limit": "100"})
    return bundle


@router.patch("/institution/studio/profile")
def patch_studio_profile(payload: ProfilePatch, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    institution_id = studio_institution_id(user)
    mapping = {
        "tagline": "tagline", "shortDescription": "short_description", "description": "description",
        "website": "website", "phone": "phone", "city": "city", "state": "state", "country": "country",
        "establishedYear": "established_year", "accreditation": "accreditation", "rankings": "rankings",
        "publicStats": "public_stats", "socialLinks": "social_links", "publicConfig": "public_config",
    }
    incoming = payload.model_dump(exclude_unset=True)
    data = {mapping[key]: value for key, value in incoming.items() if key in mapping}
    data["updated_at"] = now_iso()
    rows = server.db.patch("institutions", {"id": f"eq.{institution_id}"}, data)
    return {"success": True, "institution": rows[0] if rows else institution_or_404(institution_id)}


@router.post("/institution/studio/story")
def create_story(payload: StoryPayload, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid = studio_institution_id(user)
    return server.db.post("institution_story_milestones", story_row(payload, iid, user.id))[0]


@router.patch("/institution/studio/story/{item_id}")
def update_story(item_id: str, payload: StoryPayload, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid = studio_institution_id(user); ensure_owned("institution_story_milestones", item_id, iid)
    row = story_row(payload, iid, user.id, item_id); row.pop("id"); row.pop("institution_id"); row.pop("created_by")
    return server.db.patch("institution_story_milestones", {"id": f"eq.{item_id}", "institution_id": f"eq.{iid}"}, row)[0]


@router.delete("/institution/studio/story/{item_id}")
def delete_story(item_id: str, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid = studio_institution_id(user); ensure_owned("institution_story_milestones", item_id, iid)
    server.db.delete("institution_story_milestones", {"id": f"eq.{item_id}", "institution_id": f"eq.{iid}"})
    return {"success": True}


@router.post("/institution/studio/gallery")
def create_gallery(payload: GalleryPayload, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid = studio_institution_id(user)
    return server.db.post("institution_profile_media", gallery_row(payload, iid, user.id))[0]


@router.patch("/institution/studio/gallery/{item_id}")
def update_gallery(item_id: str, payload: GalleryPayload, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid = studio_institution_id(user); ensure_owned("institution_profile_media", item_id, iid)
    row = gallery_row(payload, iid, user.id, item_id); row.pop("id"); row.pop("institution_id"); row.pop("created_by")
    return server.db.patch("institution_profile_media", {"id": f"eq.{item_id}", "institution_id": f"eq.{iid}"}, row)[0]


@router.delete("/institution/studio/gallery/{item_id}")
def delete_gallery(item_id: str, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid = studio_institution_id(user); ensure_owned("institution_profile_media", item_id, iid)
    server.db.delete("institution_profile_media", {"id": f"eq.{item_id}", "institution_id": f"eq.{iid}"})
    return {"success": True}


@router.put("/institution/studio/sections/{section_key}")
def upsert_section(section_key: str, payload: SectionPayload, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid = studio_institution_id(user)
    key = section_key.strip().lower().replace(" ", "-")[:80]
    if not key:
        raise HTTPException(status_code=400, detail="Section key is required")
    existing = get_rows("institution_profile_sections", {"institution_id": f"eq.{iid}", "section_key": f"eq.{key}", "select": "id", "limit": "1"})
    data = {"title": payload.title, "enabled": payload.enabled, "sort_order": payload.sortOrder, "config": payload.config, "updated_at": now_iso()}
    if existing:
        return server.db.patch("institution_profile_sections", {"id": f"eq.{existing[0]['id']}"}, data)[0]
    data.update({"id": new_id("section"), "institution_id": iid, "section_key": key})
    return server.db.post("institution_profile_sections", data)[0]


@router.post("/institution/studio/programs")
def create_program(payload: ProgramPayload, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid = studio_institution_id(user)
    return server.db.post("institution_programs", program_row(payload, iid, user.id))[0]


@router.patch("/institution/studio/programs/{item_id}")
def update_program(item_id: str, payload: ProgramPayload, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid = studio_institution_id(user); ensure_owned("institution_programs", item_id, iid)
    row = program_row(payload, iid, user.id, item_id); row.pop("id"); row.pop("institution_id"); row.pop("created_by")
    return server.db.patch("institution_programs", {"id": f"eq.{item_id}", "institution_id": f"eq.{iid}"}, row)[0]


@router.delete("/institution/studio/programs/{item_id}")
def delete_program(item_id: str, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid = studio_institution_id(user); ensure_owned("institution_programs", item_id, iid)
    server.db.delete("institution_programs", {"id": f"eq.{item_id}", "institution_id": f"eq.{iid}"})
    return {"success": True}


@router.post("/institution/studio/achievements")
def create_achievement(payload: AchievementPayload, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid = studio_institution_id(user)
    return server.db.post("institution_achievements", achievement_row(payload, iid, user.id))[0]


@router.patch("/institution/studio/achievements/{item_id}")
def update_achievement(item_id: str, payload: AchievementPayload, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid = studio_institution_id(user); ensure_owned("institution_achievements", item_id, iid)
    row = achievement_row(payload, iid, user.id, item_id); row.pop("id"); row.pop("institution_id"); row.pop("created_by")
    return server.db.patch("institution_achievements", {"id": f"eq.{item_id}", "institution_id": f"eq.{iid}"}, row)[0]


@router.delete("/institution/studio/achievements/{item_id}")
def delete_achievement(item_id: str, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid = studio_institution_id(user); ensure_owned("institution_achievements", item_id, iid)
    server.db.delete("institution_achievements", {"id": f"eq.{item_id}", "institution_id": f"eq.{iid}"})
    return {"success": True}


@router.post("/institution/studio/media")
async def upload_studio_media(
    file: UploadFile = File(...),
    user: server.CurrentUser = Depends(server.current_user),
) -> dict[str, Any]:
    iid = studio_institution_id(user)
    content_type = (file.content_type or "").lower()
    if content_type not in PUBLIC_MEDIA_TYPES:
        raise HTTPException(status_code=400, detail="Only public institution images and videos are supported")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="The selected file is empty")
    if len(data) > MAX_PUBLIC_MEDIA_BYTES:
        raise HTTPException(status_code=413, detail="Institution media must be 50 MB or smaller")
    extension = (file.filename or "media.bin").rsplit(".", 1)[-1].lower()
    extension = "".join(ch for ch in extension if ch.isalnum())[:8] or ("mp4" if content_type.startswith("video/") else "jpg")
    path = f"institutions/{iid}/{uuid.uuid4().hex}.{extension}"
    url = server._storage_upload(data, path, content_type, PUBLIC_BUCKET)
    checksum = hashlib.sha256(data).hexdigest()
    asset = server.db.post("institution_media_assets", {
        "id": new_id("asset"), "institution_id": iid, "owner_user_id": user.id,
        "kind": "video" if content_type.startswith("video/") else "image", "url": url,
        "mime_type": content_type, "bytes": len(data), "checksum_sha256": checksum,
    })[0]
    return {"url": url, "asset": asset}


def snapshot_for(institution_id: str) -> dict[str, Any]:
    return {
        "institution": institution_or_404(institution_id),
        "story": get_rows("institution_story_milestones", {"institution_id": f"eq.{institution_id}", "select": "*", "order": "sort_order.asc"}),
        "gallery": get_rows("institution_profile_media", {"institution_id": f"eq.{institution_id}", "select": "*", "order": "sort_order.asc"}),
        "sections": get_rows("institution_profile_sections", {"institution_id": f"eq.{institution_id}", "select": "*", "order": "sort_order.asc"}),
        "programs": get_rows("institution_programs", {"institution_id": f"eq.{institution_id}", "select": "*", "order": "sort_order.asc"}),
        "achievements": get_rows("institution_achievements", {"institution_id": f"eq.{institution_id}", "select": "*", "order": "sort_order.asc"}),
    }


@router.post("/institution/studio/publish")
def publish_studio(user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid = studio_institution_id(user)
    versions = get_rows("institution_profile_versions", {"institution_id": f"eq.{iid}", "select": "version", "order": "version.desc", "limit": "1"})
    version = int(versions[0].get("version") or 0) + 1 if versions else 1
    row = server.db.post("institution_profile_versions", {
        "id": new_id("version"), "institution_id": iid, "version": version,
        "snapshot": snapshot_for(iid), "status": "published", "created_by": user.id,
    })[0]
    server.db.patch("institutions", {"id": f"eq.{iid}"}, {"updated_at": now_iso()})
    return {"success": True, "version": row}


@router.get("/institution/studio/versions")
def list_versions(user: server.CurrentUser = Depends(server.current_user)) -> list[dict[str, Any]]:
    iid = studio_institution_id(user)
    return get_rows("institution_profile_versions", {"institution_id": f"eq.{iid}", "select": "id,version,status,created_by,created_at", "order": "version.desc", "limit": "100"})


@router.post("/institution/studio/versions/{version_id}/restore")
def restore_version(version_id: str, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid = studio_institution_id(user)
    rows = get_rows("institution_profile_versions", {"id": f"eq.{version_id}", "institution_id": f"eq.{iid}", "select": "*", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Profile version not found")
    snapshot = rows[0].get("snapshot") or {}
    institution = snapshot.get("institution") or {}
    allowed = {
        "tagline", "short_description", "description", "website", "phone", "city", "state", "country",
        "established_year", "accreditation", "rankings", "public_stats", "social_links", "public_config",
        "logo_url", "cover_url",
    }
    patch = {key: value for key, value in institution.items() if key in allowed}
    patch["updated_at"] = now_iso()
    server.db.patch("institutions", {"id": f"eq.{iid}"}, patch)
    for table, key in [
        ("institution_story_milestones", "story"), ("institution_profile_media", "gallery"),
        ("institution_profile_sections", "sections"), ("institution_programs", "programs"),
        ("institution_achievements", "achievements"),
    ]:
        server.db.delete(table, {"institution_id": f"eq.{iid}"})
        for item in snapshot.get(key) or []:
            clean = dict(item); clean["institution_id"] = iid
            server.db.post(table, clean)
    server.db.patch("institution_profile_versions", {"id": f"eq.{version_id}"}, {"status": "restored"})
    return {"success": True, "profile": build_public_bundle(iid, user.id)}
