# 📁 Backend Information

Complete documentation for OnCampus backend system.

---

## 📄 Available Documentation

### BACKEND_COMPLETE_FEATURES.md
Comprehensive documentation covering:
- **Main App API** (100+ endpoints)
  - Authentication & User Management
  - Groups & Messaging
  - Posts & Feed
  - Engagement Features
  - Institution Admin
  - Content Moderation
  - Push Notifications
  - Search & Discovery
  - Media Management

- **Admin Panel API** (25+ endpoints)
  - Admin Authentication
  - Dashboard Analytics
  - User Management
  - Group Management
  - Content Moderation
  - Error Tracking
  - Security Center
  - System Settings
  - Audit Logging
  - Admin Management

- **Technical Details**
  - Database schema (30+ tables)
  - API architecture
  - Security features
  - Deployment info

---

## 🔗 Quick Links

**Backend URL:** https://perpetual-motivation-production-be1a.up.railway.app  
**API Docs:** https://perpetual-motivation-production-be1a.up.railway.app/docs  
**Health Check:** https://perpetual-motivation-production-be1a.up.railway.app/health  

**Technology:**
- FastAPI (Python 3.11)
- PostgreSQL (Supabase)
- Redis (Upstash) - Optional
- Firebase (Push notifications)
- Railway (Hosting)

---

## 📊 Statistics

- **Total Tables:** 44+ (30 main + 14 admin)
- **Total Endpoints:** 125+ (100 main + 25 admin)
- **Authentication:** JWT + Phone OTP
- **Max Group Size:** 50,000 members
- **Supported Users:** 10,000+ concurrent

---

## 🎯 Main Features

✅ Phone OTP Authentication (Firebase)  
✅ Real-time Group Messaging  
✅ Social Feed & Posts  
✅ Group Discovery  
✅ Institution Management  
✅ Content Moderation  
✅ Push Notifications  
✅ Admin Control Panel  
✅ Analytics Dashboard  
✅ Error Tracking  
✅ Audit Logging  
✅ Security Controls  

---

## 📖 For Developers

**Local Setup:**
```bash
cd backend
pip install -r requirements.txt
python server.py
```

**Environment Variables:**
```env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-key
JWT_SECRET=your-secret
FIREBASE_SERVICE_ACCOUNT_PATH=path/to/firebase.json
```

**API Documentation:**
Visit `/docs` endpoint for interactive Swagger UI

---

## 🔐 Security

- JWT authentication (7-day tokens)
- SHA-256 password hashing
- Phone number hashing
- Rate limiting (Redis)
- IP blocking
- CORS protection
- SQL injection prevention
- Audit logging

---

**For complete details, read BACKEND_COMPLETE_FEATURES.md**

