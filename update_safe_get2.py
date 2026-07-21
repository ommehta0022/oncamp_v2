import re

with open('server.py', 'r', encoding='utf-8') as f:
    text = f.read()

target = '''def safe_get(table: str, params: Optional[dict[str, Any]] = None, fallback: Any = None) -> Any:
    try:
        return db.get(table, params)
    except HTTPException as e:
        logger.error(f"safe_get failed for {table}: {e.detail}")
        return [] if fallback is None else fallback'''

replacement = '''def safe_get(table: str, params: Optional[dict[str, Any]] = None, fallback: Any = None) -> Any:
    try:
        return db.get(table, params)
    except HTTPException as e:
        logger.error(f"safe_get failed for {table}: {e.detail}")
        # FOR DEBUGGING: Return a fake record containing the error so we can see it in the app!
        if fallback is None and table == "notifications":
            return [{"id": "error-123", "type": "announcement", "title": "API Error", "body": str(e.detail), "read": False}]
        return [] if fallback is None else fallback'''

if target in text:
    text = text.replace(target, replacement)
    with open('server.py', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Updated safe_get in server.py with debug injection")
else:
    print("Could not find safe_get to replace")
