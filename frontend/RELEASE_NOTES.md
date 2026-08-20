<!-- min-version:1.3.0 -->
<!-- force-update:true -->

## OnCampus 1.3.0

- Added server-triggered update campaigns so OnCampus can notify active installations as soon as a new signed OTA is published.
- Added persistent installation registration and Android native push-token registration without requiring an Expo/EAS project token.
- Added a dedicated high-priority App Updates notification channel for background/closed-app update notifications when secure FCM delivery is configured.
- Added foreground/app-resume update checks plus a low-frequency fallback campaign poll so missed push notifications still recover automatically.
- Added professional in-app update installation states: downloading, signature/runtime verification, installed, retry/error handling, and Restart & Apply.
- Signed OTA updates remain runtime locked and never replace the currently working bundle until download and verification succeed.
- Added parallel OTA runtime support so 1.2.0 remains serviceable while 1.3.0 becomes the new native baseline.
- Future React Native JS/UI/assets and compatible business-logic changes can be delivered in-app without another APK; native Android changes still require a new baseline APK.
- Includes Institution Content Studio, advanced institution-to-institution post requests/revisions/approvals, controlled feed/group publishing, notifications, rich post rendering, student publishing restrictions, institution branding/settings fixes, upload security hardening, database security improvements, and admin dashboard stability fixes.
