from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

import server

router = APIRouter(prefix="/v1/campus", tags=["campus-media"])

AUDIO_TYPES = {
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/aac",
    "audio/mpeg",
    "audio/webm",
    "audio/wav",
    "audio/x-wav",
}
IMAGE_TYPES = set(server.ALLOWED_IMAGE_TYPES)
VIDEO_TYPES = set(server.ALLOWED_VIDEO_TYPES)
DOCUMENT_TYPES = set(server.ALLOWED_DOC_TYPES)
ALLOWED_TYPES = IMAGE_TYPES | VIDEO_TYPES | DOCUMENT_TYPES | AUDIO_TYPES

MAX_BYTES = {
    "image": 10 * 1024 * 1024,
    "video": 100 * 1024 * 1024,
    "document": 20 * 1024 * 1024,
    "audio": 25 * 1024 * 1024,
}


def media_kind(content_type: str) -> str:
    if content_type in IMAGE_TYPES:
        return "image"
    if content_type in VIDEO_TYPES:
        return "video"
    if content_type in AUDIO_TYPES:
        return "audio"
    if content_type in DOCUMENT_TYPES:
        return "document"
    raise HTTPException(status_code=400, detail="Unsupported media type")


@router.post("/groups/{group_id}/media")
async def upload_group_media(
    group_id: str,
    file: UploadFile = File(...),
    user: server.CurrentUser = Depends(server.current_user),
) -> dict[str, Any]:
    server.require_group_member(group_id, user)
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported media type: {content_type or 'unknown'}")

    kind = media_kind(content_type)
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="The selected file is empty")
    if len(data) > MAX_BYTES[kind]:
        raise HTTPException(status_code=413, detail=f"{kind.title()} is too large for a group message")

    filename = file.filename or "media"
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else {
        "image": "jpg",
        "video": "mp4",
        "audio": "m4a",
        "document": "pdf",
    }[kind]
    safe_extension = "".join(ch for ch in extension if ch.isalnum())[:8] or "bin"
    storage_path = f"messages/{group_id}/{user.id}/{uuid.uuid4()}.{safe_extension}"
    public_url = server._storage_upload(data, storage_path, content_type, server.SUPABASE_MEDIA_BUCKET)

    try:
        server.db.post(
            "user_activity_events",
            {
                "user_id": user.id,
                "event_type": "group_media_uploaded",
                "target_type": "group",
                "target_id": group_id,
                "metadata": {"mediaType": kind, "bytes": len(data)},
            },
        )
    except Exception:
        pass

    return {
        "url": public_url,
        "mediaType": kind,
        "contentType": content_type,
        "bytes": len(data),
    }
