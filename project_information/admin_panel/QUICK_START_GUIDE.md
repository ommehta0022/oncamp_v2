# 🚀 OnCampus Admin Panel - Quick Start Guide

**Get up and running in 5 minutes!**

---

## ✅ Prerequisites

- Admin Panel URL: https://admin-panel-gray-rho.vercel.app
- Login credentials provided by your organization
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection

---

## 📝 Step-by-Step Guide

### Step 1: Access the Admin Panel (30 seconds)

1. Open your web browser
2. Navigate to: **https://admin-panel-gray-rho.vercel.app**
3. You'll see the login page

### Step 2: First Login (1 minute)

**Default Credentials (Change immediately!):**
```
Email: admin@gmail.com
Password: admin@1234
```

1. Enter email address
2. Enter password
3. Click "Login" button
4. Wait for redirect to dashboard

**Note:** If 2FA is enabled, enter your 6-digit code

### Step 3: Change Your Password (2 minutes)

**⚠️ CRITICAL: Do this immediately!**

1. Click your profile icon (top right)
2. Select "Account Settings"
3. Click "Change Password"
4. Enter current password: `admin@1234`
5. Enter new secure password
6. Confirm new password
7. Click "Update Password"
8. You'll be logged out
9. Login again with new password

**Password Requirements:**
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 number
- At least 1 special character

### Step 4: Enable Two-Factor Authentication (2 minutes)

**Recommended for all Super Admins!**

1. Go to Account Settings
2. Find "Two-Factor Authentication" section
3. Click "Enable 2FA"
4. Scan QR code with authenticator app
   - Google Authenticator
   - Microsoft Authenticator
   - Authy
5. Enter 6-digit code from app
6. Save backup codes securely
7. Click "Confirm"

### Step 5: Explore the Dashboard (5 minutes)

**Dashboard Overview:**

**Top Section - Statistics Cards:**
- **Total Users:** See registered user count
- **Active Users:** Users active in last 24h
- **Total Groups:** All groups created
- **Total Messages:** Platform-wide messages
- **New Users Today:** Recent registrations
- **New Groups Today:** Recently created groups

**Middle Section - Charts:**
- **User Growth Chart:** Track user acquisition
- **Group Activity:** Monitor group engagement
- Hover over points for details
- Change date range (Last 7, 30, 90 days)

**Bottom Section - Recent Activity:**
- Last 20 admin actions
- Real-time updates
- Click to view details

**Sidebar Navigation:**
- 🏠 Dashboard - Main overview
- 👥 Users - Manage users
- 👫 Groups - Manage groups
- ⚖️ Moderation - Content reports
- 📊 Analytics - Detailed metrics
- 🐛 Errors - Error tracking
- 🔒 Security - Security center
- ⚙️ Settings - System config
- 📋 Audit Logs - Action history

---

## 🎯 Common Tasks

### Task 1: View All Users

1. Click "Users" in sidebar
2. See paginated list of users
3. Use search box to find specific users
4. Filter by status (Active, Banned, Muted)
5. Click user name to view details

### Task 2: Ban a User

1. Go to Users page
2. Find the user
3. Click user name to open details
4. Click "Ban User" button
5. Enter ban reason
6. Confirm action
7. User is immediately banned

### Task 3: View All Groups

1. Click "Groups" in sidebar
2. See all groups listed
3. Search by group name
4. Filter by category or status
5. Click group to view details

### Task 4: Resolve Content Report

1. Click "Moderation" in sidebar
2. See pending reports
3. Click report to view details
4. Review reported content
5. Choose action:
   - Ban user
   - Delete content
   - Warn user
   - Dismiss report
6. Add resolution notes
7. Click "Resolve"

### Task 5: View Platform Analytics

1. Click "Analytics" in sidebar
2. See comprehensive metrics:
   - User growth trends
   - Group activity
   - Content engagement
   - Platform health
3. Change date ranges
4. Export reports (CSV/PDF)

### Task 6: Monitor Errors

1. Click "Errors" in sidebar
2. See recent errors
3. Filter by severity (Critical, Error, Warning)
4. Click error to view details:
   - Stack trace
   - Affected users
   - Occurrence count
5. Mark as resolved when fixed

### Task 7: Check Security

1. Click "Security" in sidebar
2. View:
   - Failed login attempts
   - Blocked IPs
   - Active sessions
   - Security alerts
3. Take action:
   - Block suspicious IPs
   - Review failed logins
   - Investigate patterns

### Task 8: Update Settings

1. Click "Settings" in sidebar
2. View platform configuration
3. Edit settings:
   - Platform name
   - Support email
   - Feature flags
   - Content limits
4. Save changes
5. Changes apply immediately

### Task 9: Review Audit Logs

1. Click "Audit Logs" in sidebar
2. See all admin actions
3. Filter by:
   - Admin name
   - Action type
   - Date range
4. Export logs if needed
5. Use for compliance/security

### Task 10: Add New Admin

**Super Admins Only**

1. Go to Settings
2. Click "Admin Management"
3. Click "Add New Admin"
4. Enter details:
   - Name
   - Email
   - Role (Super Admin, Admin, Moderator)
5. Set password
6. Click "Create Admin"
7. New admin receives email

---

## 🔥 Quick Tips

**Keyboard Shortcuts:**
- `Ctrl+K` - Quick search (coming soon)
- `Esc` - Close modals
- `/` - Focus search box

**Best Practices:**
1. ✅ Check dashboard daily
2. ✅ Review moderation queue regularly
3. ✅ Monitor error logs
4. ✅ Keep security settings updated
5. ✅ Review audit logs weekly
6. ✅ Update blocked keywords monthly
7. ✅ Train new admins properly
8. ✅ Use role-based access

**Performance Tips:**
1. Use filters to narrow results
2. Export large datasets instead of viewing
3. Set appropriate refresh rates
4. Close unused browser tabs
5. Clear cache if experiencing issues

---

## ❓ FAQ

**Q: What if I forget my password?**
A: Click "Forgot Password" on login page, enter email, check inbox for reset link.

**Q: Can I login from multiple devices?**
A: Yes! Your session works across devices. View active sessions in Account Settings.

**Q: How do I logout?**
A: Click profile icon (top right) → "Logout"

**Q: What's the difference between Ban and Mute?**
A: 
- **Ban:** User cannot access platform at all
- **Mute:** User can view but cannot post/comment

**Q: Can I undo a ban?**
A: Yes! Go to user profile and click "Unban User"

**Q: How do I export data?**
A: Most pages have "Export" button (CSV/PDF options)

**Q: What if I accidentally delete something?**
A: Contact super admin immediately. Some actions are reversible, others are not.

**Q: How often should I check the dashboard?**
A: Daily for active platforms, at minimum weekly.

**Q: Can I customize the dashboard?**
A: Currently no, but feature coming soon!

**Q: What browsers are supported?**
A: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

---

## 🆘 Getting Help

**Documentation:**
- Complete Features Guide (Parts 1-3)
- API Documentation
- Database Schema
- This Quick Start Guide

**Support:**
- Email: support@oncampus.app
- Check error logs in admin panel
- Review audit logs for clues
- Consult with super admin

**Emergency:**
- Platform down: Check Railway status
- Cannot login: Verify credentials, check 2FA
- Data loss: Contact support immediately
- Security breach: Disable access, contact support

---

## ✅ Checklist for First Day

- [ ] Login to admin panel
- [ ] Change default password
- [ ] Enable two-factor authentication
- [ ] Explore dashboard
- [ ] View users list
- [ ] View groups list
- [ ] Check moderation queue
- [ ] Review analytics
- [ ] Check error logs
- [ ] Review security settings
- [ ] Read audit logs
- [ ] Update profile information
- [ ] Bookmark admin panel URL
- [ ] Save support email
- [ ] Read complete features guide

---

## 🎓 Learning Path

**Week 1: Basics**
- Master dashboard navigation
- Learn user management
- Practice group management
- Understand moderation

**Week 2: Advanced**
- Dive into analytics
- Master error tracking
- Configure security
- Update settings

**Week 3: Expert**
- Admin management
- Audit log analysis
- Database operations (super admin)
- Crisis management

---

**🎉 Congratulations!**

You're now ready to manage the OnCampus platform!

For detailed information, refer to the Complete Features Guide.

**Happy Managing! 🚀**

