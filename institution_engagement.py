from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query

import server

router = APIRouter(prefix="/v1/campus", tags=["institution-engagement"])


def _approved(institution_id: str) -> None:
    rows = server.safe_get("institutions", {"id": f"eq.{institution_id}", "status": "eq.approved", "select": "id", "limit": "1"}) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Institution not found")


@router.get("/directory/institutions/{institution_id}/engagement")
def engagement(institution_id: str, user: server.CurrentUser = Depends(server.current_user)) -> dict:
    _approved(institution_id)
    followed = server.safe_get("institution_followers", {"institution_id": f"eq.{institution_id}", "user_id": f"eq.{user.id}", "select": "institution_id", "limit": "1"}) or []
    bookmarked = server.safe_get("institution_bookmarks", {"institution_id": f"eq.{institution_id}", "user_id": f"eq.{user.id}", "select": "institution_id", "limit": "1"}) or []
    return {"following": bool(followed), "bookmarked": bool(bookmarked)}


@router.post("/directory/institutions/{institution_id}/bookmark")
def bookmark(institution_id: str, user: server.CurrentUser = Depends(server.current_user)) -> dict:
    _approved(institution_id)
    existing = server.safe_get("institution_bookmarks", {"institution_id": f"eq.{institution_id}", "user_id": f"eq.{user.id}", "select": "institution_id", "limit": "1"}) or []
    if not existing:
        server.db.post("institution_bookmarks", {"institution_id": institution_id, "user_id": user.id})
    return {"bookmarked": True}


@router.delete("/directory/institutions/{institution_id}/bookmark")
def unbookmark(institution_id: str, user: server.CurrentUser = Depends(server.current_user)) -> dict:
    server.db.delete("institution_bookmarks", {"institution_id": f"eq.{institution_id}", "user_id": f"eq.{user.id}"})
    return {"bookmarked": False}


@router.post("/directory/institutions/{institution_id}/view")
def record_view(institution_id: str, source: str = Query(default="discover", max_length=40), user: server.CurrentUser = Depends(server.current_user)) -> dict:
    _approved(institution_id)
    server.db.post("institution_profile_views", {
        "id": f"iview_{uuid.uuid4().hex}",
        "institution_id": institution_id,
        "user_id": user.id,
        "source": source or "discover",
    })
    return {"recorded": True}
