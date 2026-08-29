<!-- min-version:1.6.0 -->
<!-- force-update:false -->

## OnCampus 1.7.0 — Update Engine v2

OnCampus 1.7.0 replaces the previous Expo remote OTA path with a reusable Android-native update engine designed to remain the baseline for future releases.

- Expo remote updates are disabled in the final Android binary, eliminating the manifest-selection/download state that caused repeated “Try again” failures on 1.6.8.
- Update discovery uses the first-party OnCampus `/v1/updates/v2/latest` control plane.
- APK delivery stays on the OnCampus origin and supports Android resumable/background downloads through DownloadManager.
- Every downloaded APK is verified locally with SHA-256 before installation.
- Android package identity must be exactly `com.oncampus.app`.
- The target Android versionCode must match the approved release and be greater than the installed versionCode.
- The downloaded APK signing certificate must match the certificate of the already installed OnCampus app before the Android installer can open.
- Download state survives React and app-process recreation; a reopened app recovers real bytes/progress from Android DownloadManager.
- Installer cancellation is recoverable without deleting a verified APK or creating an automatic reopen loop.
- Update Engine v2 emits trace IDs and stage/error telemetry so production logs can distinguish check, transfer, hash, package, signing and installer failures.
- Automatic checks continue through server polling and update notifications even though Expo Updates is disabled.
- Release CI validates TypeScript, Expo package compatibility, production bundles, signing, zip alignment, package/version metadata, ABI contents and a real emulator cold launch.

Android still requires the user to confirm installation on the system package-installer screen. OnCampus never bypasses that Android security boundary.

Install 1.7.0 once as the new native baseline. Future OnCampus Android releases can reuse Update Engine v2 for both JavaScript and native changes without relying on Expo remote OTA.
