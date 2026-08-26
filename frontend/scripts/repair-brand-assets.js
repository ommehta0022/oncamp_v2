const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'assets/images/icon.png');
const targets = [
  'assets/images/icon.png',
  'assets/images/adaptive-icon.png',
  'assets/images/splash-image.png',
  'assets/images/favicon.png',
  'assets/images/app-image.png',
  'android/app/src/main/res/drawable/oncampus_app_icon.png',
];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function repairPng(input) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (input.length < 20 || !input.subarray(0, 8).equals(signature)) throw new Error('OnCampus brand source is not a PNG');
  const output = Buffer.from(input);
  let offset = 8;
  let sawIend = false;
  while (offset + 12 <= output.length) {
    const length = output.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataEnd = offset + 8 + length;
    const crcOffset = dataEnd;
    if (crcOffset + 4 > output.length) throw new Error('OnCampus brand PNG has a truncated chunk');
    const type = output.subarray(typeStart, typeStart + 4).toString('ascii');
    output.writeUInt32BE(crc32(output.subarray(typeStart, dataEnd)), crcOffset);
    offset = crcOffset + 4;
    if (type === 'IEND') {
      sawIend = true;
      break;
    }
  }
  if (!sawIend) throw new Error('OnCampus brand PNG is missing IEND');
  return output;
}

const repaired = repairPng(fs.readFileSync(sourcePath));
for (const relative of targets) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, repaired);
}

const embeddedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><image width="192" height="192" href="data:image/png;base64,${repaired.toString('base64')}"/></svg>\n`;
fs.writeFileSync(path.join(root, 'assets/images/icon-embedded.svg'), embeddedSvg, 'utf8');

console.log(`OnCampus brand assets repaired and synchronized (${crypto.createHash('sha256').update(repaired).digest('hex')})`);
