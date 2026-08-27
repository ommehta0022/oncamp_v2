const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const violations = [];
const expect = (condition, message) => { if (!condition) violations.push(message); };

const palette = read('src/theme/colors.ts');
const theme = read('src/theme/ThemeProvider.tsx');
const groups = read('app/(tabs)/groups.tsx');
const feed = read('app/(tabs)/feed.tsx');
const discover = read('app/(tabs)/discover.tsx');
const notifications = read('app/(tabs)/notifications.tsx');
const profile = read('app/(tabs)/profile.tsx');
const tabs = read('app/(tabs)/_layout.tsx');
const login = read('app/(auth)/login.tsx');
const welcome = read('app/(auth)/welcome.tsx');
const settings = read('app/settings/index.tsx');
const button = read('src/components/Button.tsx');
const chip = read('src/components/Chip.tsx');
const badge = read('src/components/Badge.tsx');
const header = read('src/components/Header.tsx');
const postCard = read('src/components/PostCard.tsx');

// Lock the last clean pre-luxury visual foundation (1.6.3 / 3e4b411).
for (const token of [
  'surface: "#F8FAFD"',
  'onSurface: "#0B1947"',
  'surfaceSecondary: "#FFFFFF"',
  'brandPrimary: "#1267F4"',
  'brandSecondary: "#7B3FF2"',
  'success: "#2DA65A"',
  'warning: "#F28C28"',
  'error: "#E6465B"',
  'surface: "#0A0A0A"',
  'surfaceSecondary: "#121214"',
  'brandPrimary: "#E7E7EA"',
  'brandSecondary: "#A5A5AD"'
]) expect(palette.includes(token), `clean 1.6.3 palette token missing: ${token}`);

expect(theme.includes('type ThemeMode = "light" | "dark" | "system"'), 'clean theme must support Light, Dark and System');
expect(theme.includes('useAccessibilityPreferences()'), 'theme accessibility integration must remain');
expect(theme.includes('.catch(() =>') && theme.includes('.finally(() =>'), 'theme hydration must remain fail-safe');

// Prevent the rejected redesign families from being reintroduced.
const visible = [groups, feed, discover, notifications, profile, tabs, login, welcome, settings, button, chip, badge, header, postCard].join('\n');
for (const pattern of [
  /refined around you/i,
  /a refined space/i,
  /luxuryGold/i,
  /luxuryTeal/i,
  /brandPrimary:\s*"#2E5C4E"/i,
  /brandSecondary:\s*"#E87A5D"/i
]) expect(!pattern.test(visible), `rejected luxury/semantic redesign marker returned: ${pattern}`);

// Preserve the old clean information architecture and the repaired manual update entry point.
expect(settings.includes('checkForAppUpdate("manual")'), 'Settings manual update action must remain wired to repaired updater');
expect(settings.includes('settings.preferences') && settings.includes('settings.privacySafety') && settings.includes('settings.support'), 'clean grouped Settings layout missing');
expect(groups.includes('export default function') && feed.includes('export default function') && discover.includes('export default function'), 'main clean tab screens missing');
expect(notifications.includes('export default function') && profile.includes('export default function'), 'notification/profile clean screens missing');

if (violations.length) {
  console.error('Clean UI baseline audit failed:');
  for (const violation of violations) console.error(` - ${violation}`);
  process.exit(1);
}
console.log('Clean pre-luxury 1.6.3 UI contract verified while preserving the repaired updater entry point.');
