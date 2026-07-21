import re

with open('server.py', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update /v1/users/me/stats to include streak
old_stats = '''@app.get("/v1/users/me/stats")
def me_stats(user: CurrentUser = Depends(current_user)) -> dict[str, int]:
    groups = safe_get("group_members", {"user_id": f"eq.{user.id}", "status": "eq.active", "select": "group_id"})
    posts = safe_get("posts", {"author_id": f"eq.{user.id}", "select": "id"})
    followers = safe_get("user_follows", {"following_id": f"eq.{user.id}", "select": "follower_id"})
    following = safe_get("user_follows", {"follower_id": f"eq.{user.id}", "select": "following_id"})
    return {
        "groups": len(groups),
        "posts": len(posts),
        "followers": len(followers),
        "following": len(following),
    }'''

new_stats = '''@app.get("/v1/users/me/stats")
def me_stats(user: CurrentUser = Depends(current_user)) -> dict[str, Any]:
    groups = safe_get("group_members", {"user_id": f"eq.{user.id}", "status": "eq.active", "select": "group_id"})
    posts_rows = safe_get("posts", {"author_id": f"eq.{user.id}", "select": "id,created_at", "order": "created_at.desc"})
    followers = safe_get("user_follows", {"following_id": f"eq.{user.id}", "select": "follower_id"})
    following = safe_get("user_follows", {"follower_id": f"eq.{user.id}", "select": "following_id"})
    
    # Compute streak: consecutive days with at least one post
    from datetime import timezone, timedelta
    today_date = datetime.now(timezone.utc).date()
    posted_dates = set()
    for p in posts_rows:
        raw = p.get("created_at") or ""
        try:
            d = datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
            posted_dates.add(d)
        except Exception:
            pass
    streak = 0
    check = today_date
    while check in posted_dates:
        streak += 1
        check = check - timedelta(days=1)
    
    # Days since account created
    user_row = safe_get("users", {"id": f"eq.{user.id}", "select": "created_at"})
    days_since_join = 0
    if user_row:
        try:
            joined = datetime.fromisoformat((user_row[0].get("created_at") or "").replace("Z", "+00:00"))
            days_since_join = (datetime.now(timezone.utc) - joined).days
        except Exception:
            pass
    
    return {
        "groups": len(groups),
        "posts": len(posts_rows),
        "followers": len(followers),
        "following": len(following),
        "streak": streak,
        "daysSinceJoin": days_since_join,
    }


@app.get("/v1/users/me/achievements")
def me_achievements(user: CurrentUser = Depends(current_user)) -> list[dict[str, Any]]:
    """Return dynamically-earned achievement badges for the current user."""
    from datetime import timezone, timedelta
    
    posts_rows = safe_get("posts", {"author_id": f"eq.{user.id}", "select": "id,created_at", "order": "created_at.desc"})
    groups_rows = safe_get("group_members", {"user_id": f"eq.{user.id}", "status": "eq.active", "select": "group_id,role"})
    user_row = safe_get("users", {"id": f"eq.{user.id}", "select": "created_at,verified"})
    
    today_date = datetime.now(timezone.utc).date()
    posted_dates = set()
    for p in posts_rows:
        raw = p.get("created_at") or ""
        try:
            d = datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
            posted_dates.add(d)
        except Exception:
            pass
    streak = 0
    check = today_date
    while check in posted_dates:
        streak += 1
        check = check - timedelta(days=1)
    
    days_since_join = 0
    is_verified = False
    if user_row:
        try:
            joined = datetime.fromisoformat((user_row[0].get("created_at") or "").replace("Z", "+00:00"))
            days_since_join = (datetime.now(timezone.utc) - joined).days
        except Exception:
            pass
        is_verified = bool(user_row[0].get("verified"))
    
    post_count = len(posts_rows)
    group_count = len(groups_rows)
    is_group_leader = any(m.get("role") in ("owner", "admin") for m in groups_rows)
    
    achievements = []
    
    # Streak badges
    if streak >= 30:
        achievements.append({"id": "streak_30", "label": "30 Day Streak", "icon": "flame", "color": "#FF6B35", "earned": True, "description": "Posted every day for 30 days"})
    elif streak >= 7:
        achievements.append({"id": "streak_7", "label": "7 Day Streak", "icon": "flame", "color": "#FF8C42", "earned": True, "description": "Posted 7 days in a row"})
    elif streak >= 3:
        achievements.append({"id": "streak_3", "label": "On a Roll", "icon": "flame-outline", "color": "#FFA500", "earned": True, "description": "3 day posting streak"})
    
    # Days since join
    if days_since_join >= 365:
        achievements.append({"id": "veteran", "label": "Veteran", "icon": "star", "color": "#FFD700", "earned": True, "description": "Been on OnCampus for over a year"})
    elif days_since_join >= 30:
        achievements.append({"id": "pioneer", "label": "Pioneer", "icon": "rocket", "color": "#7B61FF", "earned": True, "description": "Member for 30+ days"})
    elif days_since_join >= 1:
        achievements.append({"id": "early_adopter", "label": "Early Adopter", "icon": "rocket-outline", "color": "#9F6EFF", "earned": True, "description": "Joined the OnCampus journey"})
    
    # Post count
    if post_count >= 50:
        achievements.append({"id": "prolific", "label": "Prolific Writer", "icon": "trophy", "color": "#4CAF50", "earned": True, "description": "Published 50+ posts"})
    elif post_count >= 10:
        achievements.append({"id": "contributor", "label": "Top Contributor", "icon": "trophy-outline", "color": "#66BB6A", "earned": True, "description": "Published 10+ posts"})
    elif post_count >= 1:
        achievements.append({"id": "first_post", "label": "First Post", "icon": "newspaper-outline", "color": "#42A5F5", "earned": True, "description": "Published your first post"})
    
    # Groups
    if group_count >= 5:
        achievements.append({"id": "community_pillar", "label": "Community Pillar", "icon": "people", "color": "#26C6DA", "earned": True, "description": "Active in 5+ groups"})
    
    # Group leadership
    if is_group_leader:
        achievements.append({"id": "group_leader", "label": "Group Leader", "icon": "medal", "color": "#FFC107", "earned": True, "description": "Admin or Owner of a group"})
    
    # Verified
    if is_verified:
        achievements.append({"id": "verified", "label": "Verified Member", "icon": "checkmark-circle", "color": "#00BCD4", "earned": True, "description": "Verified student account"})
    
    # Always give "welcome" if no other achievement
    if not achievements:
        achievements.append({"id": "welcome", "label": "Welcome!", "icon": "heart", "color": "#E91E63", "earned": True, "description": "You joined OnCampus - welcome to campus life!"})
    
    return achievements'''

if old_stats in text:
    text = text.replace(old_stats, new_stats)
    print("Updated stats + achievements!")
else:
    print("Could not find stats block - trying partial match...")
    # Try different approach - find and replace line by line
    print("Content around line 1512:")
    lines = text.split('\n')
    for i, line in enumerate(lines):
        if 'def me_stats' in line:
            print(f"Line {i+1}: {line}")
            break

with open('server.py', 'w', encoding='utf-8') as f:
    f.write(text)
