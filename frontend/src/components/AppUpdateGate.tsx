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
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/colors";
import { prefetchLatestOta } from "@/src/updates/backgroundOta";

const API_BASE = "https://oncampus-backend-production.up.railway.app/v1";
const NATIVE_RELEASE_API = `${API_BASE}/updates/native/latest`;
const TRUSTED_NATIVE_APK_PREFIX = `${API_BASE}/updates/native/apk?version=`;
const AUTOMATIC_CHECK_INTERVAL_MS = 60 * 1000;
const DEFER_MS = 6 * 60 * 60 * 1000;
const PENDING_OTA_KEY = "oncampus.update.pending_ota.v4";
const APPLY_OTA_ON_RESUME_KEY = "oncampus.update.apply_ota_on_resume.v1";
const PENDING_NATIVE_KEY = "oncampus.update.pending_native.v3";
const DEFER_KEY = "oncampus.update.defer.v1";
const SUCCESS_SHOWN_KEY = "oncampus.update.success_shown.v3";
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

type NativeInstallerResult = { status?: "permission_required" | "downloading" | string };
type NativeInstaller = {
  startInstall: (url: string, sha256: string) => Promise<NativeInstallerResult>;
  restartForOta: () => Promise<NativeInstallerResult>;
  addListener: (eventName: string) => void;
  removeListeners: (count: number) => void;
};

type UpdateKind = "ota" | "apk";
export type UpdateCheckMode = "automatic" | "manual" | "campaign";
type UpdatePhase = "hidden" | "checking" | "available" | "downloading" | "ready" | "verifying" | "installing" | "permission" | "current" | "applied" | "error";

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
    release.version?.match(/^\d+\.\d+\.\d+$/)
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
  try {
    const deferred = await readDeferred();
    if (!deferred || deferred.key === key) await AsyncStorage.removeItem(DEFER_KEY);
  } catch {
    // Deferral cleanup is best effort only.
  }
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
          await Promise.all([
            AsyncStorage.removeItem(PENDING_OTA_KEY),
            AsyncStorage.removeItem(APPLY_OTA_ON_RESUME_KEY),
          ]);
        }
      } catch {
        await Promise.all([
          AsyncStorage.removeItem(PENDING_OTA_KEY),
          AsyncStorage.removeItem(APPLY_OTA_ON_RESUME_KEY),
        ]);
      }
    }

    if (pendingNative && compareVersions(installedVersion, pendingNative) >= 0) {
      applied = true;
      await Promise.all([AsyncStorage.removeItem(PENDING_NATIVE_KEY), AsyncStorage.removeItem(DEFER_KEY)]);
    }

    if (applied && successShown !== identity) {
      await AsyncStorage.setItem(SUCCESS_SHOWN_KEY, identity);
      emitUpdateUi({
        kind: "ota",
        phase: "applied",
        progress: 100,
        message: "Update complete",
        detail: "OnCampus is running the new version successfully. You’ll only see this confirmation once.",
      });
      return true;
    }
  } catch {
    // Never block app startup because update bookkeeping failed.
  }
  return false;
}

async function showDownloadedPending(mode: UpdateCheckMode) {
  if (!downloadedPendingKey) return false;
  if (await isDeferred(downloadedPendingKey, mode)) return true;
  pendingOtaReleaseKey = downloadedPendingKey;
  emitUpdateUi({
    kind: "ota",
    phase: "ready",
    progress: 100,
    releaseKey: downloadedPendingKey,
    message: "Update downloaded",
    detail: "100% downloaded and verified. Keep using OnCampus, or restart now when you are ready to apply it.",
  });
  return true;
}

async function checkForOtaUpdate(mode: UpdateCheckMode): Promise<boolean> {
  if (Platform.OS !== "android" || !Updates.isEnabled) return false;
  if (await showDownloadedPending(mode)) return true;

  const serverId = await serverOtaId(mode === "manual");
  if (!serverId || serverId === currentUpdateId()) return false;
  const releaseKey = `ota:${serverId}`;

  void prefetchLatestOta(true).catch(() => undefined);
  if (await isDeferred(releaseKey, mode)) return true;

  pendingOtaReleaseKey = releaseKey;
  emitUpdateUi({
    kind: "ota",
    phase: "available",
    progress: 0,
    releaseKey,
    message: "A new OnCampus update is ready",
    detail: "Download starts automatically in the background. You can keep using OnCampus and choose when to restart after it reaches 100%.",
  });
  return true;
}

async function markOtaApply(releaseKey: string) {
  const marker: PendingOtaMarker = {
    beforeUpdateId: currentUpdateId(),
    releaseKey,
    startedAt: Date.now(),
  };
  await AsyncStorage.setItem(PENDING_OTA_KEY, JSON.stringify(marker));
}

async function queueOtaApply(releaseKey: string) {
  await Promise.all([
    markOtaApply(releaseKey),
    AsyncStorage.setItem(APPLY_OTA_ON_RESUME_KEY, releaseKey),
  ]);
}

async function applyReadyOta(releaseKey: string) {
  if (Platform.OS !== "android" || !Updates.isEnabled) return false;
  if (AppState.currentState !== "active") {
    emitUpdateUi({
      kind: "ota",
      phase: "ready",
      progress: 100,
      releaseKey,
      message: "Update downloaded",
      detail: "Return to OnCampus and tap Restart to apply when the app is active.",
    });
    return false;
  }

  await clearDeferral(releaseKey);
  await queueOtaApply(releaseKey);
  emitUpdateUi({
    kind: "ota",
    phase: "installing",
    progress: 100,
    releaseKey,
    message: "Applying update",
    detail: "The update is fully downloaded. OnCampus will restart once to switch to the new version.",
  });
  await new Promise((resolve) => setTimeout(resolve, 250));

  try {
    await Updates.reloadAsync();
    return true;
  } catch (expoReloadError) {
    if (nativeInstaller?.restartForOta) {
      try {
        await nativeInstaller.restartForOta();
        return true;
      } catch (nativeRestartError) {
        await Promise.all([
          AsyncStorage.removeItem(APPLY_OTA_ON_RESUME_KEY),
          AsyncStorage.removeItem(PENDING_OTA_KEY),
        ]).catch(() => undefined);
        emitUpdateUi({
          kind: "ota",
          phase: "error",
          progress: 100,
          releaseKey,
          message: "Update downloaded safely",
          detail: nativeRestartError instanceof Error
            ? "Restart could not start: " + nativeRestartError.message.slice(0, 140) + ". Close OnCampus completely and reopen it to apply the downloaded update."
            : "Close OnCampus completely and reopen it to apply the downloaded update.",
        });
        return false;
      }
    }

    await Promise.all([
      AsyncStorage.removeItem(APPLY_OTA_ON_RESUME_KEY),
      AsyncStorage.removeItem(PENDING_OTA_KEY),
    ]).catch(() => undefined);
    emitUpdateUi({
      kind: "ota",
      phase: "error",
      progress: 100,
      releaseKey,
      message: "Update downloaded safely",
      detail: expoReloadError instanceof Error
        ? "Automatic restart is unavailable: " + expoReloadError.message.slice(0, 140) + ". Close OnCampus completely and reopen it to apply the update."
        : "Close OnCampus completely and reopen it to apply the update.",
    });
    return false;
  }
}

async function downloadOtaUpdate(releaseKey: string) {
  await clearDeferral(releaseKey);
  pendingOtaReleaseKey = releaseKey;

  emitUpdateUi({
    kind: "ota",
    phase: "downloading",
    progress: 1,
    releaseKey,
    message: "Downloading update",
    detail: "Starting the signed update download…",
  });

  try {
    const ready = Boolean(downloadedPendingKey) || await prefetchLatestOta(true);
    if (!ready) {
      const serverId = await serverOtaId();
      if (!serverId || serverId === currentUpdateId()) {
        emitUpdateUi({
          kind: "ota",
          phase: "current",
          progress: 100,
          message: "Already up to date",
          detail: "There is no newer signed update for this installation.",
        });
        return;
      }

      emitUpdateUi({
        kind: "ota",
        phase: "error",
        progress: 0,
        releaseKey,
        message: "Download paused",
        detail: "The update is still available. Check your connection and tap Try again; background retry remains scheduled.",
      });
      return;
    }

    downloadedPendingKey = releaseKey;
    pendingOtaReleaseKey = releaseKey;
    emitUpdateUi({
      kind: "ota",
      phase: "ready",
      progress: 100,
      releaseKey,
      message: "Update downloaded",
      detail: "100% downloaded and verified. Tap Restart to apply when you are ready—OnCampus will not close itself automatically.",
    });
  } catch (error) {
    emitUpdateUi({
      kind: "ota",
      phase: "error",
      progress: 0,
      releaseKey,
      message: "Update download paused",
      detail: error instanceof Error ? error.message.slice(0, 180) : "Check your connection and try again.",
    });
  }
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
    if (mode === "manual") {
      emitUpdateUi({ kind: "ota", phase: "current", progress: 100, message: "You’re up to date", detail: `OnCampus ${installed} has no newer compatible OTA or Android release right now.` });
    }
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
  const notes = String(release.notes || "").trim().slice(0, 420);
  const size = release.size && release.size > 0 ? ` ${(release.size / 1024 / 1024).toFixed(1)} MB download.` : "";
  emitUpdateUi({
    kind: "apk",
    phase: "available",
    progress: 0,
    releaseKey,
    force,
    message: force ? "Android update required" : `OnCampus ${latest} is available`,
    detail: `${notes || "This release includes native improvements that require an APK update."}${size}`,
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
  emitUpdateUi({ kind: "apk", phase: "downloading", progress: 1, releaseKey, message: "Preparing Android update", detail: "Downloading through the trusted OnCampus update endpoint and verifying SHA-256 before install." });
  try {
    const result = await nativeInstaller.startInstall(release.apkUrl, release.sha256);
    if (result?.status === "permission_required") {
      emitUpdateUi({ kind: "apk", phase: "permission", progress: 0, releaseKey, message: "Allow OnCampus to install updates", detail: "Enable “Allow from this source”, then return. The verified installation will continue safely." });
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
    if (mode === "manual") emitUpdateUi({ kind: "ota", phase: "checking", progress: 10, message: "Checking for updates", detail: "Looking for a signed OTA first, then a verified Android release." });
    try {
      const otaAvailable = await checkForOtaUpdate(mode);
      if (otaAvailable) return;
      await checkForNativeUpdate(mode);
    } catch (error) {
      if (mode === "manual") {
        emitUpdateUi({ kind: "ota", phase: "error", progress: 0, message: "Couldn’t complete the update check", detail: error instanceof Error ? error.message.slice(0, 180) : "Check your connection and try again." });
      } else {
        emitUpdateUi(INITIAL_UI);
      }
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
  const ready = state.phase === "ready";
  const error = state.phase === "error";
  const terminal = state.phase === "current" || state.phase === "applied";
  const permission = state.phase === "permission";

  const label = useMemo(() => {
    if (state.phase === "checking") return "SECURE CHECK";
    if (state.phase === "available") return state.kind === "ota" ? "OTA AVAILABLE" : "ANDROID RELEASE";
    if (state.phase === "downloading") return "DOWNLOADING";
    if (state.phase === "ready") return "READY TO APPLY";
    if (state.phase === "verifying") return "VERIFYING";
    if (state.phase === "installing") return state.kind === "ota" ? "APPLYING UPDATE" : "ANDROID INSTALLER";
    if (state.phase === "permission") return "PERMISSION NEEDED";
    if (state.phase === "applied") return "UPDATED";
    if (state.phase === "current") return "CURRENT";
    return "ATTENTION";
  }, [state.kind, state.phase]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => { if (!busy && !state.force) onClose(); }}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, shadowColor: colors.shadow }]} accessible accessibilityViewIsModal>
          <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.topGlow} />
          <View style={styles.brandRow}>
            <Image source={APP_ICON} style={styles.logo} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.brand, { color: colors.onSurface }]}>OnCampus</Text>
              <Text style={[styles.phase, { color: state.phase === "error" ? colors.error : terminal ? colors.success : colors.info }]}>{label}</Text>
            </View>
            {busy ? <ActivityIndicator color={colors.brandPrimary} accessibilityLabel="Update in progress" /> : null}
          </View>

          <Text style={[styles.title, { color: colors.onSurface }]} accessibilityRole="header">{state.message}</Text>
          {!!state.detail && <Text style={[styles.detail, { color: colors.onSurfaceTertiary }]}>{state.detail}</Text>}

          {busy && state.phase !== "checking" && (
            <>
              <View style={[styles.progressTrack, { backgroundColor: colors.surfaceTertiary }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: state.progress }}>
                <View style={[styles.progressFill, { width: (String(Math.max(2, Math.min(100, state.progress || 2))) + "%") as `${number}%`, backgroundColor: state.kind === "apk" ? colors.actionPrimary : colors.brandPrimary }]} />
              </View>
              <View style={styles.progressMeta}>
                <Text style={[styles.progressValue, { color: colors.onSurface }]}>{Math.round(state.progress)}%</Text>
                <Text style={[styles.progressLabel, { color: colors.onSurfaceTertiary }]}>{state.phase === "downloading" ? "Downloaded" : state.phase === "verifying" ? "Verifying" : "Applying"}</Text>
              </View>
            </>
          )}

          <View style={[styles.securityRow, { backgroundColor: colors.highlight }]}>
            <View style={[styles.securityIcon, { backgroundColor: colors.surfaceSecondary }]}><Text style={{ color: colors.success, fontWeight: "900" }}>✓</Text></View>
            <Text style={[styles.securityText, { color: colors.onSurfaceTertiary }]}>{state.kind === "apk" ? "Trusted endpoint • SHA-256 verified • signing continuity" : "Signed manifest • runtime verified • safe rollback"}</Text>
          </View>

          {available && (
            <View style={styles.actions}>
              {!state.force && <Pressable style={[styles.secondaryButton, { borderColor: colors.borderStrong }]} onPress={onLater} accessibilityRole="button"><Text style={[styles.secondaryText, { color: colors.onSurface }]}>Later</Text></Pressable>}
              <Pressable style={[styles.primaryButton, { backgroundColor: colors.brandPrimary }]} onPress={onUpdateNow} accessibilityRole="button"><Text style={{ color: colors.onBrandPrimary, fontWeight: "800", fontSize: 14 }}>{state.kind === "ota" ? "Download update" : "Download & install"}</Text></Pressable>
            </View>
          )}

          {ready && (
            <View style={styles.actions}>
              {!state.force && <Pressable style={[styles.secondaryButton, { borderColor: colors.borderStrong }]} onPress={onLater} accessibilityRole="button"><Text style={[styles.secondaryText, { color: colors.onSurface }]}>Later</Text></Pressable>}
              <Pressable style={[styles.primaryButton, { backgroundColor: colors.brandPrimary }]} onPress={onUpdateNow} accessibilityRole="button"><Text style={{ color: colors.onBrandPrimary, fontWeight: "800", fontSize: 14 }}>Restart to apply</Text></Pressable>
            </View>
          )}

          {(terminal || permission) && (
            <View style={styles.actions}>
              <Pressable style={[styles.primaryButton, { backgroundColor: terminal ? colors.onSurface : colors.brandPrimary }]} onPress={onClose} accessibilityRole="button"><Text style={{ color: terminal ? colors.surface : colors.onBrandPrimary, fontWeight: "900", fontSize: 14 }}>{permission ? "I’ll return after allowing" : "Done"}</Text></Pressable>
            </View>
          )}

          {error && (
            <View style={styles.actions}>
              <Pressable style={[styles.secondaryButton, { borderColor: colors.borderStrong }]} onPress={onClose} accessibilityRole="button"><Text style={[styles.secondaryText, { color: colors.onSurface }]}>Close</Text></Pressable>
              <Pressable style={[styles.primaryButton, { backgroundColor: colors.brandPrimary }]} onPress={onRetry} accessibilityRole="button"><Text style={{ color: colors.onBrandPrimary, fontWeight: "900", fontSize: 14 }}>Try again</Text></Pressable>
            </View>
          )}

          {busy && (
            <Text style={[styles.keepOpen, { color: colors.muted }]}>
              {state.kind === "ota"
                ? "You can minimize OnCampus while the signed update downloads. It will never restart the app until you choose Restart to apply."
                : "You can minimize OnCampus while Android downloads the APK. After SHA-256 verification, Android's system installer will open when the app is active."}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function AppUpdateGate() {
  const [updateUi, setUpdateUi] = useState<UpdateUiState>(INITIAL_UI);
  const { isUpdatePending, downloadedUpdate, isDownloading, downloadProgress, downloadError } = Updates.useUpdates();

  useEffect(() => {
    updateUiListener = setUpdateUi;
    return () => {
      if (updateUiListener === setUpdateUi) updateUiListener = null;
    };
  }, []);

  useEffect(() => {
    if (!isDownloading) return;
    const fraction = Number.isFinite(downloadProgress) ? Number(downloadProgress) : 0;
    const percent = Math.max(1, Math.min(99, Math.round(fraction * 100)));
    setUpdateUi((previous) => {
      if (previous.kind !== "ota" || !["available", "downloading"].includes(previous.phase)) return previous;
      return {
        ...previous,
        phase: "downloading",
        progress: percent,
        message: "Downloading update",
        detail: String(percent) + "% downloaded • signed content is being verified as it arrives.",
      };
    });
  }, [downloadProgress, isDownloading]);

  useEffect(() => {
    if (!downloadError) return;
    setUpdateUi((previous) => {
      if (previous.kind !== "ota" || previous.phase !== "downloading") return previous;
      return {
        ...previous,
        phase: "error",
        message: "Update download paused",
        detail: "The signed update did not finish. Tap Try again; your current app remains unchanged.",
      };
    });
  }, [downloadError]);

  useEffect(() => {
    if (Platform.OS !== "android" || !Updates.isEnabled || !isUpdatePending) {
      downloadedPendingKey = null;
      return;
    }
    downloadedPendingKey = "ota:" + String(downloadedUpdate?.updateId || currentRuntime() || "pending");
    pendingOtaReleaseKey = downloadedPendingKey;
    void showDownloadedPending("automatic");
  }, [downloadedUpdate?.updateId, isUpdatePending]);

  useEffect(() => {
    if (!nativeInstaller) return;
    const emitter = new NativeEventEmitter(nativeInstaller as never);
    const subscription = emitter.addListener("OnCampusApkInstall", (event: { phase?: UpdatePhase; progress?: number; message?: string; detail?: string }) => {
      const phase = event.phase || "error";
      setUpdateUi({
        kind: "apk",
        phase,
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
      timer = setTimeout(() => { void checkForAppUpdate("automatic"); }, 900);
    };
    void initialize();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void checkForAppUpdate("automatic");
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
      void Promise.all([
        AsyncStorage.removeItem(APPLY_OTA_ON_RESUME_KEY),
        AsyncStorage.removeItem(PENDING_OTA_KEY),
      ]).catch(() => undefined);
    }
    void deferUpdate(key).finally(close);
  };
  const updateNow = () => {
    if (updateUi.kind === "ota") {
      const key = updateUi.releaseKey || pendingOtaReleaseKey || downloadedPendingKey || ("ota:" + currentRuntime());
      if (updateUi.phase === "ready" || isUpdatePending) {
        void applyReadyOta(key);
      } else {
        void downloadOtaUpdate(key);
      }
      return;
    }
    if (pendingNativeRelease) void startNativeInstall(pendingNativeRelease);
  };

  return <UpdateModal state={updateUi} onClose={close} onLater={later} onUpdateNow={updateNow} onRetry={() => { close(); void checkForAppUpdate("manual", true, true); }} />;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", paddingHorizontal: 20 },
  card: { borderRadius: 28, padding: 22, borderWidth: 1, overflow: "hidden", shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 16 },
  topGlow: { position: "absolute", left: 0, right: 0, top: 0, height: 5 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 44, height: 44, borderRadius: 14 },
  brand: { fontSize: 17, fontWeight: "900" },
  phase: { marginTop: 2, fontSize: 9, fontWeight: "900", letterSpacing: 1.25 },
  title: { marginTop: 22, fontSize: 23, lineHeight: 29, fontWeight: "900", letterSpacing: -0.4 },
  detail: { marginTop: 8, fontSize: 14, lineHeight: 21 },
  progressTrack: { height: 9, borderRadius: 7, marginTop: 22, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 7 },
  progressMeta: { marginTop: 8, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  progressValue: { fontSize: 14, fontWeight: "800", fontVariant: ["tabular-nums"] },
  progressLabel: { fontSize: 11, fontWeight: "600" },
  securityRow: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 9, borderRadius: radius.md, padding: spacing.md },
  securityIcon: { width: 24, height: 24, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  securityText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: "600" },
  actions: { marginTop: 24, flexDirection: "row", gap: 10 },
  secondaryButton: { flex: 1, height: 50, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontWeight: "800", fontSize: 14 },
  primaryButton: { flex: 1.35, height: 50, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  keepOpen: { marginTop: 16, textAlign: "center", fontSize: 11, fontWeight: "600" },
});