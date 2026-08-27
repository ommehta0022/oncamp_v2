const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const fail = (message) => { throw new Error(message); };
const expect = (condition, message) => { if (!condition) fail(message); };

const app = JSON.parse(read('app.json')).expo;
const pkg = JSON.parse(read('package.json'));
const layout = read('app/_layout.tsx');
const index = read('app/index.tsx');
const theme = read('src/theme/ThemeProvider.tsx');
const palette = read('src/theme/colors.ts');
const role = read('src/context/RoleProvider.tsx');
const accessibility = read('src/context/AccessibilityProvider.tsx');
const pins = read('src/context/PinnedContentProvider.tsx');
const updateGate = read('src/components/AppUpdateGate.tsx');
const backgroundCoordinator = read('src/components/BackgroundOtaCoordinator.tsx');
const backgroundOta = read('src/updates/backgroundOta.ts');
const nativeGuard = read('src/components/NativeOtaStartupGuard.tsx');
const apkInstaller = read('android/app/src/main/java/com/oncampus/app/OnCampusApkInstallerModule.kt');
const apkFilePaths = read('android/app/src/main/res/xml/apk_file_paths.xml');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const strings = read('android/app/src/main/res/values/strings.xml');
const nativeColors = read('android/app/src/main/res/values/colors.xml');
const nativeNightColors = read('android/app/src/main/res/values-night/colors.xml');
const launcher = read('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml');
const launcherRound = read('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml');
const gradle = read('android/app/build.gradle');
const baseStyles = read('android/app/src/main/res/values/styles.xml');
const stylesV27 = read('android/app/src/main/res/values-v27/styles.xml');
const stylesV28 = read('android/app/src/main/res/values-v28/styles.xml');
const stylesV29 = read('android/app/src/main/res/values-v29/styles.xml');
const stylesV33 = read('android/app/src/main/res/values-v33/styles.xml');

const version = String(app.version || '');
const runtime = String(app.runtimeVersion || '');
const parts = version.split('.').map(Number);
expect(/^\d+\.\d+\.\d+$/.test(version), `app version must be semantic x.y.z, found ${version}`);
expect(runtime === version, `runtimeVersion must match app version for native baseline builds: ${runtime} != ${version}`);
expect(parts.length === 3 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 99), `invalid semantic version ${version}`);
const expectedCode = parts[0] * 10000 + parts[1] * 100 + parts[2];
expect(app.android?.versionCode === expectedCode, `versionCode must be ${expectedCode}, found ${app.android?.versionCode}`);
expect(app.android?.package === 'com.oncampus.app', 'Android package changed unexpectedly');
expect(app.icon === './assets/images/icon.png', 'Expo app icon must use the OnCampus icon asset');
expect(app.android?.icon === './assets/images/icon.png', 'Android app icon must explicitly use the OnCampus icon asset');
expect(app.android?.adaptiveIcon?.foregroundImage === './assets/images/adaptive-icon.png', 'Android adaptive icon foreground missing');
expect(app.android?.adaptiveIcon?.backgroundColor === '#FAF9F6', 'Android adaptive icon background must remain neutral pearl');
expect(app.backgroundColor === '#FAF9F6', 'app background must remain neutral pearl');
expect(app.plugins?.some((entry) => Array.isArray(entry) && entry[0] === 'expo-splash-screen' && entry[1]?.backgroundColor === '#FAF9F6' && entry[1]?.dark?.backgroundColor === '#080809'), 'Expo splash plugin must use neutral light/dark backgrounds');
expect(app.updates?.enabled === true, 'Expo Updates must remain enabled');
expect(app.updates?.checkAutomatically === 'NEVER', 'server-driven update discovery must not race native startup checks');
expect(app.updates?.fallbackToCacheTimeout === 0, 'Startup OTA check must never block launching cached/embedded code');
expect(app.extra?.otaRuntimeVersion === runtime, 'extra.otaRuntimeVersion must match runtime');
expect(app.extra?.nativeStartupOta === true, 'nativeStartupOta feature flag must remain enabled');
expect(manifest.includes('EXPO_UPDATES_CHECK_ON_LAUNCH" android:value="NEVER"'), 'native manifest must disable concurrent startup update checks');
expect(manifest.includes('expo.modules.updates.ENABLED" android:value="true"'), 'native Expo Updates module must remain enabled');
expect(manifest.includes('android:icon="@mipmap/ic_launcher"'), 'Android manifest must use adaptive launcher icon resource');
expect(manifest.includes('android:roundIcon="@mipmap/ic_launcher_round"'), 'Android manifest must use adaptive round launcher icon resource');
expect(launcher.includes('@drawable/oncampus_app_icon'), 'adaptive launcher foreground must use the OnCampus logo');
expect(launcherRound.includes('@drawable/oncampus_app_icon'), 'round adaptive launcher foreground must use the OnCampus logo');
expect(manifest.includes('<uses-feature android:name="android.hardware.camera" android:required="false"/>'), 'camera hardware must be optional');
expect(manifest.includes('<uses-feature android:name="android.hardware.microphone" android:required="false"/>'), 'microphone hardware must be optional');
expect(strings.includes(`name="expo_runtime_version" translatable="false">${runtime}</string>`), `native runtime string must be ${runtime}`);
expect(gradle.includes(`?: "${version}"`), `Gradle versionName default must be ${version}`);
expect(gradle.includes(`?: "${expectedCode}"`), `Gradle versionCode default must be ${expectedCode}`);
expect(gradle.includes("require.resolve('@expo/cli'"), 'Gradle must explicitly resolve the Expo CLI entry file');
const cliFileAssignment = gradle.split('\n').find((line) => line.includes('cliFile =')) || '';
expect(cliFileAssignment.includes('.getAbsoluteFile()'), 'Gradle cliFile must resolve to an absolute file');
expect(!cliFileAssignment.includes('.getParentFile()'), 'Gradle cliFile must reference the Expo CLI file, not its parent directory');

expect(!baseStyles.includes('android:windowLightNavigationBar'), 'API 27 navigation attribute must not live in base values');
expect(!baseStyles.includes('android:windowLayoutInDisplayCutoutMode'), 'API 28 cutout attribute must not live in base values');
expect(!baseStyles.includes('android:enforceNavigationBarContrast'), 'API 29 contrast attribute must not live in base values');
expect(!baseStyles.includes('android:windowSplashScreenBehavior'), 'API 33 splash behavior must not live in base values');
expect(stylesV27.includes('android:windowLightNavigationBar'), 'API 27 navigation style missing');
expect(stylesV28.includes('android:windowLayoutInDisplayCutoutMode'), 'API 28 cutout style missing');
expect(stylesV29.includes('android:enforceNavigationBarContrast'), 'API 29 contrast style missing');
expect(stylesV33.includes('android:windowSplashScreenBehavior'), 'API 33 splash behavior missing');

const lightPalette = palette.split('export const lightColors = {')[1]?.split('};')[0] || '';
const darkPalette = palette.split('export const darkColors = {')[1]?.split('};')[0] || '';
expect(lightPalette.includes('surface: "#FCFCF9"'), 'light mode must match the oncampuses-v1 foundation surface');
expect(lightPalette.includes('brandPrimary: "#2E5C4E"') && lightPalette.includes('brandSecondary: "#E87A5D"'), 'light moss/terracotta brand identity contract missing');
expect(lightPalette.includes('success: "#2F7D5C"') && lightPalette.includes('warning: "#B7791F"') && lightPalette.includes('error: "#C04444"') && lightPalette.includes('info: "#4A788C"'), 'light semantic state palette contract missing');
expect(darkPalette.includes('surface: "#151717"'), 'dark mode must match the oncampuses-v1 foundation surface');
expect(darkPalette.includes('card: "#1C1F1E"'), 'dark mode cards must match the reference neutral surface');
expect(darkPalette.includes('brandPrimary: "#7FB19F"') && darkPalette.includes('brandSecondary: "#F0A48D"'), 'dark moss/terracotta brand identity contract missing');
expect(darkPalette.includes('success: "#6FC99E"') && darkPalette.includes('warning: "#E2B66A"') && darkPalette.includes('error: "#E27A7A"') && darkPalette.includes('info: "#82B1C2"'), 'dark semantic state palette contract missing');
for (const semanticToken of ['actionPrimary:', 'actionSecondary:', 'actionDanger:', 'tabActive:', 'tabBadge:', 'selectionStrong:', 'reactionActive:', 'announcement:']) { expect(lightPalette.includes(semanticToken) && darkPalette.includes(semanticToken), `semantic component token ${semanticToken} missing`); }
for (const oldBlue of ['#1267F4', '#0B67C8', '#4AA8FF', '#0B49BD', '#075DAF', '#74BBFF']) {
  expect(!palette.includes(oldBlue), `legacy blue palette token ${oldBlue} must not return`);
  expect(!nativeColors.includes(oldBlue) && !nativeNightColors.includes(oldBlue), `legacy blue native startup token ${oldBlue} must not return`);
}
expect(nativeColors.includes('<color name="splashscreen_background">#FAF9F6</color>'), 'native light splash must be pearl');
expect(nativeNightColors.includes('<color name="splashscreen_background">#080809</color>'), 'native dark splash must be obsidian');
expect(theme.includes('export type ThemeMode = "light" | "dark"'), 'appearance must expose exactly Light and Dark modes');
expect(!theme.includes('type ThemeMode = "light" | "dark" | "system"'), 'System mode must not return');

const expectedDeps = {
  expo: '54.0.37',
  'expo-asset': '12.0.13',
  'expo-background-task': '1.0.10',
  'expo-constants': '18.0.14',
  'expo-audio': '1.1.1',
  'expo-task-manager': '14.0.9',
  'expo-updates': '29.0.20',
};
for (const [name, pinned] of Object.entries(expectedDeps)) {
  expect(pkg.dependencies?.[name] === pinned, `${name} must be pinned to ${pinned}`);
}

expect(layout.includes('import { AccessibilityProvider }'), 'RootLayout must import AccessibilityProvider');
expect(layout.includes('NativeOtaStartupGuard'), 'RootLayout must mount the native OTA startup observer');
expect(layout.includes('BackgroundOtaCoordinator'), 'RootLayout must mount the resilient background OTA coordinator');
expect(layout.includes('PinnedContentProvider'), 'RootLayout must mount personal pin persistence');
const aOpen = layout.indexOf('<AccessibilityProvider>');
const tOpen = layout.indexOf('<ThemeProvider>');
const tClose = layout.indexOf('</ThemeProvider>');
const aClose = layout.indexOf('</AccessibilityProvider>');
expect(aOpen >= 0 && tOpen > aOpen && tClose > tOpen && aClose > tClose, 'AccessibilityProvider must wrap ThemeProvider');
expect(theme.includes('useAccessibilityPreferences()'), 'ThemeProvider accessibility dependency unexpectedly changed');
expect(theme.includes('.catch(() =>'), 'Theme storage hydration must have a failure path');
expect(theme.includes('.finally(() =>'), 'Theme storage hydration must always complete');
expect(role.includes('finally') && role.includes('setHydrated(true)'), 'Role hydration must always complete');
expect(accessibility.includes('.catch(() =>') && accessibility.includes('.finally(() =>'), 'Accessibility bootstrap must be fail-safe');
expect(pins.includes('oncampus.personal-pins.v1'), 'personal pin storage key missing');
expect(pins.includes('togglePostPin') && pins.includes('toggleGroupPin'), 'post/group pin controls missing');

for (const feature of ['background-ota-coordinator', 'native-ota-startup-guard', 'app-update-gate', 'server-update-coordinator', 'session-expired-modal']) {
  expect(layout.includes(`<OptionalFeatureBoundary name="${feature}">`), `${feature} must be isolated from the app shell`);
}

expect(backgroundCoordinator.includes('AppState.addEventListener'), 'background OTA coordinator must react to minimize/resume transitions');
expect(backgroundCoordinator.includes('setupBackgroundOta()'), 'background OTA WorkManager registration missing');
expect(backgroundCoordinator.includes('prefetchLatestOta'), 'foreground OTA prefetch missing');
expect(backgroundOta.includes('TaskManager.defineTask'), 'headless OTA task must be defined at module scope');
expect(backgroundOta.includes('BackgroundTask.registerTaskAsync'), 'background OTA task registration missing');
expect(backgroundOta.includes('minimumInterval: BACKGROUND_MIN_INTERVAL_MINUTES'), 'background OTA interval contract missing');
expect(backgroundOta.includes('FETCH_ATTEMPTS = 4'), 'OTA retry contract missing');
expect(backgroundOta.includes('Updates.fetchUpdateAsync()'), 'background OTA must fetch the signed update');
expect(!backgroundOta.includes('Updates.reloadAsync()'), 'background OTA worker must never reload the hidden app');
expect(!backgroundOta.includes('Updates.checkForUpdateAsync()'), 'background OTA discovery must not depend on Expo check promises');

expect(updateGate.includes('DEFER_MS = 6 * 60 * 60 * 1000'), 'OTA Later quiet-period contract missing');
expect(updateGate.includes('phase: "available"'), 'unified update available UI missing');
expect(updateGate.includes('Update now'), 'OTA Update now action missing');
expect(updateGate.includes('prefetchLatestOta(true)'), 'Update now must share the resilient OTA retry engine');
expect(updateGate.includes('APPLY_OTA_ON_RESUME_KEY'), 'minimize-safe persisted OTA apply intent missing');
expect(updateGate.includes('resumePendingOtaApply()'), 'OTA apply-on-resume handler missing');
expect(updateGate.includes('AppState.currentState !== "active"'), 'hidden app must not reload itself');
expect(updateGate.includes('You can minimize OnCampus'), 'background-safe OTA user guidance missing');
expect(updateGate.includes('restartForOta'), 'isolated OTA cold-restart activation missing');
expect(!updateGate.includes('Updates.checkForUpdateAsync()'), 'manual/automatic UI must not depend on rejected Expo check promises');
expect(updateGate.includes('phase: "current"'), 'manual up-to-date state missing');
expect(updateGate.includes('SUCCESS_SHOWN_KEY'), 'one-time update-success acknowledgement missing');
expect(updateGate.includes('serverOtaId()'), 'OTA server/native acceptance cross-check missing');
expect(!nativeGuard.includes('Alert.alert'), 'native OTA observer must not create duplicate user prompts');

expect(apkInstaller.includes('DownloadManager'), 'native APK updater must use Android DownloadManager');
expect(apkInstaller.includes('setDestinationInExternalFilesDir'), 'native APK download must use durable app-owned external storage');
expect(apkInstaller.includes('getSharedPreferences'), 'native APK download state must survive React process recreation');
expect(apkInstaller.includes('override fun onHostResume()'), 'native APK updater must resume verification/install when app returns');
expect(apkInstaller.includes('restartForOta') && apkInstaller.includes('OnCampusOtaRestartActivity'), 'isolated OTA cold-restart bridge missing');
expect(apkInstaller.includes('VISIBILITY_VISIBLE_NOTIFY_COMPLETED'), 'background APK completion notification missing');
expect(manifest.includes('android:name=".OnCampusOtaRestartActivity"') && manifest.includes('android:process=":ota_restart"'), 'isolated restart activity manifest contract missing');
expect(apkInstaller.includes('APK checksum verification failed'), 'native APK updater must verify SHA-256 before install');
expect(!apkInstaller.includes('HttpURLConnection'), 'native APK updater must not depend on a process-owned HTTP transfer');
expect(apkFilePaths.includes('external-files-path'), 'FileProvider must expose the durable DownloadManager APK location');

expect(!layout.includes('CampusLoader'), 'RootLayout must not block startup with CampusLoader');
expect(!index.includes('CampusLoader'), 'Startup route must not use CampusLoader');
expect(!index.includes('setTimeout('), 'Startup route must not contain artificial delays');
expect(!index.includes('#1267F4') && !index.includes('#0B49BD'), 'startup route must never render the legacy blue screen');
expect(!index.includes('name="school"'), 'startup route must use the real OnCampus icon, not a generic Expo-style school glyph');
expect(index.includes('APP_ICON'), 'startup route must render the OnCampus app icon');
expect(index.includes('router.replace(target)'), 'Startup route must deterministically leave the splash route');

console.log(`OnCampus release/startup contracts verified for ${version} with server-driven OTA discovery, isolated cold-restart activation and verified Android installer handoff`);
