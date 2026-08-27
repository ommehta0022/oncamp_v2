import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Image } from "expo-image";

import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/colors";
import { prefetchLatestOta } from "@/src/updates/backgroundOta";

const API_BASE = "https://oncampus-backend-production.up.railway.app/v1";
const NATIVE_RELEASE_API = `${API_BASE}/updates/native/latest`;
const TRUSTED_NATIVE_APK_PREFIX = `${API_BASE}/updates/native/apk?version=`;
const AUTOMATIC_CHECK_INTERVAL_MS = 60 * 1000;
const DEFER_MS = 6 * 60 * 60 * 1000;
const PENDING_OTA_KEY = "oncampus.update.pending_ota.v5";
const APPLY_OTA_ON_RESUME_KEY = "oncampus.update.apply_ota_on_resume.v2";
const PENDING_NATIVE_KEY = "oncampus.update.pending_native.v4";
const DEFER_KEY = "oncampus.update.defer.v2";
const SUCCESS_SHOWN_KEY = "oncampus.update.success_shown.v4";
const APP_ICON = require("../../assets/images/icon.png");

let lastAutomaticCheckAt = 0;
let activeCheck: Promise<void> | null = null;
let activeOtaApply: Promise<void> | null = null;
let updateUiListener: ((state: UpdateUiState) => void) | null = null;
let pendingOtaReleaseKey: string | null = null;
let downloadedPendingKey: string | null = null;
let pendingNativeRelease: NativeRelease | null = null;

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

type NativeInstallerResult = { status?: "permission_required" | "downloading" | "installing" | "restarting" | string };
type NativeInstaller = {
  startInstall: (url: string, sha256: string) => Promise<NativeInstallerResult>;
  restartForOta: () => Promise<NativeInstallerResult>;
  addListener: (eventName: string) => void;
  removeListeners: (count: number) => void;
};

type UpdateKind = "ota" | "apk";
export type UpdateCheckMode = "automatic" | "manual" | "campaign";
type UpdatePhase = "hidden" | "checking" | "available" | "downloading" | "verifying" | "installing" | "permission" | "current" | "applied" | "error";

type UpdateUiState = {
  kind: UpdateKind;
  phase: UpdatePhase;
  progress: number;
  message: string;
  detail?: string;
  releaseKey?: string;
  force?: boolean;
};

type DeferredUpdate = { key: string; until: number };
type PendingOtaMarker = { beforeUpdateId: string; releaseKey: string; startedAt: number };

const INITIAL_UI: UpdateUiState = { kind: "ota", phase: "hidden", progress: 0, message: "" };
const nativeInstaller = NativeModules.OnCampusApkInstaller as NativeInstaller | undefined;

function emitUpdateUi(state: UpdateUiState) {
  updateUiListener?.(state);
}

function normalizeVersion(value?: string | null) {
  return String(value || "0.0.0").trim().replace(/^v/i, "").split("-")[0];
}

function versionParts(value: string) {
  return normalizeVersion(value).split(".").slice(0, 4).map((part) => {
    const parsed = Number.parseInt(part.replace(/\D/g, ""), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  });
}

function compareVersions(left: string, right: string) {
  const a = versionParts(left);
  const b = versionParts(right);
  const length = Math.max(a.length, b.length, 3);
  for (let index = 0; index < length; index += 1) {
    const av = a[index] || 0;
    const bv = b[index] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

function currentVersion() {
  return normalizeVersion(Constants.expoConfig?.version);
}

function currentRuntime() {
  return String(Updates.runtimeVersion || Constants.expoConfig?.runtimeVersion || "");
}

function currentUpdateId() {
  return String(Updates.updateId || "embedded");
}

function currentInstallIdentity() {
  return `${currentVersion()}|${currentRuntime()}|${currentUpdateId()}`;
}

function isTrustedNativeRelease(release: NativeRelease) {
  return Boolean(
    release.apkUrl?.startsWith(TRUSTED_NATIVE_APK_PREFIX) &&
    release.sha256?.match(/^[a-fA-F0-9]{64}$/) &&
    release.version?.match(/^\d+\.\d+\.\d+$/),
  );
}

async function readDeferred(): Promise<DeferredUpdate | null> {
  try {
    const raw = await AsyncStorage.getItem(DEFER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeferredUpdate;
    if (!parsed?.key || !Number.isFinite(parsed.until)) return null;
    if (parsed.until <= Date.now()) {
      await AsyncStorage.removeItem(DEFER_KEY).catch(() => undefined);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function isDeferred(key: string, mode: UpdateCheckMode, force = false) {
  if (mode === "manual" || force) return false;
  const deferred = await readDeferred();
  return deferred?.key === key;
}

async function deferUpdate(key?: string) {
  if (!key) return;
  await AsyncStorage.setItem(DEFER_KEY, JSON.stringify({ key, until: Date.now() + DEFER_MS } satisfies DeferredUpdate)).catch(() => undefined);
}

async function clearDeferral(key?: string) {
  if (!key) return;
  const deferred = await readDeferred();
  if (!deferred || deferred.key === key) await AsyncStorage.removeItem(DEFER_KEY).catch(() => undefined);
}

async function serverOtaId(strict = false) {
  const runtime = currentRuntime();
  if (!runtime) {
    if (strict) throw new Error("This installation has no OTA runtime identity.");
    return null;
  }
  try {
    const response = await fetch(`${API_BASE}/updates/status?runtimeVersion=${encodeURIComponent(runtime)}`, {
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    });
    if (!response.ok) throw new Error(`Update service returned ${response.status}`);
    const payload = await response.json() as { releaseAvailable?: boolean; updateId?: string | null };
    return payload.releaseAvailable && payload.updateId ? String(payload.updateId) : null;
  } catch {
    if (strict) throw new Error("Couldn’t reach the OnCampus update service. Check your connection and try again.");
    return null;
  }
}

async function reconcileAppliedUpdate(): Promise<boolean> {
  try {
    const identity = currentInstallIdentity();
    const installedVersion = currentVersion();
    const [pendingOtaRaw, pendingNative, successShown] = await Promise.all([
      AsyncStorage.getItem(PENDING_OTA_KEY),
      AsyncStorage.getItem(PENDING_NATIVE_KEY),
      AsyncStorage.getItem(SUCCESS_SHOWN_KEY),
    ]);

    let applied = false;
    let kind: UpdateKind = "ota";
    if (pendingOtaRaw) {
      try {
        const marker = JSON.parse(pendingOtaRaw) as PendingOtaMarker;
        if (marker?.beforeUpdateId && marker.beforeUpdateId !== currentUpdateId()) {
          applied = true;
          await Promise.all([
            AsyncStorage.removeItem(PENDING_OTA_KEY),
            AsyncStorage.removeItem(APPLY_OTA_ON_RESUME_KEY),
            AsyncStorage.removeItem(DEFER_KEY),
          ]);
        } else if (Date.now() - Number(marker?.startedAt || 0) > 24 * 60 * 60 * 1000) {
          await Promise.all([AsyncStorage.removeItem(PENDING_OTA_KEY), AsyncStorage.removeItem(APPLY_OTA_ON_RESUME_KEY)]);
        }
      } catch {
        await Promise.all([AsyncStorage.removeItem(PENDING_OTA_KEY), AsyncStorage.removeItem(APPLY_OTA_ON_RESUME_KEY)]);
      }
    }

    if (pendingNative && compareVersions(installedVersion, pendingNative) >= 0) {
      applied = true;
      kind = "apk";
      await Promise.all([AsyncStorage.removeItem(PENDING_NATIVE_KEY), AsyncStorage.removeItem(DEFER_KEY)]);
    }

    if (applied && successShown !== identity) {
      await AsyncStorage.setItem(SUCCESS_SHOWN_KEY, identity);
      emitUpdateUi({
        kind,
        phase: "applied",
        progress: 100,
        message: "Update installed",
        detail: `OnCampus ${installedVersion} is running successfully.`,
      });
      return true;
    }
  } catch {
    // Update bookkeeping must never block startup.
  }
  return false;
}

async function showDownloadedPending(mode: UpdateCheckMode) {
  if (!downloadedPendingKey) return false;
  if (await isDeferred(downloadedPendingKey, mode)) return true;
  pendingOtaReleaseKey = downloadedPendingKey;
  emitUpdateUi({
    kind: "ota",
    phase: "available",
    progress: 100,
    releaseKey: downloadedPendingKey,
    message: "Update downloaded",
    detail: "The signed update is ready. Apply it with one quick restart, or choose Later.",
  });
  return true;
}

async function checkForOtaUpdate(mode: UpdateCheckMode): Promise<boolean> {
  if (Platform.OS !== "android" || !Updates.isEnabled) return false;
  if (await showDownloadedPending(mode)) return true;

  const serverId = await serverOtaId(mode === "manual");
  if (!serverId || serverId === currentUpdateId()) return false;
  const releaseKey = `ota:${serverId}`;
  if (await isDeferred(releaseKey, mode)) return true;

  pendingOtaReleaseKey = releaseKey;
  emitUpdateUi({
    kind: "ota",
    phase: "available",
    progress: 0,
    releaseKey,
    message: "OnCampus update available",
    detail: "A signed update for this app version is ready to download.",
  });
  void prefetchLatestOta(true).catch(() => undefined);
  return true;
}

async function markOtaApply(releaseKey: string) {
  const marker: PendingOtaMarker = { beforeUpdateId: currentUpdateId(), releaseKey, startedAt: Date.now() };
  await AsyncStorage.setItem(PENDING_OTA_KEY, JSON.stringify(marker));
}

async function queueOtaApply(releaseKey: string) {
  await Promise.all([
    markOtaApply(releaseKey),
    AsyncStorage.setItem(APPLY_OTA_ON_RESUME_KEY, releaseKey),
  ]);
}

async function reloadReadyOta(releaseKey: string) {
  if (AppState.currentState !== "active") return false;
  emitUpdateUi({
    kind: "ota",
    phase: "verifying",
    progress: 94,
    releaseKey,
    message: "Update verified",
    detail: "The signed bundle is ready. Preparing a clean restart…",
  });
  await new Promise((resolve) => setTimeout(resolve, 180));
  if (!nativeInstaller?.restartForOta) {
    emitUpdateUi({ kind: "ota", phase: "available", progress: 100, releaseKey, message: "Update ready", detail: "Close OnCampus completely and reopen it to apply this update." });
    return false;
  }
  emitUpdateUi({ kind: "ota", phase: "installing", progress: 100, releaseKey, message: "Restarting OnCampus", detail: "Applying the verified update now…" });
  await nativeInstaller.restartForOta();
  return true;
}

async function resumePendingOtaApply(): Promise<boolean> {
  if (Platform.OS !== "android" || !Updates.isEnabled || AppState.currentState !== "active") return false;
  const releaseKey = await AsyncStorage.getItem(APPLY_OTA_ON_RESUME_KEY).catch(() => null);
  if (!releaseKey) return false;

  if (activeOtaApply) {
    await activeOtaApply.catch(() => undefined);
    return true;
  }

  activeOtaApply = (async () => {
    emitUpdateUi({ kind: "ota", phase: "downloading", progress: 58, releaseKey, message: "Finishing update", detail: "Checking the background download before applying it…" });
    const ready = Boolean(downloadedPendingKey) || await prefetchLatestOta(true);
    if (!ready) {
      emitUpdateUi({ kind: "ota", phase: "downloading", progress: 42, releaseKey, message: "Update still downloading", detail: "Android will keep retrying in the background. Keep this screen open or return later." });
      return;
    }
    downloadedPendingKey = releaseKey;
    if (AppState.currentState === "active") await reloadReadyOta(releaseKey);
  })()
    .catch(() => {
      emitUpdateUi({ kind: "ota", phase: "downloading", progress: 42, releaseKey, message: "Update will keep retrying", detail: "The network changed or Android paused the task. Your update is safe and will resume automatically." });
    })
    .finally(() => { activeOtaApply = null; });

  await activeOtaApply;
  return true;
}

async function downloadAndApplyOta(releaseKey: string) {
  await clearDeferral(releaseKey);
  if (activeOtaApply) return activeOtaApply;

  activeOtaApply = (async () => {
    await queueOtaApply(releaseKey);

    if (downloadedPendingKey) {
      if (AppState.currentState === "active") await reloadReadyOta(releaseKey);
      else emitUpdateUi({ kind: "ota", phase: "available", progress: 100, releaseKey, message: "Update downloaded", detail: "Return to OnCampus to apply the verified update." });
      return;
    }

    emitUpdateUi({
      kind: "ota",
      phase: "downloading",
      progress: 24,
      releaseKey,
      message: "Downloading update",
      detail: "Fetching the signed bundle. You can minimize OnCampus; Android will continue or retry in the background.",
    });

    const ready = await prefetchLatestOta(true);
    if (!ready) {
      const serverId = await serverOtaId();
      if (!serverId || serverId === currentUpdateId()) {
        await Promise.all([AsyncStorage.removeItem(PENDING_OTA_KEY), AsyncStorage.removeItem(APPLY_OTA_ON_RESUME_KEY)]);
        emitUpdateUi({ kind: "ota", phase: "current", progress: 100, message: "Already up to date", detail: "There is no newer signed update for this installation." });
        return;
      }
      emitUpdateUi({
        kind: "ota",
        phase: "downloading",
        progress: 42,
        releaseKey,
        message: "Download continuing",
        detail: "The update is still available. Android will retry automatically; this screen will stay here instead of reporting a false failure.",
      });
      void prefetchLatestOta(true).catch(() => undefined);
      return;
    }

    downloadedPendingKey = releaseKey;
    if (AppState.currentState !== "active") {
      emitUpdateUi({ kind: "ota", phase: "available", progress: 100, releaseKey, message: "Update downloaded", detail: "Return to OnCampus to apply the verified update." });
      return;
    }
    await reloadReadyOta(releaseKey);
  })()
    .catch(() => {
      emitUpdateUi({ kind: "ota", phase: "downloading", progress: 42, releaseKey, message: "Update will keep retrying", detail: "Android paused the transfer or the connection changed. The update remains queued and will resume automatically." });
      void prefetchLatestOta(true).catch(() => undefined);
    })
    .finally(() => { activeOtaApply = null; });

  return activeOtaApply;
}

async function fetchNativeRelease(): Promise<NativeRelease | null> {
  try {
    const response = await fetch(NATIVE_RELEASE_API, { headers: { Accept: "application/json", "Cache-Control": "no-cache" } });
    if (!response.ok) return null;
    return await response.json() as NativeRelease;
  } catch {
    return null;
  }
}

async function checkForNativeUpdate(mode: UpdateCheckMode) {
  const release = await fetchNativeRelease();
  const installed = currentVersion();
  const latest = normalizeVersion(release?.version);

  if (!release?.available || !latest || compareVersions(latest, installed) <= 0) {
    if (mode === "manual") emitUpdateUi({ kind: "ota", phase: "current", progress: 100, message: "You’re up to date", detail: `OnCampus ${installed} has no newer compatible update right now.` });
    return;
  }

  if (!isTrustedNativeRelease(release)) {
    if (mode === "manual") emitUpdateUi({ kind: "apk", phase: "error", progress: 0, message: "Update metadata could not be verified", detail: "The current app remains unchanged. Try again later." });
    return;
  }

  const force = Boolean(release.forceUpdate) || compareVersions(installed, normalizeVersion(release.minVersion)) < 0;
  const releaseKey = `apk:${latest}`;
  if (await isDeferred(releaseKey, mode, force)) return;

  pendingNativeRelease = release;
  const notes = String(release.notes || "").trim().slice(0, 360);
  const size = release.size && release.size > 0 ? ` ${(release.size / 1024 / 1024).toFixed(1)} MB.` : "";
  emitUpdateUi({
    kind: "apk",
    phase: "available",
    progress: 0,
    releaseKey,
    force,
    message: force ? "Android update required" : `OnCampus ${latest} is available`,
    detail: `${notes || "This release includes native improvements and requires Android installation."}${size}`,
  });
}

async function startNativeInstall(release: NativeRelease) {
  const version = normalizeVersion(release.version);
  const releaseKey = `apk:${version}`;
  await clearDeferral(releaseKey);
  if (!nativeInstaller || !release.apkUrl || !release.sha256 || !version) {
    emitUpdateUi({ kind: "apk", phase: "error", progress: 0, releaseKey, message: "Secure installer unavailable", detail: "This build cannot start the Android installer. Your current app is unchanged." });
    return;
  }

  await AsyncStorage.setItem(PENDING_NATIVE_KEY, version);
  emitUpdateUi({ kind: "apk", phase: "downloading", progress: 1, releaseKey, message: "Starting Android download", detail: "The APK will show real download percentage, then SHA-256 verification before Android asks you to confirm installation." });
  try {
    const result = await nativeInstaller.startInstall(release.apkUrl, release.sha256);
    if (result?.status === "permission_required") {
      emitUpdateUi({ kind: "apk", phase: "permission", progress: 100, releaseKey, message: "Allow app installation", detail: "Enable “Allow from this source”, then return. The verified installation will continue." });
    }
  } catch (error) {
    emitUpdateUi({ kind: "apk", phase: "error", progress: 0, releaseKey, message: "Android update could not start", detail: error instanceof Error ? error.message.slice(0, 180) : "Your current app is unchanged. Please try again." });
  }
}

export async function checkForAppUpdate(
  modeOrManual: UpdateCheckMode | boolean = "automatic",
  bypassNativeThrottle = false,
  bypassOtaThrottle = false,
) {
  const mode: UpdateCheckMode = typeof modeOrManual === "boolean" ? (modeOrManual ? "manual" : "automatic") : modeOrManual;

  if (Platform.OS !== "android") {
    if (mode === "manual") emitUpdateUi({ kind: "ota", phase: "current", progress: 100, message: "Updates are managed automatically", detail: "No action is required on this platform." });
    return;
  }

  const now = Date.now();
  const bypassThrottle = mode === "manual" || mode === "campaign" || bypassNativeThrottle || bypassOtaThrottle;
  if (mode === "automatic" && !bypassThrottle && now - lastAutomaticCheckAt < AUTOMATIC_CHECK_INTERVAL_MS) return;
  if (activeCheck) return activeCheck;
  if (mode === "automatic" && !bypassThrottle) lastAutomaticCheckAt = now;

  activeCheck = (async () => {
    if (mode === "manual") emitUpdateUi({ kind: "ota", phase: "checking", progress: 10, message: "Checking for updates", detail: "Checking the signed OTA channel first, then the verified Android release." });
    try {
      const otaAvailable = await checkForOtaUpdate(mode);
      if (otaAvailable) return;
      await checkForNativeUpdate(mode);
    } catch (error) {
      if (mode === "manual") emitUpdateUi({ kind: "ota", phase: "error", progress: 0, message: "Couldn’t complete the update check", detail: error instanceof Error ? error.message.slice(0, 180) : "Check your connection and try again." });
    }
  })();

  try {
    await activeCheck;
  } finally {
    activeCheck = null;
  }
}

function UpdateModal({ state, onClose, onLater, onUpdateNow, onRetry }: {
  state: UpdateUiState;
  onClose: () => void;
  onLater: () => void;
  onUpdateNow: () => void;
  onRetry: () => void;
}) {
  const { colors } = useTheme();
  const visible = state.phase !== "hidden";
  const busy = ["checking", "downloading", "verifying", "installing"].includes(state.phase);
  const available = state.phase === "available";
  const error = state.phase === "error";
  const terminal = state.phase === "current" || state.phase === "applied";
  const permission = state.phase === "permission";
  const progress = Math.max(0, Math.min(100, Math.round(state.progress || 0)));

  const label = useMemo(() => {
    if (state.phase === "checking") return "SECURE CHECK";
    if (state.phase === "available") return state.kind === "ota" ? "UPDATE READY" : "ANDROID RELEASE";
    if (state.phase === "downloading") return "DOWNLOADING";
    if (state.phase === "verifying") return "VERIFYING";
    if (state.phase === "installing") return state.kind === "apk" ? "ANDROID INSTALLER" : "APPLYING";
    if (state.phase === "permission") return "PERMISSION NEEDED";
    if (state.phase === "applied") return "UPDATED";
    if (state.phase === "current") return "CURRENT";
    return "ATTENTION";
  }, [state.kind, state.phase]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => { if (!busy && !state.force) onClose(); }}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}> 
        <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, shadowColor: colors.shadow }]} accessible accessibilityViewIsModal>
          <View style={styles.brandRow}>
            <Image source={APP_ICON} style={styles.logo} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.brand, { color: colors.onSurface }]}>OnCampus</Text>
              <Text style={[styles.phase, { color: state.phase === "error" ? colors.error : terminal ? colors.success : colors.onSurfaceTertiary }]}>{label}</Text>
            </View>
            {busy ? <ActivityIndicator color={colors.brandPrimary} accessibilityLabel="Update in progress" /> : null}
          </View>

          <Text style={[styles.title, { color: colors.onSurface }]} accessibilityRole="header">{state.message}</Text>
          {!!state.detail && <Text style={[styles.detail, { color: colors.onSurfaceTertiary }]}>{state.detail}</Text>}

          {busy ? (
            <View style={styles.progressBlock}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, { color: colors.onSurfaceTertiary }]}>{state.kind === "apk" && state.phase === "downloading" ? "Downloaded" : "Progress"}</Text>
                <Text style={[styles.progressPercent, { color: colors.onSurface }]}>{progress}%</Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.surfaceTertiary }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: progress }}>
                <View style={[styles.progressFill, { backgroundColor: colors.brandPrimary, width: `${Math.max(4, progress)}%` }]} />
              </View>
              {state.kind === "ota" ? <Text style={[styles.progressNote, { color: colors.muted }]}>OTA percentage is staged because Expo does not expose byte-level download progress.</Text> : null}
            </View>
          ) : null}

          <View style={[styles.securityRow, { backgroundColor: colors.surfaceTertiary }]}> 
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.success} />
            <Text style={[styles.securityText, { color: colors.onSurfaceTertiary }]}>{state.kind === "apk" ? "Trusted endpoint • SHA-256 verification • Android system installer" : "Signed manifest • matching runtime • rollback-safe cache"}</Text>
          </View>

          {available ? (
            <View style={styles.actions}>
              {!state.force ? <Pressable style={[styles.secondaryButton, { borderColor: colors.borderStrong }]} onPress={onLater} accessibilityRole="button"><Text style={[styles.secondaryText, { color: colors.onSurface }]}>Later</Text></Pressable> : null}
              <Pressable style={[styles.primaryButton, { backgroundColor: colors.brandPrimary }]} onPress={onUpdateNow} accessibilityRole="button"><Text style={{ color: colors.onBrandPrimary, fontWeight: "800", fontSize: 14 }}>{state.kind === "ota" ? (state.progress >= 100 ? "Restart & apply" : "Update now") : "Install now"}</Text></Pressable>
            </View>
          ) : null}

          {(terminal || permission) ? (
            <View style={styles.actions}>
              <Pressable style={[styles.primaryButton, { backgroundColor: terminal ? colors.onSurface : colors.brandPrimary }]} onPress={onClose} accessibilityRole="button"><Text style={{ color: terminal ? colors.surface : colors.onBrandPrimary, fontWeight: "800", fontSize: 14 }}>{permission ? "Continue after allowing" : "Done"}</Text></Pressable>
            </View>
          ) : null}

          {error ? (
            <View style={styles.actions}>
              <Pressable style={[styles.secondaryButton, { borderColor: colors.borderStrong }]} onPress={onClose} accessibilityRole="button"><Text style={[styles.secondaryText, { color: colors.onSurface }]}>Close</Text></Pressable>
              <Pressable style={[styles.primaryButton, { backgroundColor: colors.brandPrimary }]} onPress={onRetry} accessibilityRole="button"><Text style={{ color: colors.onBrandPrimary, fontWeight: "800", fontSize: 14 }}>Try again</Text></Pressable>
            </View>
          ) : null}

          {busy ? <Text style={[styles.keepOpen, { color: colors.muted }]}>{state.kind === "ota" ? "You may minimize OnCampus. The update stays queued and this status will be restored when you return." : "You may minimize OnCampus while Android DownloadManager continues the APK transfer."}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

export default function AppUpdateGate() {
  const [updateUi, setUpdateUi] = useState<UpdateUiState>(INITIAL_UI);
  const { isUpdatePending, downloadedUpdate } = Updates.useUpdates();

  useEffect(() => {
    updateUiListener = setUpdateUi;
    return () => { if (updateUiListener === setUpdateUi) updateUiListener = null; };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android" || !Updates.isEnabled || !isUpdatePending) return;
    downloadedPendingKey = `ota:${String(downloadedUpdate?.updateId || currentRuntime() || "pending")}`;
    void AsyncStorage.getItem(APPLY_OTA_ON_RESUME_KEY).then((applyIntent) => {
      if (applyIntent && AppState.currentState === "active") void resumePendingOtaApply();
      else void showDownloadedPending("automatic");
    });
  }, [downloadedUpdate?.updateId, isUpdatePending]);

  useEffect(() => {
    if (!nativeInstaller) return;
    const emitter = new NativeEventEmitter(nativeInstaller as never);
    const subscription = emitter.addListener("OnCampusApkInstall", (event: { phase?: UpdatePhase; progress?: number; message?: string; detail?: string }) => {
      setUpdateUi({
        kind: "apk",
        phase: event.phase || "error",
        progress: Number.isFinite(event.progress) ? Number(event.progress) : 0,
        message: event.message || "Android update",
        detail: event.detail,
        releaseKey: pendingNativeRelease?.version ? `apk:${normalizeVersion(pendingNativeRelease.version)}` : undefined,
      });
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const initialize = async () => {
      const showedApplied = await reconcileAppliedUpdate();
      if (cancelled || showedApplied) return;
      const resumed = await resumePendingOtaApply();
      if (cancelled || resumed) return;
      timer = setTimeout(() => { void checkForAppUpdate("automatic"); }, 650);
    };
    void initialize();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void resumePendingOtaApply().then((resumed) => { if (!resumed) void checkForAppUpdate("automatic"); });
      } else if (activeOtaApply && pendingOtaReleaseKey) {
        emitUpdateUi({ kind: "ota", phase: "downloading", progress: 38, releaseKey: pendingOtaReleaseKey, message: "Update continuing in background", detail: "Android will keep the signed download queued. Return to OnCampus to finish applying it." });
      }
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  const close = () => setUpdateUi(INITIAL_UI);
  const later = () => {
    const key = updateUi.releaseKey;
    if (key?.startsWith("ota:")) {
      void Promise.all([AsyncStorage.removeItem(APPLY_OTA_ON_RESUME_KEY), AsyncStorage.removeItem(PENDING_OTA_KEY)]).catch(() => undefined);
    }
    void deferUpdate(key).finally(close);
  };
  const updateNow = () => {
    if (updateUi.kind === "ota") {
      const key = updateUi.releaseKey || pendingOtaReleaseKey || downloadedPendingKey || `ota:${currentRuntime()}`;
      void downloadAndApplyOta(key);
      return;
    }
    if (pendingNativeRelease) void startNativeInstall(pendingNativeRelease);
  };

  return <UpdateModal state={updateUi} onClose={close} onLater={later} onUpdateNow={updateNow} onRetry={() => { close(); void checkForAppUpdate("manual", true, true); }} />;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", paddingHorizontal: 20 },
  card: { borderRadius: 22, padding: 22, borderWidth: 1, shadowOpacity: 0.16, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 14 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 42, height: 42, borderRadius: 12 },
  brand: { fontSize: 17, fontWeight: "800" },
  phase: { marginTop: 2, fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  title: { marginTop: 20, fontSize: 22, lineHeight: 28, fontWeight: "800", letterSpacing: -0.35 },
  detail: { marginTop: 8, fontSize: 14, lineHeight: 21 },
  progressBlock: { marginTop: 20 },
  progressHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressLabel: { fontSize: 12, fontWeight: "600" },
  progressPercent: { fontSize: 14, fontWeight: "800" },
  progressTrack: { height: 8, borderRadius: 6, marginTop: 8, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 6 },
  progressNote: { marginTop: 7, fontSize: 10, lineHeight: 14 },
  securityRow: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 9, borderRadius: radius.md, padding: spacing.md },
  securityText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: "600" },
  actions: { marginTop: 22, flexDirection: "row", gap: 10 },
  secondaryButton: { flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontWeight: "700", fontSize: 14 },
  primaryButton: { flex: 1.35, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  keepOpen: { marginTop: 14, textAlign: "center", fontSize: 11, lineHeight: 16, fontWeight: "500" },
});
