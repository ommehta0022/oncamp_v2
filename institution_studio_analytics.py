from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

import server

router = APIRouter(prefix="/v1/campus/institution/studio", tags=["institution-studio-analytics"])


def context(user: server.CurrentUser) -> str:
    admin = server.require_institution_admin(user)
    iid = admin.get("institution_id")
    if not iid:
        raise HTTPException(status_code=403, detail="Approved institution administrator required")
    return str(iid)


def rows(table: str, params: dict[str, Any]) -> list[dict[str, Any]]:
    result = server.safe_get(table, params)
    return result if isinstance(result, list) else []


def trend(records: list[dict[str, Any]], field: str, days: int = 14) -> list[dict[str, Any]]:
    today = datetime.now(timezone.utc).date()
    counts: Counter[str] = Counter()
    for record in records:
        raw = record.get(field)
        if not raw:
            continue
        try:
            parsed = datetime.fromisoformat(str(raw).replace("Z", "+00:00")).date().isoformat()
            counts[parsed] += 1
        except Exception:
            continue
    return [{"date": (today - timedelta(days=offset)).isoformat(), "count": counts.get((today - timedelta(days=offset)).isoformat(), 0)} for offset in range(days - 1, -1, -1)]


@router.get("/analytics")
def institution_studio_analytics(user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    iid = context(user)
    since = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    views = rows("institution_profile_views", {"institution_id": f"eq.{iid}", "viewed_at": f"gte.{since}", "select": "viewed_at,source,user_id", "limit": "10000"})
    followers_recent = rows("institution_followers", {"institution_id": f"eq.{iid}", "created_at": f"gte.{since}", "select": "created_at,user_id", "limit": "10000"})
    followers_all = rows("institution_followers", {"institution_id": f"eq.{iid}", "select": "user_id", "limit": "10000"})
    bookmarks = rows("institution_bookmarks", {"institution_id": f"eq.{iid}", "select": "created_at,user_id", "limit": "10000"})
    groups = rows("groups", {"institution_id": f"eq.{iid}", "deleted_at": "is.null", "select": "id,name,featured,created_at", "limit": "1000"})
    group_ids = [item.get("id") for item in groups if item.get("id")]
    member_counts: Counter[str] = Counter()
    if group_ids:
        safe_ids = [str(value) for value in group_ids if "," not in str(value) and "(" not in str(value) and ")" not in str(value)]
        memberships = rows("group_members", {"group_id": f"in.({','.join(safe_ids)})", "select": "group_id", "limit": "20000"})
        member_counts.update(str(item.get("group_id")) for item in memberships if item.get("group_id"))
    events = rows("campus_events", {"institution_id": f"eq.{iid}", "select": "id,title,start_at,status", "limit": "1000"})
    event_ids = [item.get("id") for item in events if item.get("id")]
    rsvps = []
    if event_ids:
        safe_event_ids = [str(value) for value in event_ids if "," not in str(value) and "(" not in str(value) and ")" not in str(value)]
        rsvps = rows("campus_event_rsvps", {"event_id": f"in.({','.join(safe_event_ids)})", "select": "event_id,status,guests,created_at", "limit": "20000"})
    opportunities = rows("campus_opportunities", {"institution_id": f"eq.{iid}", "status": "eq.published", "select": "id,title,kind", "limit": "1000"})
    moderation = rows("content_intelligence_signals", {"institution_id": f"eq.{iid}", "status": "eq.open", "select": "id,signal_type,score", "limit": "5000"})
    activities = rows("user_activity_events", {"institution_id": f"eq.{iid}", "created_at": f"gte.{since}", "select": "event_type,target_type,target_id,created_at", "limit": "10000"})
    top_groups = sorted(
        [{"id": item.get("id"), "name": item.get("name"), "members": member_counts.get(str(item.get("id")), 0), "featured": bool(item.get("featured"))} for item in groups],
        key=lambda item: item["members"], reverse=True,
    )[:10]
    source_counts = Counter(str(item.get("source") or "unknown") for item in views)
    activity_counts = Counter(str(item.get("event_type") or "other") for item in activities)
    going = sum(1 + int(item.get("guests") or 0) for item in rsvps if item.get("status") == "going")
    interested = sum(1 for item in rsvps if item.get("status") == "interested")
    return {
        "profileViews14d": len(views),
        "uniqueViewers14d": len({item.get("user_id") for item in views if item.get("user_id")}),
        "followers": len(followers_all),
        "newFollowers14d": len(followers_recent),
        "bookmarks": len(bookmarks),
        "groups": len(groups),
        "events": len(events),
        "eventGoing": going,
        "eventInterested": interested,
        "opportunities": len(opportunities),
        "moderationOpen": len(moderation),
        "viewTrend": trend(views, "viewed_at"),
        "followerTrend": trend(followers_recent, "created_at"),
        "topGroups": top_groups,
        "viewSources": [{"source": key, "count": value} for key, value in source_counts.most_common()],
        "activityTypes": [{"type": key, "count": value} for key, value in activity_counts.most_common(20)],
    }
