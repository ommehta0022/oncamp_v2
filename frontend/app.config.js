const fs = require("fs");
const path = require("path");

const appJson = require("./app.json");

// Support both locations: important/all_set (real) and all_info_for_api_referance_only/all_set (legacy)
const allSetDirCandidates = [
  path.resolve(__dirname, "../important/all_set"),
  path.resolve(__dirname, "../all_info_for_api_referance_only/all_set"),
];
const allSetDir = allSetDirCandidates.find(fs.existsSync) || allSetDirCandidates[0];

function readText(name) {
  const file = path.join(allSetDir, name);
  if (!fs.existsSync(file)) return "";
  return fs.readFileSync(file, "utf8");
}

function valueFor(key, text) {
  const match = text.match(new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`));
  return match ? match[1] : "";
}

function labeledValue(section, key) {
  const text = readText("more.txt");
  const lines = text.split(/\r?\n/);
  let current = "";
  let pending = "";
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const separator = line.includes("=") ? "=" : line.includes(":") ? ":" : "";
    if (!separator) {
      if (pending === `${section}.${key}`) return line;
      continue;
    }
    const [left, ...rest] = line.split(separator);
    const name = left.trim().replace(/^"|"$/g, "");
    const value = rest.join(separator).trim();
    if (["supabase", "firebase", "railway", "render"].includes(name.toLowerCase()) && !value) {
      current = name.toLowerCase();
      pending = "";
      continue;
    }
    const fullName = current ? `${current}.${name}` : name;
    if (fullName === `${section}.${key}`) {
      if (value) return value.replace(/^"|"$/g, "");
      pending = fullName;
    } else {
      pending = "";
    }
  }
  return "";
}

function androidFirebaseConfig() {
  try {
    const parsed = JSON.parse(readText("google-services.json"));
    const project = parsed.project_info || {};
    const client = parsed.client?.[0] || {};
    return {
      apiKey: client.api_key?.[0]?.current_key || "",
      projectId: project.project_id || "",
      storageBucket: project.storage_bucket || "",
      messagingSenderId: project.project_number || "",
      appId: client.client_info?.mobilesdk_app_id || "",
    };
  } catch {
    return {};
  }
}

function firebaseWebConfig() {
  const text = readText("web app");
  const android = androidFirebaseConfig();
  const projectId =
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
    valueFor("projectId", text) ||
    labeledValue("firebase", "project_id") ||
    android.projectId ||
    "";
  return {
    apiKey:
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
      valueFor("apiKey", text) ||
      labeledValue("firebase", "key") ||
      android.apiKey ||
      "",
    authDomain:
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
      valueFor("authDomain", text) ||
      (projectId ? `${projectId}.firebaseapp.com` : ""),
    projectId,
    storageBucket:
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      valueFor("storageBucket", text) ||
      android.storageBucket ||
      (projectId ? `${projectId}.firebasestorage.app` : ""),
    messagingSenderId:
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
      valueFor("messagingSenderId", text) ||
      android.messagingSenderId ||
      "",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || valueFor("appId", text) || android.appId || "",
  };
}

module.exports = () => {
  const config = appJson.expo;
  const googleServicesFile = path.resolve(__dirname, "../important/all_set/google-services.json");
  const googleServiceInfoFile = path.resolve(__dirname, "../important/all_set/GoogleService-Info.plist");

  const androidConfig = { ...config.android };
  if (fs.existsSync(googleServicesFile)) {
    androidConfig.googleServicesFile = googleServicesFile;
  }

  const iosConfig = { ...config.ios };
  if (fs.existsSync(googleServiceInfoFile)) {
    iosConfig.googleServicesFile = googleServiceInfoFile;
  }

  return {
    ...config,
    android: androidConfig,
    ios: iosConfig,
    plugins: [
      ...config.plugins,
      // NOTE: @react-native-firebase plugins only needed for EAS native builds
      // Expo Go uses web Firebase SDK (firebasePhoneAuth.native.ts → web SDK)
    ],
    extra: {
      ...config.extra,
      firebase: firebaseWebConfig(),
      apiBaseUrl: process.env.EXPO_PUBLIC_API_URL || "https://perpetual-motivation-production-be1a.up.railway.app/v1",
    },
  };
};
