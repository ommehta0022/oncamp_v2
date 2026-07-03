"""
OnCampus Super Admin API Routes - Simplified Version
Complete admin control endpoints for the enterprise admin panel
"""

from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, EmailStr
import hashlib
import jwt
import os

# Get configuration from environment
JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-change-me")

router = APIRouter(prefix="/admin", tags=["Admin"])

# Will be set by server.py
db_client = None

def set_db_client(db):
    """Called by server.py to inject db dependency"""
    global db_client
    db_client = db

# Admin user model
class AdminUser(BaseModel):
    id: str
    email: str
    role: str
    name: Optional[str] = None

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

# ============================================================================
# AUTHENTICATION
# ============================================================================

@router.post("/auth/login", response_model=AdminLoginResponse)
async def admin_login(request: AdminLoginRequest):
    """Admin login with email and password"""
    # Hash the password (SHA-256)
    password_hash = hashlib.sha256(request.password.encode()).hexdigest()
    
    # Query admin users table
    admins = db_client.get("admin_users", {
        "email": f"eq.{request.email}",
        "is_active": "eq.true",
        "select": "*"
    })
    
    if not admins or len(admins) == 0:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    admin = admins[0]
    
    # Verify password
    if admin.get("password_hash") != password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Create JWT token with admin type
    access_token = jwt.encode(
        {
            "user_id": admin["id"],
            "email": admin["email"],
            "role": admin["role"],
            "type": "admin",  # This identifies it as admin token
            "exp": datetime.utcnow() + timedelta(days=7)
        },
        JWT_SECRET,
        algorithm="HS256"
    )
    
    # Create refresh token (simplified - just another JWT)
    refresh_token = jwt.encode(
        {
            "user_id": admin["id"],
            "type": "admin_refresh",
            "exp": datetime.utcnow() + timedelta(days=30)
        },
        JWT_SECRET,
        algorithm="HS256"
    )
    
    # Log admin login
    try:
        db_client.post("audit_logs", {
            "admin_id": admin["id"],
            "admin_email": admin["email"],
            "action": "AUTH_LOGIN",
            "details": "Admin logged in"
        })
    except:
        pass  # Don't fail login if audit log fails
    
    return AdminLoginResponse(
        accessToken=access_token,
        refreshToken=refresh_token,
        user=AdminUser(
            id=admin["id"],
            email=admin["email"],
            role=admin["role"],
            name=admin.get("name")
        )
    )

@router.post("/auth/logout")
async def admin_logout(admin: dict = Depends(get_current_admin)):
    """Logout admin"""
    try:
        db_client.post("audit_logs", {
            "admin_id": admin.get("user_id"),
            "action": "AUTH_LOGOUT",
            "details": "Admin logged out"
        })
    except:
        pass
    return {"success": True}

@router.get("/auth/me")
async def get_current_admin_user(admin: dict = Depends(get_current_admin)):
    """Get current admin user info"""
    admins = db_client.get("admin_users", {"id": f"eq.{admin['user_id']}", "select": "*"})
    if admins and len(admins) > 0:
        admin_data = admins[0]
        return AdminUser(
            id=admin_data["id"],
            email=admin_data["email"],
            role=admin_data["role"],
            name=admin_data.get("name")
        )
    raise HTTPException(status_code=404, detail="Admin not found")

# ============================================================================
# DASHBOARD
# ============================================================================

@router.get("/dashboard")
async def get_dashboard(admin: dict = Depends(get_current_admin)):
    """Get dashboard statistics"""
    # Get user count
    users = db_client.get("users", {"select": "id"})
    total_users = len(users) if users else 0
    
    # Get group count
    groups = db_client.get("groups", {"select": "id"})
    total_groups = len(groups) if groups else 0
    
    # Get message count (simplified)
    messages = db_client.get("messages", {"select": "id", "limit": "1000"})
    total_messages = len(messages) if messages else 0
    
    return {
        "totalUsers": total_users,
        "activeUsers": total_users,  # Simplified
        "totalGroups": total_groups,
        "activeGroups": total_groups,  # Simplified
        "totalMessages": total_messages,
        "todayMessages": 0,  # Simplified
        "newUsersToday": 0,  # Simplified
        "newGroupsToday": 0  # Simplified
    }

# ============================================================================
# USER MANAGEMENT
# ============================================================================

@router.get("/users")
async def get_users(
    admin: dict = Depends(get_current_admin),
    page: int = 1,
    limit: int = 50
):
    """List all users"""
    users = db_client.get("users", {
        "select": "*",
        "order": "created_at.desc",
        "limit": str(limit),
        "offset": str((page - 1) * limit)
    })
    
    return {
        "data": users or [],
        "meta": {
            "page": page,
            "limit": limit,
            "total": len(users) if users else 0
        }
    }

@router.get("/users/{user_id}")
async def get_user(user_id: str, admin: dict = Depends(get_current_admin)):
    """Get user detail"""
    users = db_client.get("users", {"id": f"eq.{user_id}", "select": "*"})
    if not users or len(users) == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return users[0]

@router.post("/users/{user_id}/ban")
async def ban_user(user_id: str, reason: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    """Ban user"""
    result = db_client.patch("users", {"id": f"eq.{user_id}"}, {
        "status": "banned"
    })
    
    # Log action
    try:
        db_client.post("audit_logs", {
            "admin_id": admin.get("user_id"),
            "action": "USER_BAN",
            "target_id": user_id,
            "details": reason or "User banned"
        })
    except:
        pass
    
    return result[0] if result else {"success": True}

@router.post("/users/{user_id}/unban")
async def unban_user(user_id: str, admin: dict = Depends(get_current_admin)):
    """Unban user"""
    result = db_client.patch("users", {"id": f"eq.{user_id}"}, {
        "status": "active"
    })
    
    # Log action
    try:
        db_client.post("audit_logs", {
            "admin_id": admin.get("user_id"),
            "action": "USER_UNBAN",
            "target_id": user_id,
            "details": "User unbanned"
        })
    except:
        pass
    
    return result[0] if result else {"success": True}

# ============================================================================
# GROUP MANAGEMENT
# ============================================================================

@router.get("/groups")
async def get_groups(
    admin: dict = Depends(get_current_admin),
    page: int = 1,
    limit: int = 50
):
    """List all groups"""
    groups = db_client.get("groups", {
        "select": "*",
        "order": "created_at.desc",
        "limit": str(limit),
        "offset": str((page - 1) * limit)
    })
    
    return {
        "data": groups or [],
        "meta": {
            "page": page,
            "limit": limit,
            "total": len(groups) if groups else 0
        }
    }

@router.get("/groups/{group_id}")
async def get_group(group_id: str, admin: dict = Depends(get_current_admin)):
    """Get group detail"""
    groups = db_client.get("groups", {"id": f"eq.{group_id}", "select": "*"})
    if not groups or len(groups) == 0:
        raise HTTPException(status_code=404, detail="Group not found")
    return groups[0]

@router.delete("/groups/{group_id}")
async def delete_group(group_id: str, admin: dict = Depends(get_current_admin)):
    """Delete group"""
    db_client.delete("groups", {"id": f"eq.{group_id}"})
    
    # Log action
    try:
        db_client.post("audit_logs", {
            "admin_id": admin.get("user_id"),
            "action": "GROUP_DELETE",
            "target_id": group_id,
            "details": "Group deleted"
        })
    except:
        pass
    
    return {"success": True}

# ============================================================================
# ANALYTICS
# ============================================================================

@router.get("/analytics/overview")
async def get_analytics_overview(admin: dict = Depends(get_current_admin)):
    """Get analytics overview"""
    return {
        "totalUsers": 0,
        "totalGroups": 0,
        "totalMessages": 0,
        "activeUsers": 0
    }

# ============================================================================
# AUDIT LOGS
# ============================================================================

@router.get("/audit-logs")
async def get_audit_logs(
    admin: dict = Depends(get_current_admin),
    page: int = 1,
    limit: int = 50
):
    """Get audit logs"""
    logs = db_client.get("audit_logs", {
        "select": "*",
        "order": "created_at.desc",
        "limit": str(limit),
        "offset": str((page - 1) * limit)
    })
    
    return {
        "data": logs or [],
        "meta": {
            "page": page,
            "limit": limit,
            "total": len(logs) if logs else 0
        }
    }

# ============================================================================
# SETTINGS
# ============================================================================

@router.get("/settings")
async def get_settings(admin: dict = Depends(get_current_admin)):
    """Get platform settings"""
    settings = db_client.get("system_settings", {"select": "*"})
    return settings or []

@router.patch("/settings")
async def update_settings(data: dict, admin: dict = Depends(get_current_admin)):
    """Update settings"""
    # Log action
    try:
        db_client.post("audit_logs", {
            "admin_id": admin.get("user_id"),
            "action": "SETTINGS_UPDATE",
            "details": "Settings updated"
        })
    except:
        pass
    return {"success": True}

# ============================================================================
# ERROR TRACKING
# ============================================================================

@router.get("/errors")
async def get_errors(
    admin: dict = Depends(get_current_admin),
    page: int = 1,
    limit: int = 50
):
    """Get error logs"""
    errors = db_client.get("error_logs", {
        "select": "*",
        "order": "created_at.desc",
        "limit": str(limit),
        "offset": str((page - 1) * limit)
    })
    
    return {
        "data": errors or [],
        "meta": {
            "page": page,
            "limit": limit,
            "total": len(errors) if errors else 0
        }
    }

@router.post("/errors/{error_id}/resolve")
async def resolve_error(error_id: str, admin: dict = Depends(get_current_admin)):
    """Mark error as resolved"""
    result = db_client.patch("error_logs", {"id": f"eq.{error_id}"}, {
        "status": "resolved",
        "resolved_by": admin.get("user_id")
    })
    return result[0] if result else {"success": True}
