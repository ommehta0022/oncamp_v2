# OnCampus — Mobile App (UI Only)

## Overview
OnCampus is a mobile-first institutional communication platform for schools and colleges. It combines WhatsApp-grade messaging usability, Telegram-style public group discovery, and LinkedIn-style profile aesthetics — all in a group-only communication model (no DMs, no calls, no jobs/resume).

Built as a **React Native Expo** UI-only app with mock data, role system, and a full theme system.

## Product principles
- **Group-only communication** — no 1:1 DMs, no voice/video calls anywhere in the UI.
- **Role-gated creation** — normal users see NO create-post / create-group buttons.
- Fresh moss-green + terracotta palette.
- Full light + dark + system theme with persistence.

## Roles
Six roles (via `src/context/RoleProvider.tsx`, persisted in AsyncStorage):
- `normal_user` (default) — can join groups, submit poster/post requests, no create UI shown
- `institution_admin` — can create groups, publish posts, access Institution Dashboard
- `group_owner` / `group_admin` / `moderator` — access Group Admin Panel
- `platform_admin`

Role can be switched from **Settings → Demo · switch role** for preview.

## Screens

### Auth flow
- `/index.tsx` — Splash
- `/(auth)/welcome.tsx` — 3-slide onboarding + Get started / Log in / **Register your institution** link
- `/(auth)/login.tsx` — Phone + OTP
- `/(auth)/signup.tsx` — Create account
- `/(auth)/otp.tsx` — 6-digit OTP verify
- `/(auth)/profile-setup.tsx` — Avatar, name, institution, city, bio
- `/(auth)/register-institution.tsx` — **NEW** 3-step institution registration (info → admin/contact → verification docs) with pending_verification notice

### Bottom tabs (5)
- `feed` — LinkedIn-style feed. Composer HIDDEN for normal_user (role-gated).
- `groups` — WhatsApp-style list. Create-group button HIDDEN for normal_user.
- `discover` — **Reference-matched** 2-col dark grid: category badge, verified check, moss-green "Request to join", "TRENDING IN MUMBAI" section, category chips (Trending/Institution/Exam Prep/Entrepreneurship/Creative/Sports/Culture) with black active pill.
- `notifications` (labeled **Alerts** in tab bar) — Tabbed, mark-all-read
- `profile` — Cover, avatar, bio, stats, my groups, achievements

### Group flow
- `group/[id]` — WhatsApp-style chat
- `group/info/[id]` — Cover, admins, members. Shows **Admin panel** row for admin roles; shows **Submit poster request** row for normal_user.
- `group/members/[id]` — Searchable members
- `group/requests/[id]` — Join requests
- `group/admin/[id]` — **NEW** Group Admin Panel: hero + 4 KPIs (members, join requests, post requests, reports) + Manage section (info, members, join requests, post requests, scheduled, published, pinned) + Content & safety (media, reports, permissions, activity log) + Danger zone (transfer ownership, delete)
- `group/admin/post-requests/[id]` — **NEW** Post request inbox: filter tabs, poster preview, requester info, meta grid, Approve / Ask changes / Reject actions, publish now
- `group/post-request/[id]` — **NEW** Submit poster/post request form: upload, title, description, category chips, publish/expiry dates, contact fields

### Institution
- `institution/dashboard.tsx` — **NEW** Institution Dashboard: hero with VERIFIED/UNIVERSITY pills, 4 KPIs, Quick actions (announcement/new group/event/notice), Manage (announcements, groups, post requests, verification, analytics, settings), Recent activity feed, Exit mode

### Utility
- `create-group` — Cover, name, description, category chips, visibility
- `create-post` — Composer with media toolbar
- `search` — Recent, trending, tabbed results
- `saved`, `post/[id]`

### Settings (WhatsApp/LinkedIn/Telegram parity)
- `settings/index` — All sections + **Demo · switch role** (6 roles), opens Institution Dashboard when institution_admin selected
- `settings/edit-profile`, `theme`, `notifications`, `privacy`, `storage`, `language`, `blocked`, `help`, `about`, `invite`

## Data models (mock)
Type-defined in `src/data/mock.ts`:
- `User` with role, verified, badge (student/admin/official/faculty)
- `Group` with visibility (public/private/official), category, role
- `Message` with reply, pinned, own, status
- `FeedPost` with announcement, pinned, image
- `Notification`
- `DiscoverCard` — reference-matched cards (IIT Delhi Class of '27, BITS Pilani Goa, GATE 2027 Aspirants, Startup India Student, IIM-A MBA, Design Students India, JEE Kota, YC Aspirants)
- `PostRequest` with 7 statuses (pending/approved/rejected/needs_changes/scheduled/published/expired)

## Design system
- `src/theme/colors.ts` — Light + dark palettes, moss green (#2E5C4E) + terracotta (#E87A5D) brand, 8pt spacing, radius, font scale
- `src/theme/ThemeProvider.tsx` — Persisted theme
- `src/context/RoleProvider.tsx` — Persisted role with capability flags (canCreatePosts, canCreateGroups, canManageInstitution, isGroupAdmin)

## Backend
**Not wired** — this is UI-only. Firebase / Supabase / Upstash credentials provided by user are NOT INTEGRATED. All actions are local state updates. MOCKED.

## Global UX
- All scrollviews: no scrollbar
- SafeAreaView on every screen
- KeyboardAvoidingView on every input screen
- Chip rows: horizontal scroll, 36pt chip, 56pt row, `flexShrink: 0`
- Haptics on primary actions
- testIDs on every interactive element
