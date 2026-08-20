<!-- min-version:1.1.0 -->
<!-- force-update:false -->

## OnCampus 1.2.0

- Added signed over-the-air updates for future React Native JS, UI, and bundled asset changes without reinstalling the APK.
- Native Android changes remain protected by runtime compatibility and continue through normal APK upgrades.
- Added Institution Content Studio with advanced rich post creation, drafts, scheduling, expiry, engagement controls, media, tags, feed publishing, and multi-group publishing.
- Added institution-to-institution content requests with incoming/sent queues, revision tracking, reviewer messages, approve, reject, request-changes, revise, withdraw, and full request timeline.
- Approved institution requests can be published to the receiving institution feed or selected official groups with duplicate-publication protection and publication history.
- Added lifecycle notifications and deep links for new requests, messages, requested changes, revisions, approvals, rejections, withdrawals, and publication updates.
- Removed Create Post, Post Requests, repost/share controls, and publishing history from the student experience; legacy publishing APIs are now institution-admin protected server-side.
- Added rich institution post rendering for headings, bold, italic, lists, quotes, and links.
- Added secure server-only institution collaboration tables with deny-by-default RLS, ownership checks, destination validation, state-transition validation, and rollback-tested workflow constraints.
- Fixed institution dashboard safe-area spacing, cover/logo responsiveness, image loading, and profile overlap.
- Institution brand colors now apply to the live dashboard and refresh immediately after returning from Branding.
- Fixed institution Branding persistence, image MIME handling, caching, and fallback rendering.
- Added institution Logout actions with silent normal logout behavior.
- Fixed institution Settings navigation, refresh, and partial setting updates; removed non-functional placeholder controls.
- Fixed same-device student-to-institution login switching and the device registration conflict.
- Protected institution logo and cover upload endpoints so only authenticated institution admins can upload branding assets.
- Includes the new OnCampus app icon, database security hardening, latency improvements, and admin dashboard crash protection.
