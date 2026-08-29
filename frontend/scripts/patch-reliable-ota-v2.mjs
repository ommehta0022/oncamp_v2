import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const gatePath = path.join(root, 'src/components/AppUpdateGate.tsx');
let source = fs.readFileSync(gatePath, 'utf8');

const before = '    if (state.phase === "installing") return "ANDROID INSTALLER";';
const after = '    if (state.phase === "installing") return state.kind === "ota" ? "APPLYING UPDATE" : "ANDROID INSTALLER";';
const count = source.split(before).length - 1;
if (count !== 1) throw new Error(`installing label: expected one match, found ${count}`);
source = source.replace(before, after);

if (!source.includes('Restart to apply')) throw new Error('explicit OTA restart control missing');
if (source.includes('resumePendingOtaApply()')) throw new Error('automatic OTA restart regression returned');
if (!source.includes('downloadProgress')) throw new Error('real OTA progress contract missing');

fs.writeFileSync(gatePath, source);
console.log('OTA apply state label finalized.');
