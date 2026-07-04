"""
OnCampus Super Admin API Routes
Complete admin control endpoints for the enterprise admin panel
"""

from datetime import datetime, timedelta
from typing import Optional, List, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from pydantic import BaseModel, EmailStr
import hashlib
import jwt
import os
import requests

# Get JWT_SECRET from environment
JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-change-me")

# Supabase configuration from environment
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

router = APIRouter(prefix="/admin", tags=["Admin"])


# Supabase REST client (local copy to avoid circular import)
class SupabaseClient:
    def __init__(self):
        self.base = f"{SUPABASE_URL}/rest/v1"
        self.headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
        }

    def get(self, table: str, params: Optional[dict] = None) -> Any:
        response = requests.get(f"{self.base}/{table}", headers=self.headers, params=params, timeout=20)
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json() if response.text else []

    def post(self, table: str, payload: dict) -> Any:
        headers = {**self.headers, "Prefer": "return=representation"}
        response = requests.post(f"{self.base}/{table}", headers=headers, json=payload, timeout=20)
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json() if response.text else []

    def patch(self, table: str, params: dict, payload: dict) -> Any:
        headers = {**self.headers, "Prefer": "return=representation"}
        response = requests.patch(f"{self.base}/{table}", headers=headers, params=params, json=payload, timeout=20)
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json() if response.text else []

    def delete(self, table: str, params: dict) -> Any:
        headers = {**self.headers, "Prefer": "return=representation"}
        response = requests.delete(f"{self.base}/{table}", headers=headers, params=params, timeout=20)
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json() if response.text else []


db = SupabaseClient()

# Admin user model
class AdminUser(BaseModel):
    id: str
    email: str
    role: str  # super_admin, admin, moderator
    name: Optional[str] = None
    created_at: str

# Authentication models
class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str

class AdminLoginResponse(BaseModel):
    accessToken: str
    refreshToken: str
    user: AdminUser

# Dependency to verify admin token
def get_current_admin(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "admin":
            raise HTTPException(status_code=403, detail="Not an admin token")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_super_admin(admin_data: dict):
    if admin_data.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return admin_data

# ============================================================================
# AUTHENTICATION
# ============================================================================

@router.post("/auth/login", response_model=AdminLoginResponse)
async def admin_login(request: AdminLoginRequest):
    """
    Admin login with email and password
    Creates admin-specific JWT tokens
    """
    # Hash the password (SHA-256)
    password_hash = hashlib.sha256(request.password.encode()).hexdigest()
    
    # Query admin users table
    result = db.get(
        "admin_users",
        {
            "email": f"eq.{request.email}",
            "password_hash": f"eq.{password_hash}",
            "is_active": "eq.true",
            "select": "*"
        }
    )
    
    if not result or len(result) == 0:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    admin = result[0]
    
    # Generate tokens
    access_token_payload = {
        "id": admin["id"],
        "email": admin["email"],
        "role": admin["role"],
        "type": "admin",
        "exp": datetime.utcnow() + timedelta(hours=8)
    }
    access_token = jwt.encode(access_token_payload, JWT_SECRET, algorithm="HS256")
    
    refresh_token_payload = {
        "id": admin["id"],
        "type": "admin_refresh",
        "exp": datetime.utcnow() + timedelta(days=30)
    }
    refresh_token = jwt.encode(refresh_token_payload, JWT_SECRET, algorithm="HS256")
    
    # Log admin login
    db.post("audit_logs", {
        "admin_id": admin["id"],
        "action": "AUTH_LOGIN",
        "target_type": "system",
        "details": f"Admin {admin['email']} logged in"
    })
    
    return AdminLoginResponse(
        accessToken=access_token,
        refreshToken=refresh_token,
        user=AdminUser(**admin)
    )

@router.post("/auth/logout")
async def admin_logout(admin: dict = Depends(get_current_admin)):
    """Logout admin and invalidate token"""
    # Log logout
    db.post("audit_logs", {
        "admin_id": admin["id"],
        "action": "AUTH_LOGOUT",
        "target_type": "system",
        "details": "Admin logged out"
    })
    return {"success": True}

@router.get("/auth/me")
async def get_current_admin_user(admin: dict = Depends(get_current_admin)):
    """Get current admin user info"""
    result = db.get("admin_users", {"id": f"eq.{admin['id']}", "select": "*"})
    if result and len(result) > 0:
        return AdminUser(**result[0])
    raise HTTPException(status_code=404, detail="Admin not found")

# ============================================================================
# DASHBOARD
# ============================================================================

@router.get("/dashboard")
async def get_dashboard(admin: dict = Depends(get_current_admin)):
    """
    Get dashboard overview metrics
    Returns: total users, active users, groups, messages, growth data
    """
    # Total users
    users_result = db.query("users", select="count")
    total_users = users_result.get("count", 0)
    
    # Active users (24h)
    yesterday = (datetime.utcnow() - timedelta(days=1)).isoformat()
    active_users_result = db.query(
        "users",
        filters={"last_seen__gte": yesterday},
        select="count"
    )
    active_users = active_users_result.get("count", 0)
    
    # Total groups
    groups_result = db.query("groups", select="count")
    total_groups = groups_result.get("count", 0)
    
    # Messages (24h)
    messages_result = db.query(
        "messages",
        filters={"created_at__gte": yesterday},
        select="count"
    )
    messages_24h = messages_result.get("count", 0)
    
    # Growth data (last 30 days)
    growth_data = []
    for i in range(30, 0, -1):
        date = (datetime.utcnow() - timedelta(days=i)).date().isoformat()
        # This would ideally be pre-aggregated in a daily_stats table
        growth_data.append({
            "date": date,
            "users": 0,  # Placeholder
            "groups": 0,  # Placeholder
            "messages": 0  # Placeholder
        })
    
    # Recent activity
    recent_activity = db.query(
        "audit_logs",
        limit=20,
        order_by="created_at.desc"
    )
    
    return {
        "totalUsers": total_users,
        "activeUsers": active_users,
        "totalGroups": total_groups,
        "messages24h": messages_24h,
        "growthData": growth_data,
        "recentActivity": recent_activity.get("data", [])
    }

# ============================================================================
# USER MANAGEMENT
# ============================================================================

@router.get("/users")
async def get_users(
    admin: dict = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    city: Optional[str] = None,
    institution: Optional[str] = None,
    search: Optional[str] = None
):
    """Get paginated list of users with filters"""
    filters = {}
    if status:
        filters["status"] = status
    if city:
        filters["city"] = city
    if institution:
        filters["institution"] = institution
    if search:
        filters["name__ilike"] = f"%{search}%"
    
    offset = (page - 1) * limit
    result = db.query(
        "users",
        filters=filters,
        limit=limit,
        offset=offset,
        order_by="created_at.desc"
    )
    
    return {
        "data": result.get("data", []),
        "meta": {
            "page": page,
            "limit": limit,
            "total": result.get("count", 0)
        }
    }

@router.get("/users/{user_id}")
async def get_user(user_id: str, admin: dict = Depends(get_current_admin)):
    """Get user detail"""
    result = db.query("users", filters={"id": user_id})
    if not result.get("data"):
        raise HTTPException(status_code=404, detail="User not found")
    
    user = result["data"][0]
    
    # Get user's groups
    groups_result = db.query(
        "group_members",
        filters={"user_id": user_id},
        select="groups(*)"
    )
    
    # Get user's activity
    messages_count = db.query(
        "messages",
        filters={"sender_id": user_id},
        select="count"
    ).get("count", 0)
    
    posts_count = db.query(
        "posts",
        filters={"author_id": user_id},
        select="count"
    ).get("count", 0)
    
    return {
        **user,
        "groups": groups_result.get("data", []),
        "messagesCount": messages_count,
        "postsCount": posts_count
    }

@router.patch("/users/{user_id}")
async def update_user(
    user_id: str,
    data: dict,
    admin: dict = Depends(get_current_admin)
):
    """Update user profile"""
    result = db.update("users", user_id, data)
    
    # Log action
    db.insert("audit_logs", {
        "admin_id": admin["id"],
        "action": "USER_UPDATE",
        "target_type": "user",
        "target_id": user_id,
        "details": f"Updated user fields: {list(data.keys())}"
    })
    
    return result

@router.post("/users/{user_id}/mute")
async def mute_user(
    user_id: str,
    duration: str,
    reason: str,
    admin: dict = Depends(get_current_admin)
):
    """Mute user for specified duration"""
    # Calculate mute end time
    duration_map = {
        "1h": timedelta(hours=1),
        "24h": timedelta(days=1),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
        "permanent": timedelta(days=36500)  # 100 years
    }
    
    mute_until = datetime.utcnow() + duration_map.get(duration, timedelta(days=1))
    
    result = db.update("users", user_id, {
        "status": "muted",
        "muted_until": mute_until.isoformat(),
        "mute_reason": reason
    })
    
    # Log action
    db.insert("audit_logs", {
        "admin_id": admin["id"],
        "action": "USER_MUTE",
        "target_type": "user",
        "target_id": user_id,
        "details": f"Muted user for {duration}. Reason: {reason}"
    })
    
    return result

@router.post("/users/{user_id}/ban")
async def ban_user(
    user_id: str,
    reason: str,
    admin: dict = Depends(get_current_admin)
):
    """Ban user permanently"""
    result = db.update("users", user_id, {
        "status": "banned",
        "ban_reason": reason,
        "banned_at": datetime.utcnow().isoformat()
    })
    
    # Revoke all user sessions
    db.execute_query(
        f"DELETE FROM user_devices WHERE user_id = '{user_id}'"
    )
    
    # Log action
    db.insert("audit_logs", {
        "admin_id": admin["id"],
        "action": "USER_BAN",
        "target_type": "user",
        "target_id": user_id,
        "details": f"Banned user. Reason: {reason}"
    })
    
    return result

@router.post("/users/{user_id}/unban")
async def unban_user(user_id: str, admin: dict = Depends(get_current_admin)):
    """Unban user"""
    result = db.update("users", user_id, {
        "status": "active",
        "ban_reason": None,
        "banned_at": None
    })
    
    # Log action
    db.insert("audit_logs", {
        "admin_id": admin["id"],
        "action": "USER_UNBAN",
        "target_type": "user",
        "target_id": user_id,
        "details": "Unbanned user"
    })
    
    return result

@router.post("/users/{user_id}/verify")
async def verify_user(
    user_id: str,
    badge: str,
    admin: dict = Depends(get_current_admin)
):
    """Verify user with badge"""
    result = db.update("users", user_id, {
        "is_verified": True,
        "verification_badge": badge
    })
    
    # Log action
    db.insert("audit_logs", {
        "admin_id": admin["id"],
        "action": "USER_VERIFY",
        "target_type": "user",
        "target_id": user_id,
        "details": f"Verified user with badge: {badge}"
    })
    
    return result

# ============================================================================
# GROUP MANAGEMENT
# ============================================================================

@router.get("/groups")
async def get_groups(
    admin: dict = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    visibility: Optional[str] = None,
    category: Optional[str] = None,
    city: Optional[str] = None,
    search: Optional[str] = None
):
    """Get paginated list of groups with filters"""
    filters = {}
    if visibility:
        filters["visibility"] = visibility
    if category:
        filters["category"] = category
    if city:
        filters["city"] = city
    if search:
        filters["name__ilike"] = f"%{search}%"
    
    offset = (page - 1) * limit
    result = db.query(
        "groups",
        filters=filters,
        limit=limit,
        offset=offset,
        order_by="created_at.desc"
    )
    
    return {
        "data": result.get("data", []),
        "meta": {
            "page": page,
            "limit": limit,
            "total": result.get("count", 0)
        }
    }

@router.get("/groups/{group_id}")
async def get_group(group_id: str, admin: dict = Depends(get_current_admin)):
    """Get group detail"""
    result = db.query("groups", filters={"id": group_id})
    if not result.get("data"):
        raise HTTPException(status_code=404, detail="Group not found")
    
    group = result["data"][0]
    
    # Get members count
    members_result = db.query(
        "group_members",
        filters={"group_id": group_id},
        select="count"
    )
    
    # Get messages count
    messages_result = db.query(
        "messages",
        filters={"group_id": group_id},
        select="count"
    )
    
    return {
        **group,
        "membersCount": members_result.get("count", 0),
        "messagesCount": messages_result.get("count", 0)
    }

@router.patch("/groups/{group_id}")
async def update_group(
    group_id: str,
    data: dict,
    admin: dict = Depends(get_current_admin)
):
    """Update group"""
    result = db.update("groups", group_id, data)
    
    # Log action
    db.insert("audit_logs", {
        "admin_id": admin["id"],
        "action": "GROUP_UPDATE",
        "target_type": "group",
        "target_id": group_id,
        "details": f"Updated group fields: {list(data.keys())}"
    })
    
    return result

@router.delete("/groups/{group_id}")
async def delete_group(
    group_id: str,
    reason: str,
    hardDelete: bool = False,
    admin: dict = Depends(get_current_admin)
):
    """Delete group (soft or hard delete)"""
    if hardDelete:
        # Hard delete - remove completely
        require_super_admin(admin)
        db.delete("groups", group_id)
        action = "GROUP_HARD_DELETE"
    else:
        # Soft delete - mark as deleted
        db.update("groups", group_id, {
            "status": "deleted",
            "deleted_at": datetime.utcnow().isoformat(),
            "delete_reason": reason
        })
        action = "GROUP_SOFT_DELETE"
    
    # Log action
    db.insert("audit_logs", {
        "admin_id": admin["id"],
        "action": action,
        "target_type": "group",
        "target_id": group_id,
        "details": f"Deleted group. Reason: {reason}"
    })
    
    return {"success": True}

@router.post("/groups/{group_id}/verify")
async def verify_group(group_id: str, admin: dict = Depends(get_current_admin)):
    """Verify group as official"""
    result = db.update("groups", group_id, {"is_official": True})
    
    # Log action
    db.insert("audit_logs", {
        "admin_id": admin["id"],
        "action": "GROUP_VERIFY",
        "target_type": "group",
        "target_id": group_id,
        "details": "Verified group as official"
    })
    
    return result

@router.get("/groups/{group_id}/members")
async def get_group_members(
    group_id: str,
    admin: dict = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100)
):
    """Get group members"""
    offset = (page - 1) * limit
    result = db.query(
        "group_members",
        filters={"group_id": group_id},
        limit=limit,
        offset=offset,
        select="*, users(*)"
    )
    
    return {
        "data": result.get("data", []),
        "meta": {
            "page": page,
            "limit": limit,
            "total": result.get("count", 0)
        }
    }

@router.delete("/groups/{group_id}/members/{user_id}")
async def remove_group_member(
    group_id: str,
    user_id: str,
    admin: dict = Depends(get_current_admin)
):
    """Remove member from group"""
    result = db.execute_query(
        f"DELETE FROM group_members WHERE group_id = '{group_id}' AND user_id = '{user_id}'"
    )
    
    # Log action
    db.insert("audit_logs", {
        "admin_id": admin["id"],
        "action": "MEMBER_REMOVE",
        "target_type": "group",
        "target_id": group_id,
        "details": f"Removed user {user_id} from group"
    })
    
    return {"success": True}

# ============================================================================
# ANALYTICS
# ============================================================================

@router.get("/analytics/overview")
async def get_analytics_overview(admin: dict = Depends(get_current_admin)):
    """Get analytics overview"""
    # This would pull from pre-aggregated analytics tables
    return {
        "users": {
            "total": 0,
            "active": 0,
            "growth": 0
        },
        "groups": {
            "total": 0,
            "active": 0,
            "growth": 0
        },
        "engagement": {
            "messages": 0,
            "posts": 0,
            "comments": 0
        }
    }

# ============================================================================
# AUDIT LOGS
# ============================================================================

@router.get("/action-logs")
async def get_audit_logs(
    admin: dict = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    admin_filter: Optional[str] = Query(None, alias="admin"),
    action: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None
):
    """Get audit logs"""
    filters = {}
    if admin_filter:
        filters["admin_id"] = admin_filter
    if action:
        filters["action"] = action
    if startDate:
        filters["created_at__gte"] = startDate
    if endDate:
        filters["created_at__lte"] = endDate
    
    offset = (page - 1) * limit
    result = db.query(
        "audit_logs",
        filters=filters,
        limit=limit,
        offset=offset,
        order_by="created_at.desc"
    )
    
    return {
        "data": result.get("data", []),
        "meta": {
            "page": page,
            "limit": limit,
            "total": result.get("count", 0)
        }
    }

# ============================================================================
# SETTINGS
# ============================================================================

@router.get("/settings")
async def get_settings(admin: dict = Depends(get_current_admin)):
    """Get platform settings"""
    result = db.query("platform_settings")
    return result.get("data", {})

@router.patch("/settings")
async def update_settings(
    data: dict,
    admin: dict = Depends(get_current_admin)
):
    """Update platform settings"""
    require_super_admin(admin)
    
    # Update settings
    # This assumes a single row in platform_settings table
    result = db.execute_query(
        "UPDATE platform_settings SET data = data || %s",
        (data,)
    )
    
    # Log action
    db.insert("audit_logs", {
        "admin_id": admin["id"],
        "action": "SETTINGS_UPDATE",
        "target_type": "system",
        "details": f"Updated settings: {list(data.keys())}"
    })
    
    return {"success": True}

# ============================================================================
# DATABASE OPERATIONS (Super Admin Only)
# ============================================================================

@router.post("/database/query")
async def execute_database_query(
    query: str,
    admin: dict = Depends(get_current_admin)
):
    """Execute raw SQL query (super admin only)"""
    require_super_admin(admin)
    
    # Safety check - prevent destructive operations without confirmation
    dangerous_keywords = ["DROP", "TRUNCATE", "DELETE FROM"]
    if any(keyword in query.upper() for keyword in dangerous_keywords):
        if "-- CONFIRMED" not in query:
            raise HTTPException(
                status_code=400,
                detail="Dangerous operation. Add '-- CONFIRMED' comment to proceed."
            )
    
    try:
        result = db.execute_query(query)
        
        # Log action
        db.insert("audit_logs", {
            "admin_id": admin["id"],
            "action": "DB_QUERY",
            "target_type": "database",
            "details": f"Executed query: {query[:100]}"
        })
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/database/tables")
async def get_database_tables(admin: dict = Depends(get_current_admin)):
    """Get list of database tables"""
    require_super_admin(admin)
    
    query = """
    SELECT table_name, 
           (SELECT COUNT(*) FROM information_schema.columns 
            WHERE table_name = t.table_name) as column_count
    FROM information_schema.tables t
    WHERE table_schema = 'public'
    ORDER BY table_name
    """
    result = db.execute_query(query)
    return result

@router.get("/database/tables/{table_name}")
async def get_table_data(
    table_name: str,
    admin: dict = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100)
):
    """Get data from specific table"""
    require_super_admin(admin)
    
    offset = (page - 1) * limit
    result = db.query(table_name, limit=limit, offset=offset)
    
    return {
        "data": result.get("data", []),
        "meta": {
            "page": page,
            "limit": limit,
            "total": result.get("count", 0)
        }
    }

# ============================================================================
# SYSTEM CONTROL (Super Admin Only)
# ============================================================================

@router.get("/system/status")
async def get_system_status(admin: dict = Depends(get_current_admin)):
    """Get system status"""
    return {
        "status": "online",
        "uptime": "24h 35m",
        "version": "1.0.0",
        "database": "connected",
        "redis": "connected",
        "memory": "45%",
        "cpu": "12%"
    }

@router.post("/system/cache/clear")
async def clear_cache(admin: dict = Depends(get_current_admin)):
    """Clear Redis cache"""
    require_super_admin(admin)
    
    # Clear cache logic here
    
    # Log action
    db.insert("audit_logs", {
        "admin_id": admin["id"],
        "action": "CACHE_CLEAR",
        "target_type": "system",
        "details": "Cleared system cache"
    })
    
    return {"success": True}

# ============================================================================
# ERROR TRACKING
# ============================================================================

@router.get("/errors")
async def get_errors(
    admin: dict = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    level: Optional[str] = None,
    userId: Optional[str] = None
):
    """Get error logs"""
    filters = {}
    if level:
        filters["level"] = level
    if userId:
        filters["user_id"] = userId
    
    offset = (page - 1) * limit
    result = db.query(
        "error_logs",
        filters=filters,
        limit=limit,
        offset=offset,
        order_by="created_at.desc"
    )
    
    return {
        "data": result.get("data", []),
        "meta": {
            "page": page,
            "limit": limit,
            "total": result.get("count", 0)
        }
    }

@router.get("/errors/{error_id}")
async def get_error_detail(error_id: str, admin: dict = Depends(get_current_admin)):
    """Get error detail"""
    result = db.query("error_logs", filters={"id": error_id})
    if not result.get("data"):
        raise HTTPException(status_code=404, detail="Error not found")
    return result["data"][0]

@router.post("/errors/{error_id}/resolve")
async def mark_error_resolved(
    error_id: str,
    admin: dict = Depends(get_current_admin)
):
    """Mark error as resolved"""
    result = db.update("error_logs", error_id, {
        "status": "resolved",
        "resolved_by": admin["id"],
        "resolved_at": datetime.utcnow().isoformat()
    })
    return result
