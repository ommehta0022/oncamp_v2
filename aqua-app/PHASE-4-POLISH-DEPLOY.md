# PHASE 4: FINAL POLISH, TESTING & DEPLOY
## Make It Production-Ready and Ship It

> **CRITICAL RULE**: After completing ALL tasks in this file, immediately say:  
> `✅ ALL PHASES COMPLETE. App is deploy-ready. Run: npx expo prebuild && eas build`

> **TRACKING RULE**: Before starting any work, read `aqua-app/TASKS_REMAINING.md` and `aqua-app/TASKS_COMPLETED.md`. After completing each task, move it from REMAINING to COMPLETED with timestamp.

---

## 4.1 — Critical Bug Fixes

**COMMAND 98**: Fix ALL TypeScript errors:
- Run `npx tsc --noEmit` in the frontend directory
- Fix every error one by one
- No `@ts-ignore` or `any` types allowed (except for third-party libs)
- Document any remaining type issues

**COMMAND 99**: Fix ALL import issues:
- Check every file has correct import paths
- Remove unused imports
- Fix circular dependencies
- Verify alias paths (`@/src/...`) resolve correctly

**COMMAND 100**: Fix duplicate imports found in previous edits:
- Check `app/group/[id].tsx` for double EmptyState import
- Check `app/(tabs)/feed.tsx` for missing ImageViewer/useRole imports
- Check `app/post/[id].tsx` for missing useRole import
- Scan ALL files for duplicate imports

**COMMAND 101**: Fix layout/styling bugs:
- Tab bar overlap with content (add proper bottom padding)
- Safe area handling on all screens
- Keyboard avoiding on all input screens
- Status bar color matches theme
- Notch/island area handling

## 4.2 — Edge Case Handling

**COMMAND 102**: Handle auth edge cases:
- Token expired during use → auto-refresh
- Refresh token expired → redirect to login with message
- Account banned → show banned message, no retry
- Account deleted → show deleted message
- Network loss during auth flow → show error, allow retry
- Multiple simultaneous auth requests → queue/deduplicate

**COMMAND 103**: Handle data edge cases:
- Group with 0 members (just created)
- Post with very long text (>5000 chars)
- Message with only image (no text)
- User with no avatar (show initials)
- User with no groups (empty state)
- Notification with deleted content (handle gracefully)
- Deep link to deleted post/group (show "not found")

**COMMAND 104**: Handle network edge cases:
- Slow connection (3G) → show loading, don't timeout early
- No connection → show offline banner, use cached data
- Flaky connection → retry with exponential backoff
- Large payload timeout → increase timeout for media uploads
- API returning unexpected shape → defensive parsing

**COMMAND 105**: Handle UI edge cases:
- Very long group/user names → truncate with ellipsis
- Very long messages → word-wrap correctly
- RTL text in messages → handle bidirectional text
- Special characters in names → escape/render properly
- Emoji in text → render at correct size
- Links in messages/posts → make tappable, open in browser

## 4.3 — Security Hardening

**COMMAND 106**: Secure storage:
- Verify tokens stored in SecureStore (not AsyncStorage)
- Clear sensitive data on logout
- No PII in AsyncStorage
- No tokens in console.log

**COMMAND 107**: Input sanitization:
- Sanitize all user inputs before API calls
- Prevent XSS in rendered content
- Validate email/phone formats client-side
- Limit input lengths (name: 100, bio: 500, message: 5000, post: 10000)

**COMMAND 108**: API security:
- All authenticated requests include Bearer token
- Handle 401/403 properly
- No sensitive data in URLs (use body for passwords, etc.)
- Certificate pinning preparation (for production)

## 4.4 — App Configuration

**COMMAND 109**: Update `app.json` / `app.config.ts`:
```json
{
  "name": "OnCampus",
  "slug": "oncampus",
  "version": "1.0.0",
  "orientation": "portrait",
  "icon": "./assets/icon.png",
  "userInterfaceStyle": "automatic",
  "splash": {
    "image": "./assets/splash.png",
    "resizeMode": "contain",
    "backgroundColor": "#2E5C4E"
  },
  "updates": {
    "fallbackToCacheTimeout": 0
  },
  "assetBundlePatterns": ["**/*"],
  "ios": {
    "supportsTablet": true,
    "bundleIdentifier": "com.oncampus.app",
    "infoPlist": {
      "NSCameraUsageDescription": "OnCampus needs camera access to take photos",
      "NSPhotoLibraryUsageDescription": "OnCampus needs photo library access to share images"
    }
  },
  "android": {
    "adaptiveIcon": {
      "foregroundImage": "./assets/adaptive-icon.png",
      "backgroundColor": "#2E5C4E"
    },
    "package": "com.oncampus.app",
    "permissions": ["CAMERA", "READ_EXTERNAL_STORAGE", "VIBRATE"]
  }
}
```

**COMMAND 110**: Verify environment configuration:
- `.env` or `app.config.ts` has correct `API_BASE_URL`
- Firebase config is correct
- Supabase anon key is correct (for realtime if used)
- Push notification setup is complete

## 4.5 — Performance Final Check

**COMMAND 111**: Run performance audit:
- App startup time < 3 seconds
- Screen transition < 300ms
- List scroll at 60fps
- Image loading with proper caching
- Memory usage stable (no leaks)
- Bundle size reasonable

**COMMAND 112**: Optimize startup:
- Lazy load non-critical screens
- Preload critical assets
- Minimize initial API calls
- Use splash screen while loading

**COMMAND 113**: Test on low-end devices:
- Reduce animations if needed
- Lower image quality for slow networks
- Disable heavy features on low memory

## 4.6 — Build & Deploy Preparation

**COMMAND 114**: Create/verify necessary assets:
- App icon (1024×1024 PNG)
- Splash screen (correct dimensions)
- Adaptive icon for Android
- App Store screenshots
- Feature graphic for Play Store

**COMMAND 115**: Configure EAS Build:
- `eas.json` with development, preview, production profiles
- Build credentials configured
- Signing keys ready

**COMMAND 116**: Pre-build verification:
```bash
# Run these in order:
cd frontend
npx tsc --noEmit          # TypeScript check
npx expo doctor           # Expo compatibility check
npx expo prebuild --clean # Generate native projects
```

**COMMAND 117**: Test production build:
```bash
npx expo start --no-dev    # Test in production mode
# OR
eas build --profile preview --platform all
```

**COMMAND 118**: Final integration test checklist:
- [ ] Register new account (phone OTP)
- [ ] Complete profile setup
- [ ] Browse feed
- [ ] Create a post
- [ ] Like/comment on a post
- [ ] Save/bookmark a post
- [ ] Search for groups
- [ ] Join a group
- [ ] Send messages in group
- [ ] Send image in group
- [ ] Reply to a message
- [ ] Create a group (if admin)
- [ ] Manage group members (if admin)
- [ ] View notifications
- [ ] Edit profile
- [ ] Change theme (dark/light)
- [ ] View other user's profile
- [ ] Follow/unfollow user
- [ ] Report content
- [ ] Block user
- [ ] Logout
- [ ] Login again
- [ ] Deep link to post
- [ ] Push notification received and tapped

## 4.7 — Documentation

**COMMAND 119**: Create `frontend/README.md`:
- Project overview
- Tech stack
- Setup instructions
- Environment variables
- Build commands
- Deployment instructions
- Architecture overview
- Contributing guidelines

**COMMAND 120**: Create `frontend/CHANGELOG.md`:
- Version 1.0.0 release notes
- All features implemented
- Known issues

---

## FINAL VERIFICATION CHECKLIST

- [ ] Zero TypeScript errors
- [ ] Zero console errors/warnings
- [ ] All screens render correctly
- [ ] Dark/light mode works everywhere
- [ ] All API integrations working
- [ ] Auth flow complete
- [ ] Push notifications working
- [ ] Search working
- [ ] All CRUD operations working
- [ ] Error handling on every screen
- [ ] Loading states on every screen
- [ ] Empty states on every screen
- [ ] Pull-to-refresh on all lists
- [ ] Performance is smooth
- [ ] Security hardened
- [ ] Assets ready for stores
- [ ] Build succeeds
- [ ] `TASKS_REMAINING.md` is empty
- [ ] `TASKS_COMPLETED.md` has everything

---

> **🎉 APP IS DEPLOY-READY!**
> 
> Run: `cd frontend && eas build --profile production --platform all`
