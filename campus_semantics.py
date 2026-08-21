from __future__ import annotations

import asyncio
import hashlib
import re
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException

import campus_platform
import server

router = APIRouter(prefix="/v1/campus", tags=["campus-semantics"])

HASHTAG_RE = re.compile(r"(?<!\w)#([A-Za-z0-9_]{1,60})")
MENTION_RE = re.compile(r"(?<!\w)@([A-Za-z0-9_.]{2,60})")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def content_hash(title: Optional[str], content: Optional[str]) -> str:
    raw = f"{title or ''}\n{content or ''}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _post_state(post_id: str) -> Optional[dict[str, Any]]:
    rows = server.db.get(
        "post_semantic_index_state",
        {"post_id": f"eq.{post_id}", "select": "*", "limit": "1"},
    ) or []
    return rows[0] if rows else None


def _save_version(post: dict[str, Any], state: Optional[dict[str, Any]]) -> None:
    versions = server.db.get(
        "post_versions",
        {"post_id": f"eq.{post['id']}", "select": "version", "order": "version.desc", "limit": "1"},
    ) or []
    next_version = int(versions[0].get("version") or 0) + 1 if versions else 1
    if state is None:
        summary = "Initial published version"
    else:
        changed = []
        if (state.get("last_title") or "") != (post.get("title") or ""):
            changed.append("title")
        if (state.get("last_content") or "") != (post.get("content") or ""):
            changed.append("content")
        summary = "Updated " + " and ".join(changed or ["post"])
    server.db.post(
        "post_versions",
        {
            "post_id": post["id"],
            "version": next_version,
            "title": post.get("title"),
            "content": post.get("content") or "",
            "changed_by": post.get("author_id"),
            "change_summary": summary,
            "created_at": now_iso(),
        },
    )


def _index_hashtags(post_id: str, text: str) -> list[str]:
    tags = sorted({match.group(1).lower() for match in HASHTAG_RE.finditer(text)})[:50]
    server.db.delete("post_hashtags", {"post_id": f"eq.{post_id}"})
    for tag in tags:
        server.db.post("post_hashtags", {"post_id": post_id, "tag": tag})
    return tags


def _index_mentions(post: dict[str, Any], text: str) -> list[str]:
    post_id = post["id"]
    previous = server.db.get(
        "post_mentions",
        {"post_id": f"eq.{post_id}", "select": "handle,mentioned_user_id", "limit": "200"},
    ) or []
    previous_handles = {str(row.get("handle") or "").lower() for row in previous}
    handles = sorted({match.group(1).lower() for match in MENTION_RE.finditer(text)})[:50]
    server.db.delete("post_mentions", {"post_id": f"eq.{post_id}"})

    indexed: list[str] = []
    for handle in handles:
        profiles = server.db.get(
            "users",
            {"handle": f"eq.{handle}", "status": "eq.active", "select": "id,handle", "limit": "1"},
        ) or []
        user_id = profiles[0].get("id") if profiles else None
        server.db.post(
            "post_mentions",
            {"post_id": post_id, "mentioned_user_id": user_id, "handle": handle},
        )
        indexed.append(handle)
        if user_id and handle not in previous_handles and user_id != post.get("author_id"):
            try:
                campus_platform._notify_user(
                    user_id,
                    "You were mentioned",
                    f"@{handle}, an institution post mentioned you.",
                    "post_mention",
                    {"postId": post_id, "route": f"/post/{post_id}"},
                    push=True,
                )
            except Exception as exc:
                server.logger.warning("Mention notification failed: %s", type(exc).__name__)
    return indexed


def index_post(post: dict[str, Any]) -> dict[str, Any]:
    post_id = str(post["id"])
    title = post.get("title") or ""
    body = post.get("content") or ""
    text = f"{title}\n{body}"
    digest = content_hash(title, body)
    state = _post_state(post_id)
    if state and state.get("content_hash") == digest:
        return {"postId": post_id, "changed": False}

    _save_version(post, state)
    hashtags = _index_hashtags(post_id, text)
    mentions = _index_mentions(post, text)

    institution_id = post.get("institution_id")
    signals: list[dict[str, Any]] = []
    if institution_id:
        try:
            signals = campus_platform.analyze_content(institution_id, "post", post_id, text)
        except Exception as exc:
            server.logger.warning("Content intelligence indexing failed: %s", type(exc).__name__)

    values = {
        "content_hash": digest,
        "last_title": title,
        "last_content": body,
        "indexed_at": now_iso(),
    }
    if state:
        server.db.patch("post_semantic_index_state", {"post_id": f"eq.{post_id}"}, values)
    else:
        server.db.post("post_semantic_index_state", {"post_id": post_id, **values})

    return {
        "postId": post_id,
        "changed": True,
        "hashtags": hashtags,
        "mentions": mentions,
        "signals": [{"type": row.get("signal_type"), "score": row.get("score")} for row in signals],
    }


def scan_recent_posts(limit: int = 400) -> dict[str, int]:
    posts = server.db.get(
        "posts",
        {
            "deleted_at": "is.null",
            "status": "in.(published,scheduled)",
            "select": "id,author_id,institution_id,group_id,title,content,status,updated_at,created_at",
            "order": "updated_at.desc.nullslast,created_at.desc",
            "limit": str(max(1, min(limit, 1000))),
        },
    ) or []
    changed = 0
    unchanged = 0
    failed = 0
    for post in posts:
        try:
            result = index_post(post)
            if result["changed"]:
                changed += 1
            else:
                unchanged += 1
        except Exception as exc:
            failed += 1
            server.logger.warning("Post semantic index failed for %s: %s", post.get("id"), type(exc).__name__)
    return {"scanned": len(posts), "changed": changed, "unchanged": unchanged, "failed": failed}


async def semantics_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(scan_recent_posts, 400)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            server.logger.warning("Semantic index loop failed: %s", type(exc).__name__)
        await asyncio.sleep(30)


def _require_post_access(post: dict[str, Any], user: server.CurrentUser) -> None:
    if user.role == "platform_admin":
        return
    group_id = post.get("group_id")
    if group_id:
        server.require_group_member(group_id, user)
        return
    institution_id = post.get("institution_id")
    if not institution_id:
        return
    try:
        admin = server.require_institution_admin(user)
        if admin.get("institution_id") == institution_id:
            return
    except HTTPException:
        pass
    memberships = server.db.get(
        "user_institutions",
        {"user_id": f"eq.{user.id}", "institution_id": f"eq.{institution_id}", "select": "user_id", "limit": "1"},
    ) or []
    if not memberships and post.get("visibility") != "public":
        raise HTTPException(status_code=403, detail="This post is outside your institution")


@router.get("/posts/{post_id}/versions")
def post_versions(post_id: str, user: server.CurrentUser = Depends(server.current_user)) -> list[dict[str, Any]]:
    posts = server.db.get(
        "posts",
        {"id": f"eq.{post_id}", "deleted_at": "is.null", "select": "id,institution_id,group_id,visibility", "limit": "1"},
    ) or []
    if not posts:
        raise HTTPException(status_code=404, detail="Post not found")
    _require_post_access(posts[0], user)
    return server.db.get(
        "post_versions",
        {"post_id": f"eq.{post_id}", "select": "id,version,title,content,change_summary,created_at", "order": "version.desc", "limit": "100"},
    ) or []


@router.get("/posts/{post_id}/semantics")
def post_semantics(post_id: str, user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    posts = server.db.get(
        "posts",
        {"id": f"eq.{post_id}", "deleted_at": "is.null", "select": "id,institution_id,group_id,visibility", "limit": "1"},
    ) or []
    if not posts:
        raise HTTPException(status_code=404, detail="Post not found")
    _require_post_access(posts[0], user)
    hashtags = server.db.get("post_hashtags", {"post_id": f"eq.{post_id}", "select": "tag", "order": "tag.asc"}) or []
    mentions = server.db.get("post_mentions", {"post_id": f"eq.{post_id}", "select": "handle,mentioned_user_id", "order": "handle.asc"}) or []
    return {"hashtags": [row["tag"] for row in hashtags], "mentions": mentions}
