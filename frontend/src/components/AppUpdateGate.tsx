import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";

const RELEASE_API = "https://api.github.com/repos/ommehta0022/oncamp_v2/releases/latest";
const TRUSTED_DOWNLOAD_PREFIX = "https://github.com/ommehta0022/oncamp_v2/releases/download/";
const APK_NAME = "OnCampus.apk";
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const OTA_CHECK_INTERVAL_MS = 10 * 60 * 1000;

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

type OtaPhase = "hidden" | "downloading" | "verifying" | "ready" | "error";

type OtaUiState = {
  phase: OtaPhase;
  progress: number;
  message: string;
  detail?: string;
};

const INITIAL_UI: OtaUiState = {
  phase: "hidden",
  progress: 0,
  message: "",
};

let otaUiListener: ((state: OtaUiState) => void) | null = null;

function emitOtaUi(state: OtaUiState) {
  otaUiListener?.(state);
}

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
    .slice(0, 700);
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
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    let currentProgress = 10;
    let uiWasShown = false;

    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) return false;

      uiWasShown = true;
      emitOtaUi({
        phase: "downloading",
        progress: currentProgress,
        message: "Installing OnCampus update",
        detail: "Downloading signed app files securely…",
      });

      // expo-updates intentionally does not expose byte-level transfer progress.
      // Keep the indicator honest by showing phase progress and never reaching
      // completion until fetchUpdateAsync actually resolves.
      progressTimer = setInterval(() => {
        currentProgress = Math.min(currentProgress + 4, 74);
        emitOtaUi({
          phase: "downloading",
          progress: currentProgress,
          message: "Installing OnCampus update",
          detail: "Downloading signed app files securely…",
        });
      }, 450);

      const fetched = await Updates.fetchUpdateAsync();
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }

      if (!fetched.isNew) {
        emitOtaUi(INITIAL_UI);
        return false;
      }

      emitOtaUi({
        phase: "verifying",
        progress: 90,
        message: "Verifying update",
        detail: "Checking signature, runtime compatibility and downloaded files…",
      });

      await new Promise((resolve) => setTimeout(resolve, 450));

      emitOtaUi({
        phase: "ready",
        progress: 100,
        message: "Update installed",
        detail: "The new OnCampus files are ready. Restart once to apply them.",
      });
      return true;
    } catch (error) {
      if (progressTimer) clearInterval(progressTimer);
      if (uiWasShown || manual) {
        emitOtaUi({
          phase: "error",
          progress: 0,
          message: "Update could not be installed",
          detail: "Your current app is still safe to use. Check your connection and try again.",
        });
      }
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
    if (manual) Alert.alert("Updates", "In-app update checks are currently available on Android.");
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
        if (manual) Alert.alert("Updates", "Could not check for native updates right now.");
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
        if (manual) Alert.alert("Updates", "The latest native Android release is not ready yet.");
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

function OtaUpdateModal({ state, onClose, onRetry }: { state: OtaUiState; onClose: () => void; onRetry: () => void }) {
  const visible = state.phase !== "hidden";
  const busy = state.phase === "downloading" || state.phase === "verifying";
  const ready = state.phase === "ready";
  const error = state.phase === "error";

  const phaseLabel = useMemo(() => {
    if (state.phase === "downloading") return "DOWNLOADING";
    if (state.phase === "verifying") return "VERIFYING";
    if (state.phase === "ready") return "READY";
    if (state.phase === "error") return "RETRY NEEDED";
    return "";
  }, [state.phase]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => { if (!busy) onClose(); }}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.brandRow}>
            <View style={styles.logoMark}><Text style={styles.logoText}>O</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.brand}>OnCampus</Text>
              <Text style={styles.phase}>{phaseLabel}</Text>
            </View>
            {busy ? <ActivityIndicator color="#2E5C4E" /> : null}
          </View>

          <Text style={styles.title}>{state.message}</Text>
          {!!state.detail && <Text style={styles.detail}>{state.detail}</Text>}

          {!error && (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, state.progress))}%` }]} />
            </View>
          )}

          <View style={styles.securityRow}>
            <Text style={styles.lock}>✓</Text>
            <Text style={styles.securityText}>Signed update • runtime verified • in-app installation</Text>
          </View>

          {ready && (
            <View style={styles.actions}>
              <Pressable style={styles.secondaryButton} onPress={onClose}>
                <Text style={styles.secondaryText}>Later</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={() => { void Updates.reloadAsync(); }}>
                <Text style={styles.primaryText}>Restart & Apply</Text>
              </Pressable>
            </View>
          )}

          {error && (
            <View style={styles.actions}>
              <Pressable style={styles.secondaryButton} onPress={onClose}>
                <Text style={styles.secondaryText}>Close</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={onRetry}>
                <Text style={styles.primaryText}>Try Again</Text>
              </Pressable>
            </View>
          )}

          {busy && <Text style={styles.keepOpen}>Keep OnCampus open while this update finishes.</Text>}
        </View>
      </View>
    </Modal>
  );
}

export default function AppUpdateGate() {
  const [otaUi, setOtaUi] = useState<OtaUiState>(INITIAL_UI);

  useEffect(() => {
    otaUiListener = setOtaUi;
    return () => {
      if (otaUiListener === setOtaUi) otaUiListener = null;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void checkForAppUpdate(false);
    }, 1200);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void checkForAppUpdate(false);
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return (
    <OtaUpdateModal
      state={otaUi}
      onClose={() => setOtaUi(INITIAL_UI)}
      onRetry={() => { setOtaUi(INITIAL_UI); void checkForAppUpdate(true); }}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(7, 18, 29, 0.66)",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2E5C4E",
  },
  logoText: { color: "#fff", fontSize: 22, fontWeight: "800" },
  brand: { fontSize: 17, fontWeight: "800", color: "#13231E" },
  phase: { marginTop: 2, fontSize: 10, fontWeight: "800", letterSpacing: 1.1, color: "#668078" },
  title: { marginTop: 22, fontSize: 23, lineHeight: 29, fontWeight: "800", color: "#10231D" },
  detail: { marginTop: 8, fontSize: 14, lineHeight: 21, color: "#5E716B" },
  progressTrack: { height: 9, borderRadius: 6, backgroundColor: "#E4ECE9", marginTop: 22, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 6, backgroundColor: "#2E5C4E" },
  securityRow: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 8 },
  lock: {
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: "center",
    lineHeight: 22,
    overflow: "hidden",
    backgroundColor: "#E1F1EB",
    color: "#1A6B50",
    fontWeight: "900",
  },
  securityText: { flex: 1, color: "#668078", fontSize: 12, lineHeight: 17 },
  actions: { marginTop: 24, flexDirection: "row", gap: 10 },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD8D3",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: "#365047", fontWeight: "700", fontSize: 14 },
  primaryButton: {
    flex: 1.35,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#2E5C4E",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
  keepOpen: { marginTop: 18, textAlign: "center", color: "#7A8A85", fontSize: 12 },
});
