# OnCampus Super Admin Panel 🚀

## Enterprise-Level Master Control Center

A comprehensive admin panel with **WhatsApp/Telegram/LinkedIn level features** for complete platform control.

---

## ✨ Features

### 🎯 Core Features
- **Super Admin Access** - Complete platform control from startup to shutdown
- **User Management** - Ban, mute, verify, edit any user
- **Group Management** - Full control over all groups and members
- **Content Moderation** - Review reports, delete content, manage violations
- **Database Editor** - Direct database access and editing (VIEW & EDIT)
- **Analytics Dashboard** - Google Analytics level insights
- **Error Tracking** - Every error logged with user ID context
- **Audit Logs** - Complete history of all admin actions
- **System Control** - Start/stop services, view logs, clear cache

### 🔐 Security Features
- **Role-Based Access** - Super Admin, Admin, Moderator roles
- **Sub-Admin Management** - Create limited-access admin accounts
- **2FA Support** - Two-factor authentication
- **IP Whitelisting** - Restrict admin access by IP
- **Rate Limiting** - DDoS protection and abuse prevention
- **Session Management** - View and revoke active sessions

### 📊 Analytics & Monitoring
- **Real-time Dashboards** - Live metrics and charts
- **User Analytics** - DAU, MAU, retention, churn, cohorts
- **Content Analytics** - Engagement, reach, virality tracking
- **Group Analytics** - Health scores, activity patterns
- **Business Metrics** - Revenue, conversion, ROI
- **Error Monitoring** - Stack traces, user context, trend analysis

### 🛠️ Advanced Features
- **Direct Database Access** - SQL query editor with safety controls
- **Live System Logs** - Real-time log streaming
- **Bulk Operations** - Mass user/group management
- **Data Export** - CSV/JSON exports for all data
- **API Tester** - Test backend endpoints directly
- **Feature Flags** - Toggle features without deployment

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn
- Backend running on `http://localhost:4000`
- Supabase credentials configured

### Installation

```bash
# Navigate to admin panel directory
cd d:\automate\oncamp_v2\admin-panel

# Install dependencies
npm install

# Start development server
npm run dev
```

The admin panel will be available at **http://localhost:3001**

### Default Login
```
Email: admin@oncampus.app
Password: Admin@123456
```

---

## 🏗️ Project Structure

```
admin-panel/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── auth/              # Authentication pages
│   │   ├── dashboard/         # Main dashboard
│   │   ├── users/             # User management
│   │   ├── groups/            # Group management
│   │   ├── moderation/        # Content moderation
│   │   ├── analytics/         # Analytics dashboards
│   │   ├── database/          # Database editor
│   │   ├── errors/            # Error tracking
│   │   ├── audit-logs/        # Audit logs
│   │   ├── security/          # Security controls
│   │   ├── system/            # System control
│   │   └── settings/          # Platform settings
│   ├── components/            # Reusable components
│   │   ├── ui/               # UI components
│   │   ├── charts/           # Chart components
│   │   ├── tables/           # Data tables
│   │   └── layout/           # Layout components
│   ├── lib/                   # Utilities
│   │   ├── api.ts            # API client
│   │   ├── utils.ts          # Helper functions
│   │   └── constants.ts      # Constants
│   ├── store/                 # Zustand stores
│   │   ├── auth.ts           # Auth state
│   │   └── ui.ts             # UI state
│   └── types/                 # TypeScript types
├── public/                    # Static assets
├── .env.local                 # Environment variables
├── package.json               # Dependencies
├── tsconfig.json             # TypeScript config
├── tailwind.config.ts        # Tailwind config
└── next.config.js            # Next.js config
```

---

## 🔧 Configuration

### Environment Variables (`.env.local`)

```env
# Backend API
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000

# Supabase Direct Access
NEXT_PUBLIC_SUPABASE_URL=https://nxoqasndyebhiwkkfvnj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# JWT Secret (must match backend)
JWT_SECRET=pG9WpWIIZGuLOEUJXdCeYanbsuuIKiX6IZFM7h4yzsU=

# Feature Flags
NEXT_PUBLIC_ENABLE_DB_EDITOR=true
NEXT_PUBLIC_ENABLE_SYSTEM_CONTROL=true
NEXT_PUBLIC_ENABLE_LIVE_LOGS=true
```

---

## 📦 Deployment

### Option 1: Vercel (Recommended) use.

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### Option 2: Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

### Option 3: Docker

```bash
# Build Docker image
docker build -t oncampus-admin .

# Run container
docker run -p 3001:3001 --env-file .env.local oncampus-admin
```

### Option 4: Traditional Hosting (cPanel, VPS)

```bash
# Build for production
npm run build

# Start production server
npm start

# Or use PM2 for process management
pm2 start npm --name "oncampus-admin" -- start
```

---

## 🔐 Security Best Practices

### Production Checklist
- [ ] Change default admin password
- [ ] Enable 2FA for all super admins
- [ ] Set up IP whitelisting
- [ ] Configure rate limiting
- [ ] Enable audit logging
- [ ] Set up SSL/TLS (HTTPS)
- [ ] Configure CORS properly
- [ ] Use environment variables for secrets
- [ ] Enable session timeout
- [ ] Set up backup admin account

### Recommended Security Settings
```javascript
// Rate Limits
- Login attempts: 5 per 15 minutes
- API calls: 100 per minute
- Database queries: 20 per minute

// Session Settings
- Session timeout: 8 hours
- Refresh token expiry: 30 days
- Max concurrent sessions: 3

// Password Policy
- Minimum length: 12 characters
- Require: uppercase, lowercase, number, symbol
- Password rotation: 90 days
- No password reuse: last 5 passwords
```

---

## 📊 Admin Panel Features Overview

### 1. Dashboard
- Total users, active users, groups, messages
- Growth charts (30-day trends)
- Recent activity feed
- Quick action buttons
- System health indicators

### 2. User Management
- User list with filters (status, city, institution)
- User search (name, phone, email)
- User detail page with full profile
- Mute/Ban/Verify actions
- View user's groups and activity
- Device management

### 3. Group Management
- Group list with filters (visibility, category)
- Group search
- Group detail with members tab
- Verify/Delete group actions
- Member role management
- Join request approval

### 4. Content Moderation
- Report queue (pending/resolved)
- Report detail with context
- Multiple resolution actions
- Auto-flagging suspicious content
- Bulk report handling

### 5. Database Editor
- View all tables
- SQL query editor
- Table data browser
- Row editing (add/update/delete)
- Schema viewer
- Query history

### 6. Error Tracking
- Error list with filters
- Error detail page
- Stack traces
- User context (who triggered error)
- Error trends and grouping
- Mark as resolved

### 7. Analytics
- User analytics (DAU, MAU, retention)
- Content analytics (engagement, reach)
- Group analytics (health, growth)
- Geographic distribution
- Institution insights
- Peak usage times

### 8. Audit Logs
- Complete action history
- Filter by admin, action, date
- Export to CSV
- View action details
- Search logs

### 9. Security Controls
- Rate limit configuration
- Blocked keywords management
- Suspicious activity alerts
- Failed login monitoring
- Admin user management
- IP whitelist/blacklist

### 10. System Control
- Start/stop backend services
- View live logs
- Clear cache
- System status monitoring
- Performance metrics
- Maintenance mode

### 11. Settings
- Platform configuration
- Feature flags
- Email templates
- Notification settings
- Storage quotas
- API settings

---

## 🎨 Design System

### Colors
```css
Primary: #1E3A8A (Deep Navy)
Secondary: #3B82F6 (Electric Blue)
Success: #10B981 (Green)
Warning: #F59E0B (Amber)
Error: #EF4444 (Red)
```

### Components
- **Tables**: TanStack Table with pagination, sorting, filtering
- **Charts**: Recharts for analytics
- **Forms**: React Hook Form + Zod validation
- **UI**: Custom components with Tailwind CSS
- **Notifications**: Sonner for toast notifications

---

## 🔌 API Integration

All API calls go through the centralized API client (`src/lib/api.ts`).

### Example Usage
```typescript
import { api } from '@/lib/api';

// Get dashboard data
const dashboard = await api.getDashboard();

// Get users with filters
const users = await api.getUsers({
  page: 1,
  limit: 50,
  status: 'active',
  city: 'Mumbai'
});

// Ban a user
await api.banUser(userId, 'Spam');

// Execute database query
const result = await api.executeQuery('SELECT * FROM users LIMIT 10');
```

---

## 🧪 Testing

### Manual Testing
1. Login with admin credentials
2. Navigate through all pages
3. Test user management actions
4. Test group management actions
5. Test moderation queue
6. Test database editor
7. Test analytics dashboards
8. Test system controls

### Test Credentials
```
Super Admin: admin@oncampus.app / Admin@123456
Moderator: mod@oncampus.app / Mod@123456
Admin: admin2@oncampus.app / Admin2@123456
```

---

## 🐛 Troubleshooting

### Common Issues

**1. Can't login**
- Check backend is running on port 4000
- Check admin account exists in database
- Check JWT_SECRET matches backend
- Clear browser cache and localStorage

**2. API calls failing**
- Check NEXT_PUBLIC_API_URL is correct
- Check CORS is configured on backend
- Check authentication token is valid
- Check network tab in browser devtools

**3. Database editor not working**
- Check SUPABASE_SERVICE_ROLE_KEY is set
- Check NEXT_PUBLIC_ENABLE_DB_EDITOR=true
- Check Supabase URL is correct
- Check database permissions

**4. Charts not loading**
- Check analytics API endpoints are working
- Check data format matches chart expectations
- Check console for errors
- Refresh the page

---

## 📚 Documentation

### Key Files to Read
- `src/lib/api.ts` - All API endpoints
- `src/store/auth.ts` - Authentication state
- `src/app/dashboard/page.tsx` - Dashboard implementation
- `README.md` - This file

### External Resources
- [Next.js Docs](https://nextjs.org/docs)
- [TanStack Query](https://tanstack.com/query/latest)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Supabase Docs](https://supabase.com/docs)

---

## 🚦 Status

**Current Version**: 1.0.0  
**Status**: ✅ Production Ready  
**Last Updated**: July 3, 2026

### Feature Completion
- [x] Authentication system
- [x] Dashboard with metrics
- [x] User management
- [x] Group management
- [x] Content moderation
- [x] Database editor
- [x] Error tracking
- [x] Analytics dashboards
- [x] Audit logs
- [x] Security controls
- [x] System control
- [x] Settings management
- [x] Sub-admin management
- [x] Responsive design
- [x] Dark mode support
- [x] Export functionality

---

## 📞 Support

For issues or questions:
1. Check troubleshooting section above
2. Review backend logs
3. Check browser console for errors
4. Verify environment variables
5. Test backend endpoints directly

---

## 📝 License

Proprietary - OnCampus Platform  
© 2026 All Rights Reserved

---

## 🎯 Next Steps

1. **Install dependencies**: `npm install`
2. **Configure environment**: Copy `.env.local` and update values
3. **Start backend**: Make sure backend is running on port 4000
4. **Start admin panel**: `npm run dev`
5. **Login**: Use default credentials or create admin account
6. **Explore**: Navigate through all features
7. **Deploy**: Follow deployment guide above

**Admin Panel URL**: http://localhost:3001  
**Default Login**: admin@oncampus.app / Admin@123456

---

**Built with ❤️ for OnCampus Platform**
