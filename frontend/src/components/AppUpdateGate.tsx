import React, { useEffect } from "react";
import { Alert, AppState, Linking, Platform } from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";

const RELEASE_API = "https://api.github.com/repos/ommehta0022/oncamp_v2/releases/latest";
const TRUSTED_DOWNLOAD_PREFIX = "https://github.com/ommehta0022/oncamp_v2/releases/download/";
const APK_NAME = "OnCampus.apk";
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const OTA_CHECK_INTERVAL_MS = 15 * 60 * 1000;

let lastAutomaticCheckAt = 0;
let lastOtaCheckAt = 0;
let activeCheck: Promise<void> | null = null;
let activeOtaCheck: Promise<boolean> | null = null;

type ReleaseAsset = {
  name?: string;
  browser_download_url?: string;
};

type LatestRelease = {
  tag_name?: string;
  name?: string;
  body?: string | null;
  assets?: ReleaseAsset[];
};

function normalizeVersion(value?: string | null) {
  return String(value || "0.0.0").trim().replace(/^v/i, "").split("-")[0];
}

function versionParts(value: string) {
  return normalizeVersion(value)
    .split(".")
    .slice(0, 4)
    .map((part) => {
      const parsed = Number.parseInt(part.replace(/\D/g, ""), 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });
}

function compareVersions(left: string, right: string) {
  const a = versionParts(left);
  const b = versionParts(right);
  const length = Math.max(a.length, b.length, 3);
  for (let i = 0; i < length; i += 1) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

function releaseFlag(body: string, name: string) {
  const match = body.match(new RegExp(`<!--\\s*${name}\\s*:\\s*([^>]+?)\\s*-->`, "i"));
  return match?.[1]?.trim();
}

function cleanReleaseNotes(body: string) {
  return body
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/\r/g, "")
    .trim()
    .slice(0, 500);
}

function isTrustedApkUrl(url?: string) {
  return Boolean(
    url &&
      url.startsWith(TRUSTED_DOWNLOAD_PREFIX) &&
      url.endsWith(`/${APK_NAME}`) &&
      !url.includes("?")
  );
}

async function checkForOtaUpdate(manual = false): Promise<boolean> {
  if (Platform.OS !== "android" || !Updates.isEnabled) return false;

  const now = Date.now();
  if (!manual && now - lastOtaCheckAt < OTA_CHECK_INTERVAL_MS) return false;
  if (activeOtaCheck) return activeOtaCheck;
  if (!manual) lastOtaCheckAt = now;

  activeOtaCheck = (async () => {
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) return false;

      await Updates.fetchUpdateAsync();
      Alert.alert(
        "OnCampus update ready",
        "A new secure app update has been downloaded. Restart OnCampus to apply it now.",
        [
          { text: "Later", style: "cancel" },
          {
            text: "Restart now",
            onPress: () => {
              void Updates.reloadAsync();
            },
          },
        ]
      );
      return true;
    } catch {
      // The embedded build remains usable if the OTA service is unavailable.
      return false;
    }
  })();

  try {
    return await activeOtaCheck;
  } finally {
    activeOtaCheck = null;
  }
}

export async function checkForAppUpdate(manual = false) {
  if (Platform.OS !== "android") {
    if (manual) Alert.alert("Updates", "App update checks are currently available on Android.");
    return;
  }

  const otaReady = await checkForOtaUpdate(manual);
  if (otaReady) return;

  const now = Date.now();
  if (!manual && now - lastAutomaticCheckAt < CHECK_INTERVAL_MS) return;
  if (activeCheck) return activeCheck;

  if (!manual) lastAutomaticCheckAt = now;

  activeCheck = (async () => {
    try {
      const response = await fetch(RELEASE_API, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      if (!response.ok) {
        if (manual) Alert.alert("Updates", "Could not check for updates right now. Please try again later.");
        return;
      }

      const release = (await response.json()) as LatestRelease;
      const currentVersion = normalizeVersion(Constants.expoConfig?.version);
      const latestVersion = normalizeVersion(release.tag_name || release.name);

      if (!latestVersion || compareVersions(latestVersion, currentVersion) <= 0) {
        if (manual) {
          const runtime = Updates.runtimeVersion || currentVersion;
          Alert.alert("You're up to date", `OnCampus ${currentVersion} (runtime ${runtime}) is up to date.`);
        }
        return;
      }

      const apk = release.assets?.find((asset) => asset.name === APK_NAME);
      const downloadUrl = apk?.browser_download_url;
      if (!isTrustedApkUrl(downloadUrl)) {
        if (manual) Alert.alert("Updates", "The latest native release is not ready for Android installation yet.");
        return;
      }

      const body = release.body || "";
      const minSupportedVersion = normalizeVersion(releaseFlag(body, "min-version"));
      const forceFlag = String(releaseFlag(body, "force-update") || "false").toLowerCase() === "true";
      const forceUpdate = forceFlag || compareVersions(currentVersion, minSupportedVersion) < 0;
      const notes = cleanReleaseNotes(body);
      const message = `OnCampus ${latestVersion} is available.${notes ? `\n\n${notes}` : ""}`;

      const install = () => {
        if (downloadUrl) void Linking.openURL(downloadUrl);
      };

      Alert.alert(
        forceUpdate ? "Native update required" : "Native update available",
        message,
        forceUpdate
          ? [{ text: "Update now", onPress: install }]
          : [
              { text: "Later", style: "cancel" },
              { text: "Update now", onPress: install },
            ],
        { cancelable: !forceUpdate }
      );
    } catch {
      if (manual) Alert.alert("Updates", "Could not check for updates right now. Please try again later.");
    }
  })();

  try {
    await activeCheck;
  } finally {
    activeCheck = null;
  }
}

export default function AppUpdateGate() {
  useEffect(() => {
    const timer = setTimeout(() => {
      void checkForAppUpdate(false);
    }, 1400);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void checkForAppUpdate(false);
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return null;
}
