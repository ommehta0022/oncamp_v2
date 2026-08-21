from __future__ import annotations

import os
from typing import Any, Literal

import requests
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

import campus_platform
import server

router = APIRouter(prefix="/v1/campus", tags=["campus-ai"])

AI_API_URL = os.getenv("ONCAMPUS_AI_API_URL", "").strip()
AI_API_KEY = os.getenv("ONCAMPUS_AI_API_KEY", "").strip()
AI_MODEL = os.getenv("ONCAMPUS_AI_MODEL", "").strip()
AI_TIMEOUT_SECONDS = max(2, min(int(os.getenv("ONCAMPUS_AI_TIMEOUT_SECONDS", "12")), 30))


class AiAnalyzeDto(BaseModel):
    task: Literal["moderation", "spam", "duplicate", "recommendation", "search"]
    text: str = Field(..., min_length=1, max_length=12000)
    context: dict[str, Any] = Field(default_factory=dict)


def ai_provider_configured() -> bool:
    return bool(AI_API_URL and AI_API_KEY and AI_MODEL)


def _provider_url() -> str:
    if not ai_provider_configured():
        raise HTTPException(status_code=503, detail="AI provider is not configured. Deterministic safety checks remain available, but no AI result will be fabricated.")
    return campus_platform._validate_public_https_url(AI_API_URL)


def _normalized_result(data: Any, task: str) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="AI provider returned an invalid response")
    score = data.get("score")
    labels = data.get("labels", [])
    explanation = data.get("explanation", "")
    if isinstance(score, bool) or not isinstance(score, (int, float)):
        raise HTTPException(status_code=502, detail="AI provider response is missing a numeric score")
    if not isinstance(labels, list) or any(not isinstance(label, str) for label in labels[:50]):
        raise HTTPException(status_code=502, detail="AI provider response has invalid labels")
    if not isinstance(explanation, str):
        raise HTTPException(status_code=502, detail="AI provider response has an invalid explanation")
    return {
        "task": task,
        "score": max(0.0, min(1.0, float(score))),
        "labels": [label[:80] for label in labels[:50]],
        "explanation": explanation[:2000],
        "provider": "configured_external",
        "model": AI_MODEL,
    }


def call_ai_provider(task: str, text: str, context: dict[str, Any]) -> dict[str, Any]:
    url = _provider_url()
    try:
        response = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {AI_API_KEY}",
                "Content-Type": "application/json",
                "User-Agent": "OnCampus-AI-Gateway/1.0",
            },
            json={
                "model": AI_MODEL,
                "task": task,
                "text": text,
                "context": context,
                "responseFormat": {
                    "score": "number 0..1",
                    "labels": "string[]",
                    "explanation": "string",
                },
            },
            timeout=AI_TIMEOUT_SECONDS,
            allow_redirects=False,
        )
    except requests.RequestException as exc:
        server.logger.warning("AI provider request failed: %s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="AI provider is temporarily unavailable") from exc
    if response.status_code < 200 or response.status_code >= 300:
        server.logger.warning("AI provider returned HTTP %s", response.status_code)
        raise HTTPException(status_code=502, detail="AI provider rejected the request")
    try:
        data = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="AI provider returned invalid JSON") from exc
    return _normalized_result(data, task)


@router.get("/ai/status")
def ai_status(user: server.CurrentUser = Depends(server.current_user)) -> dict[str, Any]:
    return {
        "configured": ai_provider_configured(),
        "mode": "external_provider" if ai_provider_configured() else "disabled",
        "model": AI_MODEL if ai_provider_configured() else None,
        "deterministicSafetyAvailable": True,
        "fabricatedFallback": False,
    }


@router.post("/institution/ai/analyze")
@server.limiter.limit("20/minute")
def institution_ai_analyze(
    request: Request,
    payload: AiAnalyzeDto,
    user: server.CurrentUser = Depends(server.current_user),
    ctx: dict[str, Any] = Depends(campus_platform.require_operator("moderation.review")),
) -> dict[str, Any]:
    result = call_ai_provider(payload.task, payload.text, {**payload.context, "institutionId": str(ctx["institution_id"])})
    campus_platform._audit(
        user,
        str(ctx["institution_id"]),
        "ai.analysis",
        "ai_task",
        None,
        {"task": payload.task, "model": result["model"], "score": result["score"]},
    )
    return result
