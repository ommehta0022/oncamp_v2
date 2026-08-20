from __future__ import annotations

import os
from datetime import datetime, timezone

import uvicorn
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

import server
from ota_updates import router as ota_router

app = server.app
app.include_router(ota_router)


def _bootstrap_super_admin_from_env() -> None:
    """Apply a one-time bcrypt hash to exactly one existing super-admin account.

    This recovery path intentionally accepts only a precomputed bcrypt hash,
    never a plaintext password. It is disabled unless ADMIN_BOOTSTRAP_ONCE=1,
    requires an explicit email, validates the hash prefix, and refuses to create
    a new account. The deployment variables should be removed immediately after
    successful recovery.
    """
    if os.getenv("ADMIN_BOOTSTRAP_ONCE", "").strip() != "1":
        return

    email = os.getenv("ADMIN_BOOTSTRAP_EMAIL", "").strip().lower()
    password_hash = os.getenv("ADMIN_BOOTSTRAP_PASSWORD_HASH", "").strip()

    if not email or "@" not in email:
        server.logger.error("Admin bootstrap skipped: invalid target email")
        return
    if not password_hash.startswith(("$2a$", "$2b$", "$2y$")) or len(password_hash) < 50:
        server.logger.error("Admin bootstrap skipped: invalid bcrypt hash")
        return

    try:
        rows = server.db.get(
            "admin_users",
            {
                "email": f"eq.{email}",
                "role": "eq.super_admin",
                "select": "id,email,role,is_active",
                "limit": "2",
            },
        ) or []
        if len(rows) != 1:
            server.logger.error("Admin bootstrap skipped: target must resolve to exactly one super-admin")
            return

        admin_id = rows[0]["id"]
        now = datetime.now(timezone.utc).isoformat()
        updated = server.db.patch(
            "admin_users",
            {"id": f"eq.{admin_id}", "role": "eq.super_admin"},
            {
                "password_hash": password_hash,
                "hash_algorithm": "bcrypt",
                "is_active": True,
                "password_changed_at": now,
                "updated_at": now,
            },
        ) or []
        if len(updated) != 1:
            server.logger.error("Admin bootstrap failed: database did not return one updated row")
            return

        try:
            server.db.delete("failed_login_attempts", {"email": f"eq.{email}"})
        except Exception as cleanup_error:
            server.logger.warning(f"Admin bootstrap login-attempt cleanup warning: {type(cleanup_error).__name__}")

        server.logger.info("Admin bootstrap applied successfully to the configured super-admin")
    except Exception as exc:
        server.logger.error(f"Admin bootstrap failed safely: {type(exc).__name__}")


@app.on_event("startup")
async def apply_one_time_admin_bootstrap() -> None:
    _bootstrap_super_admin_from_env()


@app.middleware("http")
async def protect_institution_branding_uploads(request: Request, call_next):
    """Require a live institution-admin session for institution branding uploads.

    The legacy logo endpoint previously accepted unauthenticated requests. This
    wrapper protects the route without changing its response contract, and uses
    the same token/session/account checks as the rest of the API.
    """
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
