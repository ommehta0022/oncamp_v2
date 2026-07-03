# 🔌 OnCampus Admin Panel - Complete API Documentation

**Version:** 1.0.0  
**Base URL:** https://perpetual-motivation-production-be1a.up.railway.app  
**API Prefix:** `/admin`

---

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [Dashboard](#dashboard)
3. [User Management](#user-management)
4. [Group Management](#group-management)
5. [Content Moderation](#content-moderation)
6. [Analytics](#analytics)
7. [Error Tracking](#error-tracking)
8. [Security](#security)
9. [Settings](#settings)
10. [Audit Logs](#audit-logs)
11. [Admin Management](#admin-management)

---

## 🔐 Authentication

All endpoints require authentication except `/admin/auth/login`.

**Authentication Header:**
```
Authorization: Bearer {access_token}
```

### POST /admin/auth/login

**Description:** Admin login with email and password

**Request Body:**
```json
{
  "email": "admin@gmail.com",
  "password": "admin@1234"
}
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid-here",
    "email": "admin@gmail.com",
    "role": "super_admin",
    "name": "Super Admin"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid email or password
- `403 Forbidden` - Account is inactive or suspended

**Notes:**
- Password is hashed using SHA-256 before comparison
- Access token expires in 7 days
- Refresh token expires in 30 days

### POST /admin/auth/logout

**Description:** Logout admin and invalidate session

**Headers:** `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "success": true
}
```

**Notes:**
- Logs logout action in audit_logs table
- Session remains in database but token is client-side removed

---

### GET /admin/auth/me

**Description:** Get current logged-in admin user information

**Headers:** `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "id": "uuid-here",
  "email": "admin@gmail.com",
  "role": "super_admin",
  "name": "Super Admin"
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or expired token
- `404 Not Found` - Admin user not found

---

## 📊 Dashboard

### GET /admin/dashboard

**Description:** Get dashboard statistics and metrics

**Headers:** `Authorization: Bearer {token}`

**Response (200 OK):**
```json
{
  "totalUsers": 1250,
  "activeUsers": 850,
  "totalGroups": 45,
  "activeGroups": 38,
  "totalMessages": 15420,
  "todayMessages": 234,
  "newUsersToday": 12,
  "newGroupsToday": 2
}
```

**Notes:**
- Counts are retrieved from respective tables
- Active users = users with activity in last 24 hours
- Active groups = groups with messages in last 7 days

---

## 👥 User Management

### GET /admin/users

**Description:** Get paginated list of all users

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 50) - Items per page
- `search` (string, optional) - Search by name or email
- `status` (string, optional) - Filter by status (active, banned, muted)

**Request Example:**
```
GET /admin/users?page=1&limit=50&status=active
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "user-uuid-1",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "status": "active",
      "verified": true,
      "avatar_url": "https://example.com/avatar.jpg",
      "created_at": "2025-01-15T10:30:00Z",
      "last_seen": "2026-07-03T08:15:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 1250
  }
}
```

---

### GET /admin/users/{user_id}

**Description:** Get detailed information about a specific user

**Headers:** `Authorization: Bearer {token}`

**Path Parameters:**
- `user_id` (string, required) - User UUID

**Response (200 OK):**
```json
{
  "id": "user-uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "status": "active",
  "verified": true,
  "avatar_url": "https://example.com/avatar.jpg",
  "bio": "Computer Science student",
  "location": "New York",
  "institution_id": "inst-uuid",
  "created_at": "2025-01-15T10:30:00Z",
  "last_seen": "2026-07-03T08:15:00Z",
  "groups_count": 15,
  "posts_count": 124,
  "messages_count": 3420
}
```

**Error Responses:**
- `404 Not Found` - User does not exist

---

### POST /admin/users/{user_id}/ban

**Description:** Ban a user from the platform

**Headers:** `Authorization: Bearer {token}`

**Path Parameters:**
- `user_id` (string, required) - User UUID

**Request Body:**
```json
{
  "reason": "Violated community guidelines - spam"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "status": "banned"
  }
}
```

**Notes:**
- Updates user status to 'banned'
- Logs action in audit_logs table
- Terminates all active sessions

---

### POST /admin/users/{user_id}/unban

**Description:** Unban a previously banned user

**Headers:** `Authorization: Bearer {token}`

**Path Parameters:**
- `user_id` (string, required) - User UUID

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "status": "active"
  }
}
```

---

## 👫 Group Management

### GET /admin/groups

**Description:** Get paginated list of all groups

**Headers:** `Authorization: Bearer {token}`
