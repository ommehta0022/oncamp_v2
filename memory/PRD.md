# OnCampus — Mobile App (UI Only)

## Overview
OnCampus is a mobile-first institutional communication platform for schools and colleges. It combines WhatsApp-grade messaging usability, Telegram-style public group discovery, and LinkedIn-style profile aesthetics — all in a group-only communication model (no DMs, no calls).

Built as a **React Native Expo** UI-only app with mock data and a full theme system.

## Product principles
- Group-only communication — no 1:1 DMs, no voice/video calls anywhere in the UI.
- Fresh moss-green + terracotta palette (no navy, no purple slop).
- Full light + dark + system theme with persistence.
- All navigation via file-based expo-router.

## Screens (implemented)

### Auth flow
- `/index.tsx` — Splash (auto-redirect based on `oncampus.authed` flag)
- `/(auth)/welcome.tsx` — 3-slide onboarding carousel with campus imagery
- `/(auth)/login.tsx` — Phone + country code, Send OTP
- `/(auth)/signup.tsx` — Create account (name, email, phone) + Terms
- `/(auth)/otp.tsx` — 6-digit OTP verify with resend timer
- `/(auth)/profile-setup.tsx` — Avatar, name, institution, city, bio

### Bottom tabs (5)
- `feed` — LinkedIn-style feed with composer, announcements, pinned, likes, comments, reposts, bookmarks
- `groups` — WhatsApp-style group list with search, filter chips, unread badges, muted, pinned
- `discover` — Telegram-style trending carousel + category pills + rich group cards with join
- `notifications` — Tabbed (All / Mentions / Announcements), unread state, mark-all-read
- `profile` — Cover, avatar, bio, stats, my groups, achievements

### Group screens
- `group/[id]` — WhatsApp-style chat (own vs other bubbles, reply-quote, pinned banner, typing indicator, delivery ticks, composer with attach/emoji/send)
- `group/info/[id]` — Cover, description, admins, join requests, media, pinned, leave/report
- `group/members/[id]` — Searchable members list with role tags
- `group/requests/[id]` — Approve / reject join requests

### Utility
- `create-group` — Cover picker, name, description, category chips, visibility (public/private/official)
- `create-post` — Author, group picker, textarea, media toolbar
- `search` — Recent, trending, tabbed results (Top/Groups/People/Posts)
- `saved` — Bookmarked posts
- `post/[id]` — Post detail + threaded comments + composer

### Settings (comprehensive, LinkedIn/WhatsApp/Telegram parity)
- `settings/index` — All sections
- `settings/edit-profile` — Editable fields with avatar change
- `settings/theme` — Light/Dark/System with visual previews
- `settings/notifications` — Push, mentions, replies, announcements, sound, vibrate, marketing
- `settings/privacy` — Show phone/email, read receipts, last seen, discoverable
- `settings/storage` — Cache visualization, auto-download settings, clear cache
- `settings/language` — 10 Indian languages
- `settings/blocked` — Blocked users list
- `settings/help` — Contact + FAQ
- `settings/about` — Version, ToS, Privacy, Licenses
- `settings/invite` — Invite link, QR, share via WhatsApp/Email/SMS

## Design system
`src/theme/colors.ts` — Light + Dark palettes with brand (moss green #2E5C4E), secondary (terracotta #E87A5D), semantic tokens (success/warning/error/info), 8pt spacing, radius, font scale.
`src/theme/ThemeProvider.tsx` — Persisted theme mode with `useTheme()` hook and AsyncStorage.

## Shared components
`src/components/`: Avatar, Button, Header, EmptyState, SettingsRow

## Mock data
`src/data/mock.ts` — 10 realistic users, 10 groups (batch/clubs/official/events/sports/tech/arts), threaded messages, 6 feed posts (with announcement, pinned, image), 6 notifications, join requests, saved posts, 3 onboarding slides.

## No backend
This is a UI-only build. Firebase / Supabase / Upstash credentials shared by user are not wired — mock data drives the entire experience. All CRUD actions are optimistic-local (state updates only).

## Global UX rules applied
- All ScrollView/FlatList: `showsVerticalScrollIndicator={false}` / `showsHorizontalScrollIndicator={false}` (no visible scrollbars).
- SafeAreaView with proper edges on every screen.
- Filter/category chip rows use horizontal scroll with `flexShrink: 0`, height 56, chip 36pt.
- KeyboardAvoidingView on every input screen.
- Haptics on primary buttons and message send.
- testIDs on every interactive element (kebab-case by role).
