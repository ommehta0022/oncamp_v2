import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const file = path.join(root, 'src/components/AppUpdateGate.tsx');
let source = fs.readFileSync(file, 'utf8');
const before = 'width: String(Math.max(2, Math.min(100, state.progress || 2))) + "%",';
const after = 'width: (String(Math.max(2, Math.min(100, state.progress || 2))) + "%") as `${number}%`,';
const count = source.split(before).length - 1;
if (count !== 1) throw new Error(`progress width: expected one match, found ${count}`);
source = source.replace(before, after);
fs.writeFileSync(file, source);
console.log('OTA progress width is now typed as a React Native percentage dimension.');
