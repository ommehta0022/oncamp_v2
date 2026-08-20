<!-- min-version:1.3.0 -->
<!-- force-update:true -->

## OnCampus 1.4.0

- Replaced the browser/GitHub APK update flow with a native Android direct installer.
- Update metadata now comes only from the OnCampus backend API; users are no longer sent to a GitHub page when they tap Install.
- APK files download inside OnCampus, show live progress, and are SHA-256 verified before Android is allowed to open the package installer.
- Added a private FileProvider and restricted native installer that accepts only the official HTTPS OnCampus update API endpoint.
- Android 8+ automatically opens the system Allow from this source screen once when required, then resumes the APK download after the user returns.
- After verification, the Android system installer opens automatically; Android's final Install confirmation remains required by the OS security model.
- Runtime 1.4.0 keeps signed OTA delivery for future JS/UI/assets updates and server-triggered update campaigns.
- Version code 140 makes this a clean native upgrade from the 1.2/1.3 testing baselines.
