<!-- min-version:1.4.0 -->
<!-- force-update:false -->

## OnCampus 1.6.1

- Hardened Android cold startup after reports that the previous APK could install successfully but exit immediately after launch.
- Removed the artificial animated startup delay and the blocking "Opening OnCampus" backend-settings loader; the app now routes as soon as local session state is available.
- Changed Expo Updates launch behavior to start from the embedded, signed application bundle first instead of performing a remote OTA check during native startup.
- Aligned Expo runtime version, Android native runtime resource, semantic app version and Android versionCode at 1.6.1 / 10601.
- Platform settings and temporary backend/network failures no longer block the initial app shell from rendering.
- Upgraded release CI from metadata-only validation to a real Android cold-start smoke test: install the exact release APK on an emulator, launch MainActivity, verify the app process remains alive, inspect the foreground activity and fail on fatal startup log signatures.
- Added Expo project health validation, embedded JavaScript bundle validation, signing verification, zip alignment checks and arm64/x86_64 native-library validation before publication.
- Keeps the existing recoverable React error boundary and signed OTA/native update protections.

This is the recommended Android baseline for replacing the 1.6.0 APK.
