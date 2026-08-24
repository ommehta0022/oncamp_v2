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
const role = read('src/context/RoleProvider.tsx');
const accessibility = read('src/context/AccessibilityProvider.tsx');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const strings = read('android/app/src/main/res/values/strings.xml');
const gradle = read('android/app/build.gradle');

expect(app.version === '1.6.2', `app version must be 1.6.2, found ${app.version}`);
expect(app.runtimeVersion === '1.6.2', `runtimeVersion must be 1.6.2, found ${app.runtimeVersion}`);
expect(app.android?.versionCode === 10602, `versionCode must be 10602, found ${app.android?.versionCode}`);
expect(app.android?.package === 'com.oncampus.app', 'Android package changed unexpectedly');
expect(app.updates?.checkAutomatically === 'NEVER', 'Expo Updates must not check during cold startup');
expect(app.extra?.otaRuntimeVersion === '1.6.2', 'extra.otaRuntimeVersion must match runtime');
expect(manifest.includes('EXPO_UPDATES_CHECK_ON_LAUNCH" android:value="NEVER"'), 'native manifest must disable automatic Expo update checks');
expect(strings.includes('name="expo_runtime_version" translatable="false">1.6.2</string>'), 'native runtime string must be 1.6.2');
expect(gradle.includes('?: "1.6.2"'), 'Gradle versionName default must be 1.6.2');
expect(gradle.includes('?: "10602"'), 'Gradle versionCode default must be 10602');

const expectedDeps = {
  expo: '54.0.37',
  'expo-asset': '12.0.13',
  'expo-constants': '18.0.14',
  'expo-audio': '1.1.1',
};
for (const [name, version] of Object.entries(expectedDeps)) {
  expect(pkg.dependencies?.[name] === version, `${name} must be pinned to ${version}`);
}

expect(layout.includes('import { AccessibilityProvider }'), 'RootLayout must import AccessibilityProvider');
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

for (const feature of ['app-update-gate', 'server-update-coordinator', 'session-expired-modal']) {
  expect(layout.includes(`<OptionalFeatureBoundary name="${feature}">`), `${feature} must be isolated from the app shell`);
}

expect(!layout.includes('CampusLoader'), 'RootLayout must not block startup with CampusLoader');
expect(!index.includes('CampusLoader'), 'Startup route must not use CampusLoader');
expect(!index.includes('setTimeout('), 'Startup route must not contain artificial delays');
expect(index.includes('router.replace(target)'), 'Startup route must deterministically leave the splash route');

console.log('OnCampus release/startup contracts verified for 1.6.2');
