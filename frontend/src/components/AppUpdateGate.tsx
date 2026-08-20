import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  NativeEventEmitter,
  NativeModules,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";

const API_BASE = "https://oncampus-backend-production.up.railway.app/v1";
const NATIVE_RELEASE_API = `${API_BASE}/updates/native/latest`;
const TRUSTED_NATIVE_APK_PREFIX = `${API_BASE}/updates/native/apk?version=`;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const OTA_CHECK_INTERVAL_MS = 10 * 60 * 1000;

let lastAutomaticCheckAt = 0;
let lastOtaCheckAt = 0;
let activeCheck: Promise<void> | null = null;
let activeOtaCheck: Promise<boolean> | null = null;

type NativeRelease = {
  available?: boolean;
  version?: string;
  name?: string;
  notes?: string;
  minVersion?: string;
  forceUpdate?: boolean;
  sha256?: string;
  size?: number;
  apkUrl?: string;
};

type NativeInstallerResult = {
  status?: "permission_required" | "downloading" | string;
};

type NativeInstaller = {
  startInstall: (url: string, sha256: string) => Promise<NativeInstallerResult>;
  addListener: (eventName: string) => void;
  removeListeners: (count: number) => void;
};

type UpdateKind = "ota" | "apk";
type UpdatePhase = "hidden" | "permission" | "downloading" | "verifying" | "installing" | "ready" | "error";

type UpdateUiState = {
  kind: UpdateKind;
  phase: UpdatePhase;
  progress: number;
  message: string;
  detail?: string;
};

const INITIAL_UI: UpdateUiState = {
  kind: "ota",
  phase: "hidden",
  progress: 0,
  message: "",
};

const nativeInstaller = NativeModules.OnCampusApkInstaller as NativeInstaller | undefined;
let updateUiListener: ((state: UpdateUiState) => void) | null = null;

function emitUpdateUi(state: UpdateUiState) {
  updateUiListener?.(state);
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

function isTrustedNativeRelease(release: NativeRelease) {
  return Boolean(
    release.apkUrl?.startsWith(TRUSTED_NATIVE_APK_PREFIX) &&
      release.sha256?.match(/^[a-fA-F0-9]{64}$/) &&
      release.version?.match(/^\d+\.\d+\.\d+$/)
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
      emitUpdateUi({
        kind: "ota",
        phase: "downloading",
        progress: currentProgress,
        message: "Installing OnCampus update",
        detail: "Downloading signed app files securely…",
      });

      progressTimer = setInterval(() => {
        currentProgress = Math.min(currentProgress + 4, 74);
        emitUpdateUi({
          kind: "ota",
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
        emitUpdateUi(INITIAL_UI);
        return false;
      }

      emitUpdateUi({
        kind: "ota",
        phase: "verifying",
        progress: 90,
        message: "Verifying update",
        detail: "Checking signature, runtime compatibility and downloaded files…",
      });

      await new Promise((resolve) => setTimeout(resolve, 450));

      emitUpdateUi({
        kind: "ota",
        phase: "ready",
        progress: 100,
        message: "Update installed",
        detail: "The new OnCampus files are ready. Restart once to apply them.",
      });
      return true;
    } catch {
      if (progressTimer) clearInterval(progressTimer);
      if (uiWasShown || manual) {
        emitUpdateUi({
          kind: "ota",
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

async function startNativeInstall(release: NativeRelease) {
  if (!nativeInstaller || !release.apkUrl || !release.sha256) {
    Alert.alert(
      "New APK required",
      "This installed OnCampus version does not yet include the direct Android installer. Install the 1.4.0 baseline once; future APK updates will install directly inside OnCampus."
    );
    return;
  }

  emitUpdateUi({
    kind: "apk",
    phase: "downloading",
    progress: 1,
    message: "Preparing Android update",
    detail: "Starting secure download from the OnCampus update API…",
  });

  try {
    const result = await nativeInstaller.startInstall(release.apkUrl, release.sha256);
    if (result?.status === "permission_required") {
      emitUpdateUi({
        kind: "apk",
        phase: "permission",
        progress: 0,
        message: "Allow OnCampus to install updates",
        detail: "Enable Allow from this source, then return to OnCampus. The APK download starts automatically.",
      });
    }
  } catch {
    emitUpdateUi({
      kind: "apk",
      phase: "error",
      progress: 0,
      message: "Direct install could not start",
      detail: "The current app remains unchanged. Please try the update again.",
    });
  }
}

export async function checkForAppUpdate(manual = false, bypassNativeThrottle = false) {
  if (Platform.OS !== "android") {
    if (manual) Alert.alert("Updates", "In-app update checks are currently available on Android.");
    return;
  }

  const otaReady = await checkForOtaUpdate(manual);
  if (otaReady) return;

  const now = Date.now();
  if (!manual && !bypassNativeThrottle && now - lastAutomaticCheckAt < CHECK_INTERVAL_MS) return;
  if (activeCheck) return activeCheck;
  if (!manual && !bypassNativeThrottle) lastAutomaticCheckAt = now;

  activeCheck = (async () => {
    try {
      const response = await fetch(NATIVE_RELEASE_API, {
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      });
      if (!response.ok) {
        if (manual) Alert.alert("Updates", "Could not check for native updates right now.");
        return;
      }

      const release = (await response.json()) as NativeRelease;
      const currentVersion = normalizeVersion(Constants.expoConfig?.version);
      const latestVersion = normalizeVersion(release.version);

      if (!release.available || !latestVersion || compareVersions(latestVersion, currentVersion) <= 0) {
        if (manual) {
          const runtime = Updates.runtimeVersion || currentVersion;
          Alert.alert("You're up to date", `OnCampus ${currentVersion} (runtime ${runtime}) is up to date.`);
        }
        return;
      }

      if (!isTrustedNativeRelease(release)) {
        if (manual) Alert.alert("Updates", "The latest Android release did not pass update metadata validation.");
        return;
      }

      const minSupportedVersion = normalizeVersion(release.minVersion);
      const forceUpdate = Boolean(release.forceUpdate) || compareVersions(currentVersion, minSupportedVersion) < 0;
      const notes = String(release.notes || "").trim().slice(0, 700);
      const sizeMb = release.size && release.size > 0 ? `\n\nDownload size: ${(release.size / 1024 / 1024).toFixed(1)} MB` : "";
      const message = `OnCampus ${latestVersion} is available.${notes ? `\n\n${notes}` : ""}${sizeMb}`;

      const install = () => {
        void startNativeInstall(release);
      };

      Alert.alert(
        forceUpdate ? "Android update required" : "Android update available",
        message,
        forceUpdate
          ? [{ text: "Install now", onPress: install }]
          : [
              { text: "Later", style: "cancel" },
              { text: "Install now", onPress: install },
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

function UpdateModal({ state, onClose, onRetry }: { state: UpdateUiState; onClose: () => void; onRetry: () => void }) {
  const visible = state.phase !== "hidden";
  const busy = state.phase === "downloading" || state.phase === "verifying";
  const otaReady = state.kind === "ota" && state.phase === "ready";
  const apkInstallerOpen = state.kind === "apk" && state.phase === "installing";
  const permission = state.kind === "apk" && state.phase === "permission";
  const error = state.phase === "error";

  const phaseLabel = useMemo(() => {
    if (state.phase === "permission") return "PERMISSION";
    if (state.phase === "downloading") return "DOWNLOADING";
    if (state.phase === "verifying") return "VERIFYING";
    if (state.phase === "installing") return "ANDROID INSTALLER";
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

          {!error && state.phase !== "permission" && (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, state.progress))}%` }]} />
            </View>
          )}

          <View style={styles.securityRow}>
            <Text style={styles.lock}>✓</Text>
            <Text style={styles.securityText}>
              {state.kind === "apk"
                ? "OnCampus API • SHA-256 verified • Android package installer"
                : "Signed update • runtime verified • in-app installation"}
            </Text>
          </View>

          {otaReady && (
            <View style={styles.actions}>
              <Pressable style={styles.secondaryButton} onPress={onClose}>
                <Text style={styles.secondaryText}>Later</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={() => { void Updates.reloadAsync(); }}>
                <Text style={styles.primaryText}>Restart & Apply</Text>
              </Pressable>
            </View>
          )}

          {(permission || apkInstallerOpen) && (
            <View style={styles.actions}>
              <Pressable style={styles.primaryButton} onPress={onClose}>
                <Text style={styles.primaryText}>{permission ? "I’ll return after allowing" : "Close"}</Text>
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
  const [updateUi, setUpdateUi] = useState<UpdateUiState>(INITIAL_UI);

  useEffect(() => {
    updateUiListener = setUpdateUi;
    return () => {
      if (updateUiListener === setUpdateUi) updateUiListener = null;
    };
  }, []);

  useEffect(() => {
    if (!nativeInstaller) return;
    const emitter = new NativeEventEmitter(nativeInstaller as never);
    const subscription = emitter.addListener("OnCampusApkInstall", (event: {
      phase?: UpdatePhase;
      progress?: number;
      message?: string;
      detail?: string;
    }) => {
      const phase = event.phase || "error";
      setUpdateUi({
        kind: "apk",
        phase,
        progress: Number.isFinite(event.progress) ? Number(event.progress) : 0,
        message: event.message || "Android update",
        detail: event.detail,
      });
    });
    return () => subscription.remove();
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
    <UpdateModal
      state={updateUi}
      onClose={() => setUpdateUi(INITIAL_UI)}
      onRetry={() => { setUpdateUi(INITIAL_UI); void checkForAppUpdate(true); }}
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