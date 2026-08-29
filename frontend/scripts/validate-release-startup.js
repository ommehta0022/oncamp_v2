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
expect(app.updates?.enabled === false, 'final APK must keep Expo remote updates disabled');
expect(app.updates?.checkAutomatically === 'NEVER', 'Expo update checks must stay disabled');
expect(app.updates?.fallbackToCacheTimeout === 0, 'startup must never wait for an Expo remote update');
expect(app.extra?.updateEngine === 'native-apk-v2', 'Update Engine v2 metadata missing');
expect(app.extra?.nativeStartupOta === false, 'legacy native Expo startup OTA must stay disabled');
expect(app.extra?.serverTriggeredUpdates === true, 'server-triggered native update checks missing');
expect(manifest.includes('expo.modules.updates.ENABLED" android:value="false"'), 'native Expo Updates module must stay disabled');
expect(manifest.includes('EXPO_UPDATES_CHECK_ON_LAUNCH" android:value="NEVER"'), 'native Expo launch check must stay disabled');
expect(!manifest.includes('EXPO_UPDATES_URL'), 'legacy Expo update URL must not ship in final binary');
expect(!manifest.includes('CODE_SIGNING_CERTIFICATE'), 'legacy Expo code-signing metadata must not ship in final binary');
expect(manifest.includes('android.permission.REQUEST_INSTALL_PACKAGES'), 'APK installer permission missing');
expect(manifest.includes('android:icon="@mipmap/ic_launcher"'), 'adaptive launcher icon missing');
expect(manifest.includes('android:roundIcon="@mipmap/ic_launcher_round"'), 'round adaptive launcher icon missing');
expect(launcher.includes('@drawable/oncampus_app_icon') && launcherRound.includes('@drawable/oncampus_app_icon'), 'launcher must use OnCampus artwork');
expect(strings.includes(`name="expo_runtime_version" translatable="false">${runtime}</string>`), 'native runtime string mismatch');
expect(!strings.includes('BEGIN CERTIFICATE'), 'unused legacy Expo OTA certificate should not be embedded as a string resource');
expect(gradle.includes(`?: "${version}"`) && gradle.includes(`?: "${expectedCode}"`), 'Gradle version defaults mismatch');
expect(nativeColors.includes('<color name="splashscreen_background">#FAF9F6</color>'), 'neutral light startup splash missing');
expect(nativeNightColors.includes('<color name="splashscreen_background">#080809</color>'), 'neutral dark startup splash missing');
expect(!index.includes('CampusLoader') && !index.includes('setTimeout('), 'startup route must be immediate');
expect(index.includes('APP_ICON') && index.includes('router.replace(target)'), 'startup must render OnCampus icon and route deterministically');

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
expect(settings.includes('checkForAppUpdate("manual")'), 'manual Settings update action must remain wired');

// Final runtime has one update engine. Expo OTA coordinators must not mount.
expect(!layout.includes('BackgroundOtaCoordinator'), 'legacy Expo background OTA coordinator must not mount');
expect(!layout.includes('NativeOtaStartupGuard'), 'legacy Expo startup guard must not mount');
expect(layout.includes('<AppUpdateGate />'), 'Update Engine v2 UI gate missing');
expect(layout.includes('<ServerUpdateCoordinator />'), 'server update coordinator missing');
expect(!updateGate.includes('expo-updates'), 'Update Engine v2 UI must not import expo-updates');
expect(!updateGate.includes('prefetchLatestOta'), 'Update Engine v2 must not call legacy Expo fetch code');
expect(!updateGate.includes('serverOtaId'), 'Update Engine v2 must not use legacy OTA status discovery');
expect(updateGate.includes('/updates/v2/latest'), 'v2 release discovery endpoint missing');
expect(updateGate.includes('/updates/v2/telemetry'), 'v2 update telemetry endpoint missing');
expect(updateGate.includes('NativeEventEmitter'), 'native updater progress bridge missing');
expect(updateGate.includes('nativeInstaller.getStatus()'), 'process-recovery status hydration missing');
expect(updateGate.includes('nativeInstaller.startInstall('), 'native APK update start missing');
expect(updateGate.includes('versionCode') && updateGate.includes('sha256'), 'v2 release integrity metadata missing');
expect(updateGate.includes('["Check", "Download", "Verify", "Install"]'), 'native update stage stepper missing');
expect(updateGate.includes('DEFER_MS = 6 * 60 * 60 * 1000'), 'Later quiet period missing');

// Automatic update discovery must remain active without expo-updates.
expect(!serverCoordinator.includes('expo-updates'), 'server polling must not import expo-updates');
expect(!serverCoordinator.includes('Updates.isEnabled'), 'native update polling must not depend on Expo Updates being enabled');
expect(serverCoordinator.includes('DEFAULT_POLL_SECONDS = 30'), 'automatic update polling interval missing');
expect(serverCoordinator.includes('checkForAppUpdate("campaign", true, true)'), 'campaign must trigger Update Engine v2 discovery');
expect(serverCoordinator.includes('checkServerCampaign(true)'), 'startup/resume campaign check missing');
expect(serverCoordinator.includes('UPDATE_ENGINE_ID = "native-apk-v2"'), 'native update installation identity missing');

// Native transfer: OS-owned, resumable and persistent.
expect(apkInstaller.includes('DownloadManager'), 'native updater must use Android DownloadManager');
expect(apkInstaller.includes('COLUMN_BYTES_DOWNLOADED_SO_FAR') && apkInstaller.includes('downloadedBytes'), 'native updater must expose real byte progress');
expect(apkInstaller.includes('setDestinationInExternalFilesDir'), 'APK must download to durable app-owned external storage');
expect(apkInstaller.includes('VISIBILITY_VISIBLE_NOTIFY_COMPLETED'), 'background APK completion notification missing');
expect(apkInstaller.includes('getSharedPreferences'), 'download state must survive process recreation');
expect(apkInstaller.includes('fun getStatus('), 'native updater recovery API missing');
expect(apkInstaller.includes('/v1/updates/v2/apk/'), 'native updater must pin the first-party v2 APK endpoint');
expect(!apkInstaller.includes('/v1/updates/native/apk'), 'legacy redirecting APK endpoint must not be trusted by final updater');
expect(!apkInstaller.includes('github.com'), 'device updater must never trust a direct GitHub URL');
expect(apkInstaller.includes('APK checksum verification failed'), 'APK SHA-256 verification missing');

// Native APK trust: package, upgrade versionCode and same signing certificate.
expect(apkInstaller.includes('getPackageArchiveInfo'), 'downloaded APK package inspection missing');
expect(apkInstaller.includes('archive.packageName != reactContext.packageName'), 'APK package identity verification missing');
expect(apkInstaller.includes('archiveVersionCode != expectedVersionCode'), 'exact target versionCode verification missing');
expect(apkInstaller.includes('archiveVersionCode <= installedVersionCode()'), 'downgrade/same-version rejection missing');
expect(apkInstaller.includes('PackageManager.GET_SIGNING_CERTIFICATES'), 'modern Android signing certificate inspection missing');
expect(apkInstaller.includes('apkContentsSigners') && apkInstaller.includes('signingCertificateHistory'), 'Android signer extraction missing');
expect(apkInstaller.includes('installedCertificate != archiveCertificate'), 'same-signing-certificate pinning missing');
expect(apkInstaller.includes('KEY_INSTALLER_LAUNCHED_AT'), 'installer cancellation/re-entry recovery missing');
expect(apkInstaller.includes('reconcileInstalledTarget()'), 'post-install reconciliation missing');
expect(!apkInstaller.includes('HttpURLConnection'), 'APK download must remain OS-owned, not process-owned HTTP');
expect(apkFilePaths.includes('external-files-path'), 'FileProvider durable APK location missing');

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
for (const feature of ['app-update-gate', 'server-update-coordinator', 'session-expired-modal']) {
  expect(layout.includes(`<OptionalFeatureBoundary name="${feature}">`), `${feature} must remain isolated in RootLayout`);
}

console.log(`OnCampus ${version} verified: native Update Engine v2, Expo remote OTA disabled, persistent Android download and package/signature pinning enabled.`);
