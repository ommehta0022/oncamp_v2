# PHASE 2: UI OVERHAUL — Premium Design System
## Make Every Screen Look Better Than Emergent

> **CRITICAL RULE**: After completing ALL tasks in this file, immediately say:  
> `✅ PHASE 2 COMPLETE. Proceeding to → aqua-app/PHASE-3-FEATURES.md`

> **TRACKING RULE**: Before starting any work, read `aqua-app/TASKS_REMAINING.md` and `aqua-app/TASKS_COMPLETED.md`. After completing each task, move it from REMAINING to COMPLETED with timestamp.

---

## 2.1 — Design System Overhaul

**COMMAND 23**: Upgrade `src/theme/colors.ts`:
- Add missing color tokens: `danger`, `background`, `card`, `overlay`, `shadow`, `accent`, `highlight`, `link`, `placeholder`, `skeleton`, `inputBg`, `inputBorder`, `inputFocus`
- Add semantic aliases: `textPrimary`, `textSecondary`, `textDisabled`
- Add gradient pairs: `gradientStart`, `gradientEnd` for brand gradient
- Export `xxl: 40` in spacing

**COMMAND 24**: Create `src/theme/typography.ts`:
```typescript
export const typography = {
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.8, lineHeight: 34 },
  h2: { fontSize: 22, fontWeight: '600', letterSpacing: -0.5, lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '600', letterSpacing: -0.3, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodyBold: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  button: { fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
};
```

**COMMAND 25**: Create `src/theme/shadows.ts`:
```typescript
export const shadows = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 6 },
  xl: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10 },
};
```

**COMMAND 26**: Create `src/theme/animations.ts`:
```typescript
import { Animated, Easing } from 'react-native';
export const springConfig = { tension: 100, friction: 8 };
export const fadeIn = (value: Animated.Value, duration = 300) => 
  Animated.timing(value, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true });
export const slideUp = (value: Animated.Value, fromY = 50) =>
  Animated.spring(value, { toValue: 0, ...springConfig, useNativeDriver: true });
export const scalePress = (value: Animated.Value) =>
  Animated.spring(value, { toValue: 0.96, ...springConfig, useNativeDriver: true });
```

## 2.2 — Component Library Upgrade

**COMMAND 27**: Upgrade `src/components/Button.tsx`:
- Add variants: `primary`, `secondary`, `outline`, `ghost`, `danger`, `link`
- Add sizes: `sm`, `md`, `lg`, `xl`
- Add loading state with ActivityIndicator
- Add disabled state with opacity
- Add press animation (scale down on press)
- Add haptic feedback on press
- Add icon support (left/right icon)
- Add full-width option

**COMMAND 28**: Upgrade `src/components/Avatar.tsx`:
- Add online indicator (green dot)
- Add group avatar (first letter with background color)
- Add sizes: `xs` (24), `sm` (32), `md` (40), `lg` (56), `xl` (72), `xxl` (96)
- Add border option
- Add press handler for profile navigation
- Add stacked avatar group component
- Smooth image loading with fade-in animation

**COMMAND 29**: Create `src/components/Input.tsx`:
- Label, placeholder, helper text
- Error state with red border and error message
- Success state with green checkmark
- Password visibility toggle
- Character count
- Clear button
- Left/right icon slots
- Multiline (textarea) variant
- Focus animation (border color change)

**COMMAND 30**: Create `src/components/Badge.tsx`:
- Dot badge (no number)
- Count badge (with number, caps at 99+)
- Status badge (online, offline, away, busy)
- Role badge (admin, moderator, owner, verified)
- Category badge (with color coding)

**COMMAND 31**: Create `src/components/Card.tsx`:
- Pressable card with shadow
- Image card with overlay text
- Stat card (number + label)
- Action card (icon + title + description + arrow)
- Card with header, body, footer sections

**COMMAND 32**: Create `src/components/Toast.tsx`:
- Success, error, warning, info variants
- Auto-dismiss with configurable duration
- Swipe to dismiss
- Position: top or bottom
- Icon + message + optional action
- Create `ToastProvider` context

**COMMAND 33**: Create `src/components/BottomSheet.tsx`:
- Draggable handle
- Snap points (25%, 50%, 75%, full)
- Backdrop with dismissal
- Content scrollable
- Fixed header/footer
- Keyboard-aware

**COMMAND 34**: Create `src/components/Tabs.tsx`:
- Underline tab indicator with animation
- Pill tab variant
- Scrollable tabs for many items
- Badge support on tabs
- Icon + label tabs

**COMMAND 35**: Create `src/components/SearchBar.tsx`:
- Animated expand on focus
- Cancel button appears on focus
- Clear button when has text
- Debounced onChange (300ms)
- Recent searches dropdown
- Search suggestions

**COMMAND 36**: Create `src/components/SkeletonLoader.tsx`:
- Shimmer animation effect
- Variants: line, circle, rect, card, post, message, profile
- Configurable width, height, border radius
- Compose multiple skeletons

**COMMAND 37**: Create `src/components/Chip.tsx`:
- Selectable chip (toggle on/off)
- Chip group (single select / multi-select)
- With icon, avatar, or close button
- Sizes: sm, md

**COMMAND 38**: Create `src/components/Divider.tsx`:
- Horizontal divider with optional label
- Vertical divider
- With or without margins
- Custom color and thickness

**COMMAND 39**: Create `src/components/ConfirmDialog.tsx`:
- Modal overlay
- Title + message
- Cancel + Confirm buttons
- Destructive variant (red confirm)
- Loading state while confirming
- Customizable button labels

## 2.3 — Screen-by-Screen UI Polish

**COMMAND 40**: Redesign `(auth)/welcome.tsx`:
- Full-screen gradient background (brand green → dark)
- App logo centered with scale-in animation
- Tagline with typewriter effect
- "Get Started" button with glow/pulse animation
- "Already have an account? Login" link below
- App version at bottom
- Smooth page transition

**COMMAND 41**: Redesign `(auth)/login.tsx`:
- Clean card-based layout
- Country code picker with flag emoji
- Phone number input with formatting
- "Continue" button with loading state
- Terms of service link
- Back button to welcome

**COMMAND 42**: Redesign `(auth)/otp.tsx`:
- 6-digit OTP input boxes (individual, auto-advance)
- Countdown timer for resend (60 seconds)
- Resend button appears after timer
- Auto-submit when all 6 digits entered
- Error shake animation on wrong code
- Verify button with loading

**COMMAND 43**: Redesign `(auth)/profile-setup.tsx`:
- Step indicator (1/3, 2/3, 3/3)
- Avatar upload with camera/gallery options
- Name input with validation
- Bio textarea with character count
- City/course auto-suggest
- "Skip for now" option
- Celebration confetti on completion

**COMMAND 44**: Redesign `(tabs)/feed.tsx`:
- Floating new post button (FAB) with animation
- Post card redesign:
  - Avatar + name + time + three dots menu
  - Content with "Read more" for long posts
  - Image with aspect ratio handling and tap-to-zoom
  - Like animation (heart burst)
  - Comment count → taps to post detail
  - Bookmark toggle with haptic
  - Share button
- Pull-to-refresh with custom indicator
- Pinned posts section at top with accent bar
- Announcement posts with special styling
- Infinite scroll pagination
- Skeleton loading on initial load

**COMMAND 45**: Redesign `(tabs)/groups.tsx`:
- Sticky search bar at top
- Filter chips (scrollable): All, Unread, Official, Muted
- Group card redesign:
  - Left accent bar (category color)
  - Avatar + name + last message preview
  - Unread badge (pulsing if > 0)
  - Time stamp
  - Category pill + member count
  - Admin/Owner tag
  - Muted indicator
- FAB for create group
- Section headers (Pinned / All Groups)

**COMMAND 46**: Redesign `(tabs)/discover.tsx`:
- Hero section with featured groups carousel
- Category filter chips
- Search bar with suggestions
- Group discover cards:
  - Cover image / gradient background
  - Name + description preview
  - Member count + category
  - "Join" button directly on card
  - Official badge
- Trending section
- Near you section (if city available)

**COMMAND 47**: Redesign `(tabs)/notifications.tsx`:
- Grouped by today / this week / earlier
- Unread indicator (blue dot)
- Mark all read button in header
- Notification types with icons:
  - 💬 Message → group avatar + "New message in..."
  - ❤️ Like → user avatar + "liked your post"
  - 💬 Comment → user avatar + "commented on..."
  - 👥 Follow → user avatar + "started following you"
  - ✅ Approved → check icon + "Your post was approved"
- Swipe to delete
- Tap to navigate to relevant screen
- Empty state with illustration

**COMMAND 48**: Redesign `(tabs)/profile.tsx`:
- Large avatar with edit button overlay
- Name + handle + verified badge
- Bio section
- Stats row (Groups · Posts · Followers · Following) — all tappable
- Action buttons: Edit Profile, Share Profile
- Tab bar: Posts / Groups / Activity
- Settings gear icon in header
- Logout option
- Theme toggle in header

**COMMAND 49**: Redesign `group/[id].tsx` (chat screen):
- Chat header with:
  - Group avatar + name (tappable → info)
  - Member count
  - Online indicator
  - Settings gear / admin shield
- Message bubbles:
  - Own messages (right-aligned, brand color)
  - Others (left-aligned, surface color)
  - Avatar + name for others
  - Time stamp
  - Read receipts (✓✓)
  - Image messages with tap-to-zoom
  - Reply preview above message
  - Long-press context menu
- Pinned message banner at top (tappable)
- Date separator ("Today", "Yesterday", etc.)
- Scroll-to-bottom FAB with new message count
- Typing indicator (animated dots)
- Composer:
  - Text input with auto-grow
  - Attachment button (image, file)
  - Send button (brand color, disabled when empty)
  - Reply preview strip above input

**COMMAND 50**: Redesign `post/[id].tsx` (post detail):
- Full post content
- Author info (tappable → profile)
- Image gallery
- Reaction bar with counts
- Comments section with threading
- Comment composer fixed at bottom
- Three dots menu on post
- Share/Report options
- Related posts at bottom

**COMMAND 51**: Redesign ALL settings screens:
- `settings/index.tsx` — Section-grouped rows with icons
- `settings/edit-profile.tsx` — Form with avatar upload
- `settings/theme.tsx` — System/Light/Dark with preview
- `settings/notifications.tsx` — Toggle switches
- `settings/privacy.tsx` — Toggle switches
- `settings/blocked.tsx` — User list with unblock
- `settings/about.tsx` — App info, version, credits
- `settings/help.tsx` — FAQ accordion + support contact
- `settings/storage.tsx` — Cache info + clear button
- `settings/data-export.tsx` — Download my data
- `settings/report.tsx` — Report form
- `settings/invite.tsx` — Share invite link

**COMMAND 52**: Add micro-animations everywhere:
- Screen transitions (slide/fade)
- Button press scale
- List item fade-in on scroll
- Tab switch slide
- Like heart burst
- Bookmark bounce
- Send message fly-up
- Pull-to-refresh custom
- Skeleton shimmer
- Badge count update pulse

---

## VERIFICATION CHECKLIST (Phase 2)

- [ ] Design tokens (colors, typography, shadows, animations) are complete
- [ ] All 15+ new components are created and working
- [ ] Every screen has been redesigned with premium aesthetics
- [ ] Dark mode works on every screen
- [ ] Animations are smooth (60fps)
- [ ] Haptic feedback on interactive elements
- [ ] All screens handle loading/error/empty states beautifully
- [ ] Typography hierarchy is consistent across app
- [ ] Spacing is consistent (using theme tokens)
- [ ] No hardcoded colors — everything uses theme
- [ ] `TASKS_REMAINING.md` and `TASKS_COMPLETED.md` are up to date

---

> **NEXT**: After ALL tasks above are complete, proceed to `aqua-app/PHASE-3-FEATURES.md`
