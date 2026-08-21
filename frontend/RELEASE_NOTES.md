<!-- min-version:1.4.0 -->
<!-- force-update:false -->

## OnCampus 1.5.1

- Fixed repeated update messages when opening or returning to the app.
- Downloaded OTA updates are remembered and are not downloaded or shown again on every launch; manual Update Check still shows the ready-to-apply state.
- Optional native APK update prompts are limited to once per version per 24 hours, while manual checks remain available at any time.
- Forced security/native updates are still enforced, but duplicate prompts are prevented within the same running app session.
- Update success confirmation is shown only once after the new version is actually applied.
- Keeps the Institution-first Discover experience, institution profile, campus groups/events/opportunities, minimal institution mobile controls, and web Institution Studio integration from 1.5.0.
- Includes current backend/security regression coverage, Android/iOS/Web bundle validation, and Android release APK build checks.

Runtime remains 1.5.0 because this patch changes JavaScript/update UX only and does not require a new native runtime.
