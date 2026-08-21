from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response

import campus_platform
import server

router = APIRouter(prefix="/v1/campus", tags=["campus-governance"])


@router.get("/institution/audit-logs")
def institution_audit_logs(
    action: str = Query("", max_length=120),
    q: str = Query("", max_length=160),
    limit: int = Query(100, ge=1, le=500),
    ctx: dict[str, Any] = Depends(campus_platform.require_operator("analytics.view")),
) -> list[dict[str, Any]]:
    """Tenant-scoped operational audit trail backed by user_activity_events."""
    params: dict[str, Any] = {
        "institution_id": f"eq.{ctx['institution_id']}",
        "select": "id,user_id,event_type,target_type,target_id,metadata,created_at",
        "order": "created_at.desc",
        "limit": str(limit),
    }
    if action.strip():
        params["event_type"] = f"eq.{action.strip()}"
    rows = server.db.get("user_activity_events", params) or []
    needle = q.strip().lower()
    if needle:
        rows = [
            row
            for row in rows
            if needle in str(row.get("event_type") or "").lower()
            or needle in str(row.get("target_type") or "").lower()
            or needle in str(row.get("target_id") or "").lower()
            or needle in str(row.get("metadata") or "").lower()
        ]
    return rows[:limit]


@router.post("/institution/export-link")
@server.limiter.limit("20/minute")
def create_export_link(
    request: Request,
    dataset: Literal["students", "staff", "events", "analytics"] = Query("students"),
    format: Literal["csv", "pdf"] = Query("csv"),
    user: server.CurrentUser = Depends(server.current_user),
    ctx: dict[str, Any] = Depends(campus_platform.require_operator("exports.view")),
) -> dict[str, Any]:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=2)
    token = jwt.encode(
        {
            "kind": "institution_export",
            "institution_id": str(ctx["institution_id"]),
            "user_id": str(user.id),
            "dataset": dataset,
            "format": format,
            "exp": int(expires_at.timestamp()),
        },
        server.JWT_SECRET,
        algorithm="HS256",
    )
    campus_platform._audit(
        user,
        str(ctx["institution_id"]),
        "export.link_created",
        "institution_export",
        None,
        {"dataset": dataset, "format": format},
    )
    return {
        "url": f"/v1/campus/public/export?token={token}",
        "expiresAt": expires_at.isoformat(),
        "dataset": dataset,
        "format": format,
    }


@router.get("/public/export")
@server.limiter.limit("30/minute")
def consume_export_link(request: Request, token: str = Query(..., min_length=40, max_length=4096)) -> Response:
    try:
        payload = jwt.decode(token, server.JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=410, detail="Export link has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid export link") from exc

    if payload.get("kind") != "institution_export":
        raise HTTPException(status_code=401, detail="Invalid export link")
    dataset = payload.get("dataset")
    format_value = payload.get("format")
    institution_id = payload.get("institution_id")
    if dataset not in {"students", "staff", "events", "analytics"} or format_value not in {"csv", "pdf"} or not institution_id:
        raise HTTPException(status_code=401, detail="Invalid export link")

    return campus_platform.export_institution_data(
        dataset=dataset,
        format=format_value,
        ctx={"institution_id": str(institution_id)},
    )
