import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const distDir = path.resolve(root, process.argv[2] || "ota-dist");
const outDir = path.resolve(root, process.argv[3] || "ota-release");
const appConfig = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8"));
const expo = appConfig.expo || {};
const runtimeVersion = String(expo.runtimeVersion || expo.version || "").trim();

if (!runtimeVersion) throw new Error("runtimeVersion is required in app.json");

const metadataPath = path.join(distDir, "metadata.json");
if (!fs.existsSync(metadataPath)) throw new Error(`Missing Expo export metadata: ${metadataPath}`);
const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
const android = metadata?.fileMetadata?.android;
if (!android?.bundle) throw new Error("Expo export metadata does not contain an Android launch bundle");

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const releaseBase = `https://github.com/ommehta0022/oncamp_v2/releases/download/ota-runtime-${runtimeVersion}`;

const sha256Buffer = (buffer) => crypto.createHash("sha256").update(buffer).digest();
const sha256Hex = (buffer) => sha256Buffer(buffer).toString("hex");
const md5Hex = (buffer) => crypto.createHash("md5").update(buffer).digest("hex");
const base64Url = (buffer) => buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

function uuidFromHex(hex) {
  const value = hex.slice(0, 32);
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`;
}

function contentTypeForExtension(ext, isLaunch = false) {
  if (isLaunch) return "application/javascript";
  const normalized = String(ext || "").replace(/^\./, "").toLowerCase();
  const known = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    json: "application/json",
    txt: "text/plain",
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    bundle: "application/javascript",
    ttf: "font/ttf",
    otf: "font/otf",
    woff: "font/woff",
    woff2: "font/woff2",
    mp4: "video/mp4",
    m4v: "video/x-m4v",
    mov: "video/quicktime",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    pdf: "application/pdf",
  };
  return known[normalized] || "application/octet-stream";
}

function packFile(relativePath, ext, isLaunch = false) {
  const source = path.resolve(distDir, relativePath);
  if (!source.startsWith(distDir + path.sep)) throw new Error(`Unsafe exported asset path: ${relativePath}`);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) throw new Error(`Missing exported asset: ${relativePath}`);

  const buffer = fs.readFileSync(source);
  const hashHex = sha256Hex(buffer);
  const normalizedExt = isLaunch ? "bundle" : String(ext || path.extname(relativePath).slice(1) || "bin").replace(/^\./, "").toLowerCase();
  const fileName = `${isLaunch ? "launch" : "asset"}-${hashHex}.${normalizedExt}`;
  const destination = path.join(outDir, fileName);
  if (!fs.existsSync(destination)) fs.writeFileSync(destination, buffer);

  return {
    hash: base64Url(sha256Buffer(buffer)),
    key: md5Hex(buffer),
    fileExtension: `.${normalizedExt}`,
    contentType: contentTypeForExtension(normalizedExt, isLaunch),
    url: `${releaseBase}/${fileName}`,
  };
}

const launchAsset = packFile(android.bundle, null, true);
const assets = [];
const seen = new Set();
for (const asset of Array.isArray(android.assets) ? android.assets : []) {
  if (!asset?.path) continue;
  const packed = packFile(asset.path, asset.ext, false);
  if (seen.has(packed.url)) continue;
  seen.add(packed.url);
  assets.push(packed);
}

const publicConfigPath = path.join(distDir, "expoConfig.json");
let publicExpoConfig = expo;
if (fs.existsSync(publicConfigPath)) {
  try {
    const parsed = JSON.parse(fs.readFileSync(publicConfigPath, "utf8"));
    publicExpoConfig = parsed?.expo || parsed;
  } catch {
    publicExpoConfig = expo;
  }
}

const fingerprint = Buffer.from(JSON.stringify({ runtimeVersion, launchAsset, assets }), "utf8");
const id = uuidFromHex(sha256Hex(fingerprint));
const source = {
  id,
  createdAt: new Date().toISOString(),
  runtimeVersion,
  platform: "android",
  launchAsset,
  assets,
  metadata: {
    channel: "production",
    source: "github-actions",
  },
  extra: {
    expoClient: publicExpoConfig,
  },
};

fs.writeFileSync(path.join(outDir, "ota-source.json"), `${JSON.stringify(source, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, "ota-source.sha256"), `${sha256Hex(Buffer.from(JSON.stringify(source), "utf8"))}  ota-source.json\n`);

console.log(`Prepared OTA ${id} for runtime ${runtimeVersion}`);
console.log(`Launch asset + ${assets.length} assets written to ${outDir}`);
