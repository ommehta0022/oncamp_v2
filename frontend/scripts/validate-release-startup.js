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
const manifest = read('android/app/src/main/AndroidManifest.xml');
const strings = read('android/app/src/main/res/values/strings.xml');
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
expect(app.updates?.enabled === true, 'Expo Updates must remain enabled');
expect(app.updates?.checkAutomatically === 'ON_LOAD', 'Expo Updates must check natively on every cold launch');
expect(app.updates?.fallbackToCacheTimeout === 0, 'Startup OTA check must never block launching cached/embedded code');
expect(app.extra?.otaRuntimeVersion === runtime, 'extra.otaRuntimeVersion must match runtime');
expect(app.extra?.nativeStartupOta === true, 'nativeStartupOta feature flag must remain enabled');
expect(manifest.includes('EXPO_UPDATES_CHECK_ON_LAUNCH" android:value="ALWAYS"'), 'native manifest must enable automatic Expo update checks');
expect(manifest.includes('expo.modules.updates.ENABLED" android:value="true"'), 'native Expo Updates module must remain enabled');
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

const darkPalette = palette.split('export const darkColors = {')[1]?.split('};')[0] || '';
expect(darkPalette.includes('surface: "#0A0A0A"'), 'dark mode surface must remain professional near-black');
expect(darkPalette.includes('background: "#0A0A0A"'), 'dark mode background must remain professional near-black');
expect(darkPalette.includes('card: "#121214"'), 'dark mode cards must remain charcoal');
expect(darkPalette.includes('brandPrimary: "#E7E7EA"'), 'dark mode primary brand action must remain neutral silver');
expect(darkPalette.includes('bubbleOwn: "#2A2A2E"'), 'dark mode own chat bubble must remain charcoal');
expect(darkPalette.includes('gradientStart: "#2A2A2F"') && darkPalette.includes('gradientEnd: "#111113"'), 'dark mode gradients must remain neutral charcoal');

const expectedDeps = {
  expo: '54.0.37',
  'expo-asset': '12.0.13',
  'expo-constants': '18.0.14',
  'expo-audio': '1.1.1',
  'expo-updates': '29.0.20',
};
for (const [name, pinned] of Object.entries(expectedDeps)) {
  expect(pkg.dependencies?.[name] === pinned, `${name} must be pinned to ${pinned}`);
}

expect(layout.includes('import { AccessibilityProvider }'), 'RootLayout must import AccessibilityProvider');
expect(layout.includes('NativeOtaStartupGuard'), 'RootLayout must mount the native OTA startup guard');
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

for (const feature of ['native-ota-startup-guard', 'app-update-gate', 'server-update-coordinator', 'session-expired-modal']) {
  expect(layout.includes(`<OptionalFeatureBoundary name="${feature}">`), `${feature} must be isolated from the app shell`);
}

expect(!layout.includes('CampusLoader'), 'RootLayout must not block startup with CampusLoader');
expect(!index.includes('CampusLoader'), 'Startup route must not use CampusLoader');
expect(!index.includes('setTimeout('), 'Startup route must not contain artificial delays');
expect(index.includes('router.replace(target)'), 'Startup route must deterministically leave the splash route');

console.log(`OnCampus release/startup contracts verified for ${version} with native ON_LOAD OTA`);
