from __future__ import annotations

import uuid
from typing import Final

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

import server

router = APIRouter(prefix="/v1/campus", tags=["campus-voice"])

MAX_VOICE_NOTE_BYTES: Final[int] = 15 * 1024 * 1024
ALLOWED_AUDIO_TYPES: Final[dict[str, str]] = {
    "audio/mp4": "m4a",
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "aac",
    "audio/mpeg": "mp3",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
}


@router.post("/groups/{group_id}/voice-note")
async def upload_group_voice_note(
    group_id: str,
    file: UploadFile = File(...),
    user: server.CurrentUser = Depends(server.current_user),
) -> dict[str, str]:
    """Upload a bounded group voice note; 1:1 audio/voice calling is not exposed."""
    server.require_group_member(group_id, user)

    content_type = (file.content_type or "").lower().split(";", 1)[0].strip()
    extension = ALLOWED_AUDIO_TYPES.get(content_type)
    if not extension:
        raise HTTPException(status_code=400, detail="Unsupported voice-note audio format")

    file_bytes = await file.read(MAX_VOICE_NOTE_BYTES + 1)
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Voice note is empty")
    if len(file_bytes) > MAX_VOICE_NOTE_BYTES:
        raise HTTPException(status_code=400, detail="Voice note is too large. Maximum size is 15 MB")

    storage_path = f"messages/{group_id}/voice/{uuid.uuid4()}.{extension}"
    public_url = server._storage_upload(
        file_bytes,
        storage_path,
        content_type,
        server.SUPABASE_MEDIA_BUCKET,
    )
    return {
        "url": public_url,
        "mediaType": "audio",
        "contentType": content_type,
    }
