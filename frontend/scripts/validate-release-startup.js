const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const expect = (condition, message) => { if (!condition) throw new Error(message); };

const app = JSON.parse(read('app.json')).expo;
const pkg = JSON.parse(read('package.json'));
const layout = read('app/_layout.tsx');
const index = read('app/index.tsx');
const settings = read('app/settings/index.tsx');
const theme = read('src/theme/ThemeProvider.tsx');
const palette = read('src/theme/colors.ts');
const updateGate = read('src/components/AppUpdateGate.tsx');
const serverCoordinator = read('src/components/ServerUpdateCoordinator.tsx');
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

const version = String(app.version || '');
const runtime = String(app.runtimeVersion || '');
const parts = version.split('.').map(Number);
expect(/^\d+\.\d+\.\d+$/.test(version), `app version must be semantic x.y.z, found ${version}`);
expect(runtime === version, `runtimeVersion must match app version: ${runtime} != ${version}`);
expect(parts.length === 3 && parts.every(Number.isInteger), `invalid semantic version ${version}`);
const expectedCode = parts[0] * 10000 + parts[1] * 100 + parts[2];
expect(app.android?.versionCode === expectedCode, `versionCode must be ${expectedCode}`);
expect(app.android?.package === 'com.oncampus.app', 'Android package changed unexpectedly');

expect(app.icon === './assets/images/icon.png', 'Expo app icon must use OnCampus icon');
expect(app.android?.icon === './assets/images/icon.png', 'Android icon must use OnCampus icon');
expect(app.android?.adaptiveIcon?.foregroundImage === './assets/images/adaptive-icon.png', 'adaptive icon foreground missing');
expect(app.updates?.enabled === true, 'Expo Updates must remain enabled');
expect(app.updates?.checkAutomatically === 'NEVER', 'server-driven discovery must own update checks');
expect(app.updates?.fallbackToCacheTimeout === 0, 'OTA startup must not block cached launch');
expect(app.extra?.otaRuntimeVersion === runtime, 'OTA runtime metadata mismatch');
expect(manifest.includes('EXPO_UPDATES_CHECK_ON_LAUNCH" android:value="NEVER"'), 'native Expo startup check must stay disabled');
expect(manifest.includes('expo.modules.updates.ENABLED" android:value="true"'), 'native Expo Updates module must stay enabled');
expect(manifest.includes('android.permission.REQUEST_INSTALL_PACKAGES'), 'APK installer permission missing');
expect(manifest.includes('android:icon="@mipmap/ic_launcher"'), 'adaptive launcher icon missing');
expect(manifest.includes('android:roundIcon="@mipmap/ic_launcher_round"'), 'round adaptive launcher icon missing');
expect(launcher.includes('@drawable/oncampus_app_icon') && launcherRound.includes('@drawable/oncampus_app_icon'), 'launcher must use OnCampus artwork');
expect(strings.includes(`name="expo_runtime_version" translatable="false">${runtime}</string>`), 'native runtime string mismatch');
expect(gradle.includes(`?: "${version}"`) && gradle.includes(`?: "${expectedCode}"`), 'Gradle version defaults mismatch');
expect(nativeColors.includes('<color name="splashscreen_background">#FAF9F6</color>'), 'neutral light startup splash missing');
expect(nativeNightColors.includes('<color name="splashscreen_background">#080809</color>'), 'neutral dark startup splash missing');
expect(!index.includes('CampusLoader') && !index.includes('setTimeout('), 'startup route must be immediate');
expect(!index.includes('name="school"'), 'startup must not use generic school/Expo glyph');
expect(index.includes('APP_ICON') && index.includes('router.replace(target)'), 'startup must render OnCampus icon and route deterministically');

// Professional previous-UI foundation: crisp neutral surfaces with restrained semantic accents.
const light = palette.split('export const lightColors = {')[1]?.split('};')[0] || '';
const dark = palette.split('export const darkColors = {')[1]?.split('};')[0] || '';
for (const token of [
  'surface: "#F7F8FA"', 'onSurface: "#111318"', 'brandPrimary: "#2A574B"',
  'actionPrimary: "#2A574B"', 'actionSecondary: "#40464F"', 'brandSecondary: "#7A5D50"',
  'success: "#2F7A56"', 'warning: "#B7791F"', 'error: "#C94343"', 'info: "#59636F"'
]) expect(light.includes(token), `professional light palette token missing: ${token}`);
for (const token of [
  'surface: "#0A0B0B"', 'surfaceSecondary: "#121414"', 'brandPrimary: "#6F9E90"',
  'actionPrimary: "#6F9E90"', 'actionSecondary: "#C1C6CB"', 'success: "#58A17C"',
  'warning: "#D5A557"', 'error: "#E36B6B"', 'info: "#A8B0B7"'
]) expect(dark.includes(token), `professional dark palette token missing: ${token}`);
for (const rejected of ['#1267F4', '#0B4BC2', '#7B3FF2', '#0D4FC4', '#EAF2FF', '#0B1947']) {
  expect(!palette.toUpperCase().includes(rejected.toUpperCase()), `rejected blue palette token returned: ${rejected}`);
}
expect(theme.includes('type ThemeMode = "light" | "dark" | "system"'), 'Light/Dark/System theme contract missing');
expect(theme.includes('useAccessibilityPreferences()'), 'theme accessibility support missing');
expect(theme.includes('.catch(() =>') && theme.includes('.finally(() =>'), 'theme hydration must remain fail-safe');
expect(settings.includes('checkForAppUpdate("manual")'), 'manual Settings update action must remain wired');

// OTA discovery remains server-authoritative; user controls activation after real download progress.
expect(!updateGate.includes('Updates.checkForUpdateAsync()'), 'update UI must not depend on rejected Expo check promise');
expect(updateGate.includes('serverOtaId()'), 'server/native OTA acceptance cross-check missing');
expect(updateGate.includes('prefetchLatestOta(true)'), 'OTA must use resilient signed download engine');
expect(updateGate.includes('downloadProgress') && updateGate.includes('isDownloading'), 'real Expo OTA download progress must be rendered');
expect(updateGate.includes('phase: "ready"'), 'downloaded OTA ready state missing');
expect(updateGate.includes('Restart to apply'), 'explicit OTA apply action missing');
expect(!updateGate.includes('Updates.reloadAsync()'), 'OTA apply must not depend on rejected in-process Expo reload');
expect(updateGate.includes('nativeInstaller?.restartForOta') && updateGate.includes('await nativeInstaller.restartForOta()'), 'OTA apply must use native cold restart after download');
expect(updateGate.includes('Automatic checks never hide or replace an active update UI'), 'automatic update failures must never dismiss active progress UI');
expect(updateGate.includes('lastOtaProgress') && updateGate.includes('[\"available\", \"downloading\", \"error\"]'), 'OTA retries must preserve and resume real visible progress');
expect(updateGate.includes('Live download progress') && updateGate.includes('Math.round(fraction * 100)'), 'professional live OTA percentage UI missing');
expect(updateGate.includes('[\"Check\", \"Download\", \"Verify\", \"Apply\"]'), 'OTA stage stepper missing');
expect(!updateGate.includes('resumePendingOtaApply()'), 'download completion must never auto-restart the app');
expect(updateGate.includes('DEFER_MS = 6 * 60 * 60 * 1000'), 'Later quiet period missing');
expect(nativeGuard.includes('Updates.addListener') || nativeGuard.includes('useUpdates'), 'native OTA state observer missing');
expect(!nativeGuard.includes('Alert.alert'), 'native observer must not create duplicate prompts');

// Automatic delivery remains fast in foreground and durable in background.
expect(serverCoordinator.includes('DEFAULT_POLL_SECONDS = 30'), 'automatic campaign polling interval missing');
expect(serverCoordinator.includes('checkForAppUpdate("campaign", true, true)'), 'campaign must force repaired update discovery/prompt');
expect(serverCoordinator.includes('checkServerCampaign(true)'), 'startup/resume campaign check missing');
expect(serverCoordinator.includes('schedulePoll(next)'), 'campaign retry scheduling missing');
expect(serverCoordinator.includes('AppState.addEventListener'), 'automatic prompt must retry on foreground');
expect(backgroundCoordinator.includes('setupBackgroundOta()') && backgroundCoordinator.includes('prefetchLatestOta'), 'background OTA coordinator missing');
expect(backgroundCoordinator.includes('AppState.addEventListener'), 'background OTA coordinator must react to resume/minimize');
expect(backgroundOta.includes('TaskManager.defineTask'), 'headless OTA task must be module scoped');
expect(backgroundOta.includes('BackgroundTask.registerTaskAsync'), 'WorkManager OTA registration missing');
expect(backgroundOta.includes('BACKGROUND_MIN_INTERVAL_MINUTES = 15'), 'Android background OTA interval contract changed');
expect(backgroundOta.includes('FETCH_ATTEMPTS = 4'), 'OTA retry count contract missing');
expect(backgroundOta.includes('Updates.fetchUpdateAsync()'), 'OTA download must use signed Expo fetch');
expect(!backgroundOta.includes('Updates.checkForUpdateAsync()'), 'background discovery must not use rejected Expo check promise');
expect(!backgroundOta.includes('Updates.reloadAsync()'), 'background worker must never reload hidden app');

// Android full APK update remains DownloadManager + checksum + system installer handoff.
expect(apkInstaller.includes('DownloadManager'), 'APK updater must use Android DownloadManager');
expect(apkInstaller.includes('COLUMN_BYTES_DOWNLOADED_SO_FAR') && apkInstaller.includes('downloadedBytes'), 'APK updater must expose real byte progress');
expect(apkInstaller.includes('downloaded * 100L') && !apkInstaller.includes('downloaded * 84L'), 'APK download progress must be true transfer percentage');
expect(apkInstaller.includes('setDestinationInExternalFilesDir'), 'APK must download to durable app-owned external storage');
expect(apkInstaller.includes('VISIBILITY_VISIBLE_NOTIFY_COMPLETED'), 'background APK completion notification missing');
expect(apkInstaller.includes('getSharedPreferences'), 'APK download state must survive React process recreation');
expect(apkInstaller.includes('override fun onHostResume()'), 'APK verification/installer must resume when app returns');
expect(apkInstaller.includes('APK checksum verification failed'), 'APK SHA-256 verification missing');
expect(apkInstaller.includes('restartForOta') && apkInstaller.includes('OnCampusOtaRestartActivity'), 'isolated OTA restart fallback missing');
expect(!apkInstaller.includes('HttpURLConnection'), 'APK download must not be process-owned HTTP');
expect(apkFilePaths.includes('external-files-path'), 'FileProvider durable APK location missing');
expect(manifest.includes('android:name=".OnCampusOtaRestartActivity"') && manifest.includes('android:process=":ota_restart"'), 'isolated OTA restart activity missing');

const expectedDeps = {
  expo: '54.0.37',
  'expo-asset': '12.0.13',
  'expo-background-task': '1.0.10',
  'expo-constants': '18.0.14',
  'expo-audio': '1.1.1',
  'expo-task-manager': '14.0.9',
  'expo-updates': '29.0.20',
};
for (const [name, pinned] of Object.entries(expectedDeps)) expect(pkg.dependencies?.[name] === pinned, `${name} must stay pinned to ${pinned}`);
for (const feature of ['background-ota-coordinator','native-ota-startup-guard','app-update-gate','server-update-coordinator','session-expired-modal']) {
  expect(layout.includes(`<OptionalFeatureBoundary name="${feature}">`), `${feature} must remain isolated in RootLayout`);
}

console.log(`OnCampus ${version} verified: professional previous-UI foundation with explicit-progress OTA and Android installer pipeline.`);