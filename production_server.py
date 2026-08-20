from __future__ import annotations

import os

import uvicorn
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

import server
from institution_content_workflow import router as institution_content_router
from ota_updates import router as ota_router

app = server.app
app.include_router(ota_router)
app.include_router(institution_content_router)


@app.middleware("http")
async def protect_institution_branding_uploads(request: Request, call_next):
    """Require a live institution-admin session for institution branding uploads."""
    protected_paths = {
        "/v1/upload/institution-logo",
        "/v1/upload/institution-cover",
    }
    if request.method == "POST" and request.url.path in protected_paths:
        try:
            user = server.current_user(request.headers.get("authorization"))
            server.require_institution_admin(user)
        except HTTPException as exc:
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
        except Exception:
            return JSONResponse(status_code=401, content={"detail": "Authentication required"})
    return await call_next(request)


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8080")),
        proxy_headers=True,
        forwarded_allow_ips="*",
    )
