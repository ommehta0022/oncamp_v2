from __future__ import annotations

import os
import sys
from datetime import datetime, timezone

import server


def fail(message: str) -> None:
    print(f"ADMIN_BOOTSTRAP_ERROR: {message}", flush=True)
    raise SystemExit(1)


def main() -> None:
    if os.getenv("ADMIN_BOOTSTRAP_ONCE", "").strip() != "1":
        print("ADMIN_BOOTSTRAP_DISABLED", flush=True)
        return

    email = os.getenv("ADMIN_BOOTSTRAP_EMAIL", "").strip().lower()
    password_hash = os.getenv("ADMIN_BOOTSTRAP_PASSWORD_HASH", "").strip()

    if not email or "@" not in email:
        fail("invalid target email")
    if not password_hash.startswith(("$2a$", "$2b$", "$2y$")) or len(password_hash) < 50:
        fail("invalid bcrypt hash")

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
        fail("target must resolve to exactly one existing super-admin")

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
        fail("database update did not affect exactly one row")

    verified = server.db.get(
        "admin_users",
        {
            "id": f"eq.{admin_id}",
            "role": "eq.super_admin",
            "select": "id,email,role,is_active,hash_algorithm,password_hash",
            "limit": "1",
        },
    ) or []
    if (
        len(verified) != 1
        or verified[0].get("password_hash") != password_hash
        or verified[0].get("hash_algorithm") != "bcrypt"
        or not verified[0].get("is_active")
    ):
        fail("post-update verification failed")

    try:
        server.db.delete("failed_login_attempts", {"email": f"eq.{email}"})
    except Exception as exc:
        print(f"ADMIN_BOOTSTRAP_WARNING: failed-attempt cleanup {type(exc).__name__}", flush=True)

    print("ADMIN_BOOTSTRAP_SUCCESS", flush=True)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:
        print(f"ADMIN_BOOTSTRAP_ERROR: {type(exc).__name__}", flush=True)
        sys.exit(1)
