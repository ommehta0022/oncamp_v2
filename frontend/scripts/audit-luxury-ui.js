const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const violations = [];
const expect = (condition, message) => { if (!condition) violations.push(message); };

function walk(dir) {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(relative);
    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) return [];
    return [relative];
  });
}

const palette = read('src/theme/colors.ts');
const theme = read('src/theme/ThemeProvider.tsx');
const groups = read('app/(tabs)/groups.tsx');
const feed = read('app/(tabs)/feed.tsx');
const tabs = read('app/(tabs)/_layout.tsx');
const login = read('app/(auth)/login.tsx');
const welcome = read('app/(auth)/welcome.tsx');
const settings = read('app/settings/index.tsx');
const button = read('src/components/Button.tsx');
const header = read('src/components/Header.tsx');
const settingsRow = read('src/components/SettingsRow.tsx');

for (const token of [
  'surface: "#F7F8FA"',
  'onSurface: "#111318"',
  'surfaceSecondary: "#FFFFFF"',
  'surfaceTertiary: "#F1F3F5"',
  'brandPrimary: "#2A574B"',
  'actionPrimary: "#2A574B"',
  'actionSecondary: "#40464F"',
  'brandSecondary: "#7A5D50"',
  'success: "#2F7A56"',
  'warning: "#B7791F"',
  'error: "#C94343"',
  'info: "#59636F"',
  'inputBg: "#FFFFFF"',
  'surface: "#0A0B0B"',
  'surfaceSecondary: "#121414"',
  'brandPrimary: "#6F9E90"',
  'actionSecondary: "#C1C6CB"'
]) expect(palette.includes(token), `professional palette token missing: ${token}`);

expect(theme.includes('type ThemeMode = "light" | "dark" | "system"'), 'Light, Dark and System theme support must remain');
expect(theme.includes('useAccessibilityPreferences()'), 'theme accessibility integration must remain');
expect(theme.includes('.catch(() =>') && theme.includes('.finally(() =>'), 'theme hydration must remain fail-safe');

const sourceFiles = [...walk('app'), ...walk('src')];
const rejectedBlue = ['#1267F4', '#0B4BC2', '#7B3FF2', '#0D4FC4', '#EAF2FF', '#0B1947'];
for (const file of sourceFiles) {
  const source = read(file);
  for (const token of rejectedBlue) {
    if (source.toUpperCase().includes(token.toUpperCase())) violations.push(`${file} still contains rejected blue-system token ${token}`);
  }
}

expect(!tabs.includes('activeIcon'), 'bottom navigation must not use filled active-icon circles');
expect(tabs.includes('tabBarActiveTintColor: colors.brandPrimary'), 'bottom navigation must use restrained active tint');
expect(tabs.includes('backgroundColor: colors.brandSecondary'), 'tab unread badges must use the dedicated engagement accent');
expect(tabs.includes('elevation: 0') && tabs.includes('shadowOpacity: 0'), 'bottom navigation must stay flat and visually quiet');
expect(tabs.includes('fontWeight: "500"'), 'bottom navigation labels must use restrained weight');

expect(button.includes('primary: colors.actionPrimary'), 'primary buttons must use semantic primary action token');
expect(button.includes('secondary: colors.actionSecondary'), 'secondary buttons must use a neutral semantic secondary token');
expect(button.includes('danger: colors.actionDanger'), 'danger buttons must use semantic danger token');
expect(button.includes('borderRadius: variant === "link" ? radius.sm : radius.pill'), 'buttons must use the proven soft control language');
expect(button.includes('fontWeight: variant === "link" ? "600" : "500"'), 'button typography must stay restrained');
expect(!button.includes('textDecorationLine: variant === "link" ? "underline"'), 'link buttons must not force decorative underlines');

expect(header.includes('fontWeight: "500"'), 'shared header typography must stay restrained');
expect(!header.includes('backgroundColor: colors.surfaceTertiary'), 'shared back buttons must not use decorative filled circles');

expect(settingsRow.includes('colors.surfaceTertiary'), 'settings icons must default to neutral chrome');
expect(!settingsRow.includes('iconBg || colors.brandTertiary'), 'settings must not tint every row with the brand theme');

expect(!groups.includes('{groups.length} joined'), 'Groups must not show joined/unread headline totals');
expect(!groups.includes('item.count'), 'Groups section headers must not show decorative total counts');
expect(!groups.includes('leftBar'), 'Groups rows must not use colored unread side bars');
expect(groups.includes('borderBottomColor: colors.divider'), 'Groups must use clean list separators');
expect(groups.includes('backgroundColor: colors.brandSecondary'), 'Groups unread badges must use the dedicated engagement accent');

expect(feed.includes('backgroundColor: colors.surface') && !feed.includes('fontWeight: "900"'), 'Feed must use restrained professional chrome');
expect(login.includes('backgroundColor: colors.surfaceTertiary') && login.includes('color={colors.brandPrimary}'), 'Login must keep neutral chrome with restrained brand emphasis');
expect(!welcome.includes('formatOnboardingTitle') && !welcome.includes('formatOnboardingSubtitle'), 'Welcome copy must flow naturally without forced editorial line breaks');
expect(settings.includes('checkForAppUpdate("manual")'), 'Settings manual update action must remain wired to repaired updater');
expect(settings.includes('ONCAMPUS v') && settings.includes('radius.lg'), 'Settings must keep the professional grouped-card and version-footer treatment');

if (violations.length) {
  console.error('Professional UI audit failed:');
  for (const violation of violations) console.error(` - ${violation}`);
  process.exit(1);
}
console.log(`Professional previous-UI contract verified across ${sourceFiles.length} app/source files.`);