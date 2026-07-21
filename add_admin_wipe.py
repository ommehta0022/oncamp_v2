# Add admin wipe endpoints before the main block
with open('server.py', 'r', encoding='utf-8') as f:
    text = f.read()

admin_wipe_code = '''

# ── ADMIN WIPE ENDPOINTS ──────────────────────────────────────────────────────

def require_platform_admin(user: CurrentUser) -> None:
    """Raise 403 if the caller is not a platform_admin."""
    user_row = safe_get("users", {"id": f"eq.{user.id}", "select": "account_type"})
    if not user_row or user_row[0].get("account_type") != "platform_admin":
        raise HTTPException(status_code=403, detail="Platform admin access required")


WIPE_TARGETS: dict[str, list[str]] = {
    "users": ["saved_posts", "user_follows", "group_members", "notifications", "posts", "users"],
    "posts": ["saved_posts", "posts"],
    "groups": ["group_members", "group_messages", "groups"],
    "institutions": ["group_post_requests", "institutions"],
    "requests": ["group_post_requests", "group_join_requests", "reports"],
    "notifications": ["notifications"],
}

WIPE_ORDER_ALL = [
    "saved_posts", "group_messages", "group_post_requests", "group_join_requests",
    "reports", "notifications", "posts", "group_members", "groups",
    "user_follows", "institutions", "users",
]

DEMO_USERS_PRESERVED: list[str] = []  # Preserve no users; full wipe


@app.post("/v1/admin/wipe/{entity}")
def admin_wipe_entity(
    entity: str,
    user: CurrentUser = Depends(current_user),
) -> dict[str, Any]:
    """Wipe a specific entity from the database. Requires platform_admin."""
    require_platform_admin(user)
    if entity not in WIPE_TARGETS:
        raise HTTPException(status_code=400, detail=f"Unknown entity: {entity}. Valid: {list(WIPE_TARGETS.keys())}")
    
    results: dict[str, int] = {}
    tables = WIPE_TARGETS[entity]
    for table in tables:
        try:
            # For users table, skip the calling admin
            if table == "users":
                rows = safe_get(table, {"id": f"neq.{user.id}", "select": "id"})
            else:
                rows = safe_get(table, {"select": "id"}) if table != "notifications" else safe_get(table, {"select": "id"})
            
            deleted = 0
            for row in rows:
                try:
                    if table == "users":
                        db.delete(table, {"id": f"eq.{row['id']}"})
                    elif table == "notifications":
                        db.delete(table, {"id": f"eq.{row['id']}"})
                    else:
                        db.delete(table, {"id": f"eq.{row['id']}"})
                    deleted += 1
                except Exception:
                    pass
            results[table] = deleted
        except Exception as e:
            results[table] = -1
            logger.error(f"Wipe failed for {table}: {e}")
    
    logger.warning(f"ADMIN WIPE by {user.id}: entity={entity}, results={results}")
    return {"wiped": entity, "results": results}


@app.post("/v1/admin/wipe-all")
def admin_wipe_all(
    user: CurrentUser = Depends(current_user),
) -> dict[str, Any]:
    """Wipe ALL data from the database except the calling admin. Requires platform_admin."""
    require_platform_admin(user)
    
    results: dict[str, int] = {}
    for table in WIPE_ORDER_ALL:
        try:
            if table == "users":
                rows = safe_get(table, {"id": f"neq.{user.id}", "select": "id"})
            else:
                rows = safe_get(table, {"select": "id"})
            deleted = 0
            for row in rows:
                try:
                    db.delete(table, {"id": f"eq.{row['id']}"})
                    deleted += 1
                except Exception:
                    pass
            results[table] = deleted
        except Exception as e:
            results[table] = -1
            logger.error(f"Full wipe failed for {table}: {e}")
    
    logger.warning(f"FULL DB WIPE by {user.id}: results={results}")
    return {"wiped": "all", "results": results}

'''

# Insert before the main block
target = 'if __name__ == "__main__":'
if target in text:
    text = text.replace(target, admin_wipe_code + target)
    with open('server.py', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Added admin wipe endpoints!")
else:
    print("Could not find main block!")
