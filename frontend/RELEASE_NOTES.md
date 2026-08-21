<!-- min-version:1.4.0 -->
<!-- force-update:true -->

## OnCampus 1.5.0

- Fixed the Android update lifecycle so successful updates no longer leave a stale “Retry needed” screen.
- Update completion is detected after restart and shown once per applied version; normal launches stay silent when the app is already current.
- Automatic/server-triggered update checks no longer display manual “up to date” or temporary network-failure dialogs.
- Added secure group voice notes with explicit microphone permission, bounded authenticated uploads, playback, reply, forward, moderation and reporting support.
- Added external OS sharing for posts without reintroducing student repost/publishing or post-request workflows.
- Simplified student settings and profile editing by removing technical version details, cover editing, free-form institution editing and unnecessary profile fields.
- Added professional institution governance: student approvals, faculty/staff, departments, roles and permissions, audit logs, events/RSVP, broadcasts, moderation, analytics, verification, storage, exports, backups and webhook/integration management.
- Added campus QR/invite joining, global campus search, search history/trending, hashtags, mentions, reactions, polls, saved posts, drafts, link previews and activity/version history.
- Added offline-safe campus caching, automatic retry, image compression, accessibility improvements, dark-mode support and campus-wide rate limiting.
- Added marketplace, lost & found, opportunities/placements, campus places/map foundation, attendance, digital ID, emergency alerts, alumni and external LMS/library/SIS/calendar integration foundations.
- Added provider-gated AI moderation/search/recommendation architecture that never fabricates AI output when no provider is configured.
- Runtime 1.5.0 includes the native microphone permission required for group voice notes, so this release is delivered as a new full Android APK.
