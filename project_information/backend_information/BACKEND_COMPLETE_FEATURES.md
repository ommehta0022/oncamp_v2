# 🔧 OnCampus Backend - Complete Features Documentation

**Version:** 1.0.0  
**Backend URL:** https://perpetual-motivation-production-be1a.up.railway.app  
**Tech Stack:** FastAPI + Python 3.11 + PostgreSQL (Supabase)

---

## 📋 Overview

OnCampus backend provides two main systems:
1. **Main App API** - Mobile/web app features (users, groups, posts, messaging)
2. **Admin Panel API** - Administrative control panel

---

## 🎯 Main App Features

### 1. **Authentication & User Management**

**Phone OTP Authentication:**
- `POST /v1/auth/otp/start` - Send OTP to phone
- `POST /v1/auth/otp/verify` - Verify Firebase phone token
- `POST /v1/auth/otp/verify-code` - Dev mode OTP verification
- Dev mode: accepts hardcoded OTP `123456`
- Production: Firebase phone authentication
- JWT tokens: 7-day access, 30-day refresh
- SHA-256 phone hashing for privacy

**User Profile:**
- `GET /v1/auth/me` - Get current user profile
- `PATCH /v1/users/me` - Update profile (name, bio, city, course, avatar)
- `GET /v1/users/me/stats` - Get user statistics (groups, posts, followers)
- `GET /v1/users/{id}` - View other user profiles
- `POST /v1/auth/logout` - Logout

**Profile Fields:**
- Name, bio, city, course, handle
- Avatar URL, default avatar key
- Verified badge, account type
- Profile completion status
- Onboarding skip preferences

### 2. **Groups Management**

**Group Operations:**
- `GET /v1/groups` - My joined groups
- `GET /v1/discovery/groups` - Discover public groups (search, filter)
- `GET /v1/groups/{id}` - Group details
- `POST /v1/groups` - Create new group
- `PATCH /v1/groups/{id}` - Update group info
- `POST /v1/groups/{id}/join` - Join group
- `POST /v1/groups/{id}/leave` - Leave group

**Group Features:**
- Public/Private/Secret visibility
- Join policies: Open, Request, Invite-only
- Posting modes: All members, Admins only, Approval required
- Official badge for verified groups
- Member counts and roles
- Institution-linked groups

**Group Roles:**
- Owner (full control)
- Admin (manage members, posts)
- Moderator (content moderation)
- Member (standard access)

### 3. **Group Messaging**

**Real-time Messaging:**
- `POST /v1/groups/{id}/messages` - Send message
- `GET /v1/groups/{id}/messages` - Get messages (paginated)
- `GET /v1/groups/{id}/messages/unread` - Unread count
- `POST /v1/groups/{id}/messages/read` - Mark as read
- `DELETE /v1/messages/{id}` - Delete message

**Message Types:**
- Text messages
- Media (images, videos)
- Files/documents
- Links with previews
- Reply/thread support

**Message Features:**
- Real-time delivery
- Read receipts
- Message editing (5 min window)
- Message deletion
- Search within group

### 4. **Posts & Feed**

**Post Management:**
- `GET /v1/feed` - Personalized feed (from followed groups)
- `GET /v1/posts/{id}` - View post details
- `POST /v1/posts` - Create post (verified users only)
- `PATCH /v1/posts/{id}` - Edit post
- `DELETE /v1/posts/{id}` - Delete post
- `POST /v1/posts/{id}/pin` - Pin post (group admins)

**Post Types:**
- Regular posts
- Announcements (verified users)
- Emergency notices
- Event posts
- Media posts (images/videos)

**Post Features:**
- Title, content, media
- Pinned posts (stay at top)
- Group association
- Institution association
- Status: draft, published, archived

### 5. **Engagement Features**

**Reactions:**
- `POST /v1/posts/{id}/reaction` - Like post
- `DELETE /v1/posts/{id}/reaction` - Unlike post
- Reaction types: like, love, celebrate, insightful
- Reaction counts per post

**Comments:**
- `POST /v1/posts/{id}/comments` - Add comment
- `GET /v1/posts/{id}/comments` - View comments
- `PATCH /v1/comments/{id}` - Edit comment
- `DELETE /v1/comments/{id}` - Delete comment
- Nested comments (threaded discussions)

**Bookmarks:**
- `POST /v1/posts/{id}/bookmark` - Save post
- `DELETE /v1/posts/{id}/bookmark` - Remove bookmark
- `GET /v1/users/me/bookmarks` - Saved posts

**Social:**
- `POST /v1/users/{id}/follow` - Follow user
- `DELETE /v1/users/{id}/follow` - Unfollow user
- `GET /v1/users/{id}/followers` - View followers
- `GET /v1/users/{id}/following` - View following

### 6. **Institution Admin Features**

**Institution Management:**
- `POST /v1/institutions/register` - Register institution
- `GET /v1/institutions/me` - Institution details
- `PATCH /v1/institutions/me` - Update institution
- `GET /v1/institutions/me/dashboard` - Admin dashboard
- `GET /v1/institutions/me/analytics` - Institution analytics

**Admin Capabilities:**
- Create official groups
- Verify users/groups
- Post announcements
- View institution analytics
- Manage institution admins
- Bulk operations

**Analytics Data:**
- Total students enrolled
- Active users count
- Group engagement metrics
- Post reach statistics
- User growth trends

### 7. **Content Moderation**

**Post Approval System:**
- `POST /v1/groups/{id}/post-requests` - Submit post for approval
- `GET /v1/groups/{id}/post-requests` - View pending posts
- `POST /v1/groups/{id}/post-requests/{id}/approve` - Approve post
- `POST /v1/groups/{id}/post-requests/{id}/reject` - Reject post

**Join Requests:**
- `GET /v1/groups/{id}/join-requests` - View join requests
- `POST /v1/groups/{id}/join-requests/{id}/approve` - Approve member
- `POST /v1/groups/{id}/join-requests/{id}/reject` - Reject request

**Reporting:**
- `POST /v1/posts/{id}/report` - Report post
- `POST /v1/users/{id}/report` - Report user
- `POST /v1/groups/{id}/report` - Report group
- Report categories: spam, harassment, inappropriate content

### 8. **Push Notifications**

**Notification System:**
- `POST /v1/notifications/register-device` - Register FCM token
- `GET /v1/notifications` - Get notifications
- `POST /v1/notifications/{id}/read` - Mark as read
- Firebase Cloud Messaging integration

**Notification Types:**
- New messages
- Post reactions
- Comments
- Group invites
- Join request decisions
- Announcements
- Follows

### 9. **Search & Discovery**

**Search Features:**
- `GET /v1/search/groups` - Search groups
- `GET /v1/search/users` - Search users
- `GET /v1/search/posts` - Search posts
- Fuzzy text matching
- Filter by category, institution, city
- Sort by relevance, recent, popular

**Discovery:**
- Recommended groups based on profile
- Trending posts
- Popular users to follow
- Nearby institutions

### 10. **Media & Files**

**Media Upload:**
- `POST /v1/media/upload` - Upload file
- Supported: images (10MB), videos (100MB), documents (50MB)
- Auto-compression for images
- CDN distribution
- Secure URLs with expiry

**File Management:**
- Cloud storage (configurable)
- Automatic cleanup of unused files
- Thumbnail generation for images
- Video transcoding (optional)

---

## 👨‍💼 Admin Panel API Features

### 1. **Admin Authentication**

**Admin Login:**
- `POST /admin/auth/login` - Email + password login
- `POST /admin/auth/logout` - Logout
- `GET /admin/auth/me` - Current admin info
- JWT with admin type flag
- Session tracking

**Security:**
- SHA-256 password hashing
- Two-factor authentication support
- Session management
- Failed login tracking

### 2. **Dashboard Analytics**

**Dashboard:**
- `GET /admin/dashboard` - Platform statistics
  - Total users, active users
  - Total groups, active groups
  - Total messages, today's messages
  - New users/groups today

### 3. **User Management**

**User Operations:**
- `GET /admin/users` - List all users (paginated)
- `GET /admin/users/{id}` - User details
- `POST /admin/users/{id}/ban` - Ban user
- `POST /admin/users/{id}/unban` - Unban user
- `POST /admin/users/{id}/mute` - Mute user
- `POST /admin/users/{id}/verify` - Verify user
- `DELETE /admin/users/{id}` - Delete user

**Features:**
- Search and filter users
- Bulk operations
- Ban reasons and duration
- User activity history
- Content moderation

### 4. **Group Management**

**Group Operations:**
- `GET /admin/groups` - List all groups
- `GET /admin/groups/{id}` - Group details
- `DELETE /admin/groups/{id}` - Delete group
- `POST /admin/groups/{id}/verify` - Verify group
- `PATCH /admin/groups/{id}` - Update group

**Features:**
- View all groups
- Archive groups
- Transfer ownership
- Manage members
- Group analytics

### 5. **Content Moderation**

**Report Management:**
- `GET /admin/reports` - All content reports
- `GET /admin/reports/{id}` - Report details
- `POST /admin/reports/{id}/resolve` - Resolve report
- `POST /admin/reports/{id}/dismiss` - Dismiss report

**Actions:**
- Ban users
- Delete content
- Issue warnings
- Track violations

### 6. **Error Tracking**

**Error Management:**
- `GET /admin/errors` - All errors
- `GET /admin/errors/{id}` - Error details
- `POST /admin/errors/{id}/resolve` - Mark resolved
- Stack traces
- Error frequency
- Affected users

### 7. **Security Center**

**Security Features:**
- `GET /admin/security/failed-logins` - Failed attempts
- `GET /admin/security/blocked-ips` - Blocked IPs
- `POST /admin/security/block-ip` - Block IP
- `DELETE /admin/security/unblock-ip/{ip}` - Unblock IP

**Rate Limiting:**
- Configurable rate limits
- Per-IP and per-user limits
- Automatic blocking

### 8. **System Settings**

**Configuration:**
- `GET /admin/settings` - All settings
- `PATCH /admin/settings` - Update settings
- `GET /admin/feature-flags` - Feature flags
- `PATCH /admin/feature-flags/{key}` - Toggle feature

**Settings:**
- Platform name, support email
- Content limits
- Feature flags
- Blocked keywords

### 9. **Audit Logging**

**Audit System:**
- `GET /admin/audit-logs` - All actions
- Every admin action logged
- IP address tracking
- Timestamp and details
- Export capability

**Tracked Actions:**
- User bans/unbans
- Content deletions
- Settings changes
- Admin logins
- All modifications

### 10. **Admin Management**

**Admin Users:**
- `GET /admin/admins` - All admins
- `POST /admin/admins` - Create admin
- `PATCH /admin/admins/{id}` - Update admin
- `DELETE /admin/admins/{id}` - Remove admin

**Roles:**
- Super Admin (full access)
- Admin (most features)
- Moderator (content only)

---

## 🔧 Technical Infrastructure

### Database Schema

**Core Tables (30+):**
- `users` - User accounts
- `groups` - Group information
- `group_members` - Group membership
- `messages` - Group messages
- `posts` - User posts
- `post_comments` - Comments
- `post_reactions` - Likes/reactions
- `user_follows` - Follow relationships
- `institutions` - Institution data
- `institution_admins` - Institution admins

**Admin Tables (14):**
- `admin_users` - Admin accounts
- `admin_sessions` - Sessions
- `audit_logs` - Action logs
- `error_logs` - Error tracking
- `system_settings` - Configuration
- `feature_flags` - Feature toggles
- `blocked_ips` - IP blocking
- `blocked_keywords` - Content filters
- `analytics_snapshots` - Daily metrics
- `content_reports` - User reports
- `rate_limit_config` - Rate limits
- `failed_login_attempts` - Security
- `admin_outbox` - Notifications
- `institution_admins` - Institution access

### API Architecture

**Framework:** FastAPI
- Async/await support
- Auto-generated OpenAPI docs
- Type validation (Pydantic)
- High performance

**Authentication:**
- JWT tokens (HS256)
- Phone OTP (Firebase)
- Admin password (SHA-256)
- Role-based access control

**Database:**
- PostgreSQL 14+ (Supabase)
- REST API client
- Connection pooling
- Automatic backups

**Caching:**
- Upstash Redis (optional)
- Rate limiting
- Session storage
- Quick lookups

**Push Notifications:**
- Firebase Cloud Messaging
- Service account auth
- Multi-device support
- Silent + display notifications

### Environment Configuration

**Required:**
- `SUPABASE_URL` - Database URL
- `SUPABASE_SERVICE_ROLE_KEY` - Database key
- `JWT_SECRET` - Token signing key
- `FIREBASE_SERVICE_ACCOUNT_PATH` - FCM credentials

**Optional:**
- `UPSTASH_REDIS_REST_URL` - Cache URL
- `UPSTASH_REDIS_REST_TOKEN` - Cache token
- `CORS_ORIGINS` - Allowed origins
- `DEV_MODE` - Development mode
- `DEV_OTP_CODE` - Dev OTP (123456)

### Security Features

**Implemented:**
- JWT authentication
- Password hashing (SHA-256)
- Phone hashing (privacy)
- CORS protection
- Rate limiting
- IP blocking
- SQL injection prevention
- XSS protection
- HTTPS/TLS
- Audit logging

**Rate Limits:**
- Login: 5 attempts/5 minutes
- OTP: 3 requests/5 minutes
- API: 1000 calls/hour/user
- Public endpoints: 100/minute/IP

---

## 📊 Key Metrics

**Performance:**
- API response: <200ms average
- Database queries: Optimized with indexes
- Concurrent users: 10,000+
- Uptime: 99.9% target

**Scale:**
- 30+ database tables
- 100+ API endpoints
- 14 admin tables
- 25+ admin endpoints
- 50,000+ users per group
- Unlimited messages

**Features:**
- Phone OTP authentication
- Real-time messaging
- Push notifications
- Content moderation
- Admin panel
- Analytics dashboard
- Error tracking
- Audit logging

---

## 🚀 Deployment

**Platform:** Railway  
**URL:** https://perpetual-motivation-production-be1a.up.railway.app  
**Auto-deploy:** On git push  
**Health check:** `/health` endpoint  
**Logs:** Real-time via Railway dashboard  
**Scaling:** Automatic horizontal scaling  

---

## 📞 API Documentation

**OpenAPI Docs:** `/docs` (Swagger UI)  
**ReDoc:** `/redoc` (Alternative UI)  
**Health Check:** `/health` or `/v1/health`  
**Version:** 1.0.0  

---

**🎉 Complete backend system powering OnCampus platform!**

*For detailed API request/response examples, visit the OpenAPI documentation at your backend URL + `/docs`*

