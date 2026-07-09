# PHASE 3: MISSING FEATURES & LOGIC COMPLETION
## Build Every Feature the Backend Supports

> **CRITICAL RULE**: After completing ALL tasks in this file, immediately say:  
> `✅ PHASE 3 COMPLETE. Proceeding to → aqua-app/PHASE-4-POLISH-DEPLOY.md`

> **TRACKING RULE**: Before starting any work, read `aqua-app/TASKS_REMAINING.md` and `aqua-app/TASKS_COMPLETED.md`. After completing each task, move it from REMAINING to COMPLETED with timestamp.

---

## 3.1 — Complete Post System

**COMMAND 53**: Create `app/post/edit/[id].tsx`:
- Pre-fill with existing post data from `api.posts.get(id)`
- Same UI as create-post but in "edit mode"
- Save calls `api.posts.edit(id, body)`
- Show "Post updated" toast on success
- Navigate back

**COMMAND 54**: Add post sharing:
- Share button on every post card
- Uses React Native Share API
- Share text: "{author} on OnCampus: {content_preview}... {deep_link}"
- Track share count if backend supports

**COMMAND 55**: Add "Read more" expansion on long posts (>200 chars):
- Truncate at 200 chars with "...Read more"
- Tap expands with smooth animation
- "Show less" appears when expanded

**COMMAND 56**: Add post type indicators:
- Announcement posts: megaphone icon + branded banner
- Event posts: calendar icon + date/time display
- Emergency posts: red alert banner
- Media posts: image/video gallery
- Regular posts: no special indicator

**COMMAND 57**: Implement infinite scroll pagination on feed:
- Load 20 posts at a time
- Show loading spinner at bottom
- "No more posts" message at end
- Track last post ID/offset for cursor pagination
- Smooth scroll behavior

**COMMAND 58**: Add post reactions beyond like:
- Long-press on like → shows reaction picker (❤️ 👏 🎉 💡 😮)
- Animated pop-up
- Show reaction counts broken down
- Update optimistically

## 3.2 — Complete Group Features

**COMMAND 59**: Create `app/group/edit/[id].tsx`:
- Full group editing form
- Name, description, visibility, category, posting mode
- Avatar upload
- Save calls `api.groups.update(id, body)`
- Only accessible by owner/admin

**COMMAND 60**: Add member management in `app/group/members/[id].tsx`:
- List all members with role badges
- Search members
- Long-press or swipe for actions:
  - Promote to admin/moderator
  - Demote to member
  - Remove from group
  - Mute member
- Only admin/owner sees management options
- Confirm dialog for destructive actions

**COMMAND 61**: Add group mute/unmute:
- Toggle in group info screen
- Muted groups don't send push notifications
- Muted indicator on group list
- Calls backend API

**COMMAND 62**: Add group pinning:
- Long-press on group row → "Pin to top"
- Pinned groups appear in separate section
- Pin icon on pinned groups
- Stored locally (AsyncStorage)

**COMMAND 63**: Implement message search in groups:
- Search icon in chat header
- Expanding search bar
- Highlights matching messages
- Navigate to matched message in list
- "X results found" count

**COMMAND 64**: Add typing indicators in chat:
- Show "John is typing..." at bottom
- Multiple typers: "John, Jane are typing..."
- Animated dots (●●●)
- Auto-dismiss after 3 seconds
- Send typing events on input change

**COMMAND 65**: Add date separators in chat:
- "Today", "Yesterday", "Monday", "June 15"
- Centered in message list
- Semi-transparent background

**COMMAND 66**: Add message reply:
- Swipe right on message to reply
- Reply preview shows above composer
- Reply reference in sent message
- Tap reply reference → scrolls to original

**COMMAND 67**: Add media messages:
- Image messages with thumbnail
- Tap to view full-screen
- Image gallery (swipe between images)
- Upload progress indicator
- Retry on failure

**COMMAND 68**: Add message forwarding:
- Long-press → "Forward"
- Group/user picker
- Forward with original sender attribution

## 3.3 — Complete User Profile Features

**COMMAND 69**: Enhance `app/user/[id].tsx`:
- Show user's recent posts
- Show user's groups (public ones)
- Show mutual connections
- Follow/unfollow with optimistic update
- Message button (create DM or navigate to mutual group)
- Block/Report options in header menu

**COMMAND 70**: Implement `app/user/connections.tsx` properly:
- Tab: Followers / Following
- Search within list
- Follow/unfollow buttons inline
- Navigate to user profile on tap
- Pull-to-refresh
- Mutual follow indicator

**COMMAND 71**: Add profile sharing:
- "Share Profile" button on own profile
- Share link with handle or deep link
- QR code generation for profile

**COMMAND 72**: Add account deletion flow:
- Settings → Account → Delete Account
- Warning screen with consequences
- Require confirmation (type "DELETE")
- Call `api.auth.deleteAccount()`
- Clear all local data
- Navigate to welcome

## 3.4 — Complete Notification System

**COMMAND 73**: Implement push notifications end-to-end:
- Request permission on app start
- Register FCM token with backend
- Handle foreground notifications (in-app banner)
- Handle background notifications
- Handle notification tap → navigate to relevant screen
- Badge count on app icon

**COMMAND 74**: Add notification action handlers:
- "New message" → open group chat at that message
- "New follower" → open user profile
- "Post liked" → open post detail
- "Comment" → open post detail scrolled to comment
- "Join request approved" → open group
- "Post approved" → open post

**COMMAND 75**: Add notification preferences:
- Per-type toggles (messages, likes, comments, follows, etc.)
- Quiet hours (e.g., 10pm–8am)
- Per-group notification settings
- Save to backend via `api.users.updateNotificationPreferences()`

## 3.5 — Complete Search System

**COMMAND 76**: Redesign `app/search.tsx`:
- Tab bar: All / Groups / People / Posts
- Recent searches (stored locally)
- Clear search history
- Trending searches
- Debounced search (300ms delay)
- Results with proper rendering per type:
  - Groups: avatar + name + members + join button
  - People: avatar + name + handle + follow button
  - Posts: author + content preview + engagement counts
- "No results" empty state
- Search within specific group

## 3.6 — Complete Settings System

**COMMAND 77**: Fix `settings/edit-profile.tsx`:
- Avatar change with camera/gallery picker
- Upload avatar via `api` or `imageUpload.uploadAvatar()`
- All profile fields editable
- Validation (name required, bio max 150 chars)
- Save button with loading state
- Cancel confirmation if unsaved changes

**COMMAND 78**: Fix `settings/theme.tsx`:
- Three options: System, Light, Dark
- Live preview as you select
- Persist choice in AsyncStorage
- Apply immediately without restart

**COMMAND 79**: Fix `settings/notifications.tsx`:
- Load current preferences from backend
- Toggle switches for each notification type
- Save changes on each toggle (debounced)
- Sync with push notification permissions

**COMMAND 80**: Fix `settings/blocked.tsx`:
- Load blocked users list from `api.blocked.list()`
- Unblock button with confirmation
- Empty state: "You haven't blocked anyone"

**COMMAND 81**: Fix `settings/privacy.tsx`:
- Profile visibility: Public / Followers only / Private
- Who can message me: Everyone / Followers / Nobody
- Who can see my groups: Everyone / Followers / Nobody
- Save to backend

**COMMAND 82**: Fix `settings/storage.tsx`:
- Show cache size (images, data)
- Clear cache button
- Clear all data button (with confirmation)
- Show app storage info

**COMMAND 83**: Fix `settings/data-export.tsx`:
- Request data export from backend
- Download my data (posts, comments, messages, profile)
- GDPR compliance

## 3.8 — Real-time Features

**COMMAND 90**: Add Supabase Realtime subscription for messages:
- Subscribe to group messages channel
- New messages appear instantly
- Typing indicators
- Online presence

**COMMAND 91**: Add real-time notification updates:
- Badge count updates live
- New notifications appear without refresh
- Sound/vibration on new notification

**COMMAND 92**: Add real-time feed updates:
- New posts badge: "3 new posts — Tap to refresh"
- Like/comment counts update live
- New post notification in feed header

## 3.9 — Accessibility & Internationalization

**COMMAND 93**: Add accessibility labels to all interactive elements:
- `accessibilityLabel` on all buttons
- `accessibilityRole` on all components
- `accessibilityState` for toggles
- VoiceOver/TalkBack compatible

**COMMAND 94**: Add language support infrastructure:
- Create `src/lib/i18n.ts` with English strings
- Structure for adding Hindi, Spanish, French etc.
- Settings screen language picker
- RTL support preparation

## 3.10 — Performance Optimization

**COMMAND 95**: Optimize FlatList rendering:
- `getItemLayout` for fixed-height items
- `removeClippedSubviews` for long lists
- `maxToRenderPerBatch` tuning
- `windowSize` optimization
- `memo` for list item components
- `keyExtractor` using stable IDs

**COMMAND 96**: Optimize image loading:
- Use `expo-image` with caching
- Progressive loading (blur placeholder → full image)
- Proper `contentFit` on all images
- Image prefetching for visible items

**COMMAND 97**: Reduce bundle size:
- Check for unused imports
- Lazy load heavy screens
- Tree-shake unused dependencies
- Optimize assets (compress images/icons)

---

## VERIFICATION CHECKLIST (Phase 3)

- [ ] Post edit/delete/pin/share all work
- [ ] Group edit/members/mute/pin all work
- [ ] Chat has replies, date separators, media, search
- [ ] User profiles show posts/groups/connections
- [ ] Notifications work end-to-end (push + in-app)
- [ ] Search works across groups/users/posts
- [ ] All settings screens save to backend
- [ ] Institution admin screens are functional
- [ ] Real-time updates work for messages
- [ ] Accessibility labels on all interactive elements
- [ ] Performance is smooth (no jank on scroll)
- [ ] `TASKS_REMAINING.md` and `TASKS_COMPLETED.md` are up to date

---

> **NEXT**: After ALL tasks above are complete, proceed to `aqua-app/PHASE-4-POLISH-DEPLOY.md`
