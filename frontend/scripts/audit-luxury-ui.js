const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const roots = [
  path.join(root, 'app'),
  path.join(root, 'src'),
  path.join(root, 'android', 'app', 'src', 'main', 'res'),
];
const singles = [path.join(root, 'app.json')];
const textExt = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.xml', '.gradle', '.properties', '.kt', '.java']);
const ignoredDirs = new Set(['node_modules', '.expo', 'dist', 'build', '.git']);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(target, out);
    else if (textExt.has(path.extname(entry.name))) out.push(target);
  }
  return out;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      default: h = ((r - g) / d + 4); break;
    }
    h *= 60;
  }
  return { h, s, l };
}

function isBlueish(r, g, b) {
  const { h, s, l } = rgbToHsl(r, g, b);
  return h >= 185 && h <= 250 && s >= 0.32 && l >= 0.08 && l <= 0.92;
}

function lineNumber(text, index) {
  return text.slice(0, index).split('\n').length;
}

const files = [...roots.flatMap((dir) => walk(dir)), ...singles.filter(fs.existsSync)];
const violations = [];
const bannedCopy = [
  /refined around you/ig,
  /a refined space/ig,
];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file).replace(/\\/g, '/');

  const hex = /#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?/g;
  for (const match of text.matchAll(hex)) {
    const raw = match[0].slice(1, 7);
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    if (isBlueish(r, g, b)) violations.push(`${rel}:${lineNumber(text, match.index)} blue literal ${match[0]}`);
  }

  const rgba = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g;
  for (const match of text.matchAll(rgba)) {
    const [r, g, b] = match.slice(1, 4).map(Number);
    if (r <= 255 && g <= 255 && b <= 255 && isBlueish(r, g, b)) violations.push(`${rel}:${lineNumber(text, match.index)} blue rgb literal ${match[0]}`);
  }

  for (const pattern of bannedCopy) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) violations.push(`${rel}:${lineNumber(text, match.index)} banned UI copy "${match[0]}"`);
  }
}

if (violations.length) {
  console.error('Luxury UI audit failed. Remove blue-themed literals and banned marketing copy:');
  for (const violation of violations) console.error(` - ${violation}`);
  process.exit(1);
}

console.log(`Luxury UI audit passed across ${files.length} source files: neutral/champagne palette only.`);
