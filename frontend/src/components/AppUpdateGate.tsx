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
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/colors";

const API_BASE = "https://oncampus-backend-production.up.railway.app/v1";
const UPDATE_V2_API = `${API_BASE}/updates/v2/latest`;
const TRUSTED_APK_PREFIX = `${API_BASE}/updates/v2/apk/`;
const TELEMETRY_API = `${API_BASE}/updates/v2/telemetry`;
const AUTH_KEY_ID = "oncampus-main";
const AUTH_ALGORITHM = "rsa-v1_5-sha256";
const AUTOMATIC_CHECK_INTERVAL_MS = 60 * 1000;
const DEFER_MS = 6 * 60 * 60 * 1000;
const DEFER_KEY = "oncampus.update.v2.defer";
const APP_ICON = require("../../assets/images/icon.png");

let lastAutomaticCheckAt = 0;
let activeCheck: Promise<void> | null = null;
let updateUiListener: ((state: UpdateUiState) => void) | null = null;
let pendingRelease: NativeRelease | null = null;
let pendingTraceId: string | null = null;

type ReleaseAuthorization = {
  keyId?: string;
  algorithm?: string;
  signature?: string;
};

type NativeRelease = {
  schemaVersion?: number;
  transport?: string;
  available?: boolean;
  version?: string;
  versionCode?: number;
  name?: string;
  notes?: string;
  minVersion?: string;
  forceUpdate?: boolean;
  sha256?: string;
  size?: number;
  apkUrl?: string;
  telemetryUrl?: string;
  authorization?: ReleaseAuthorization;
};

type NativeStatus = {
  phase?: string;
  progress?: number;
  traceId?: string;
  targetVersion?: string;
  targetVersionCode?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  errorCode?: string;
  message?: string;
  detail?: string;
};

type NativeInstaller = {
  startInstall: (
    url: string,
    sha256: string,
    targetVersionCode: number,
    targetVersion: string,
    expectedSize: number,
    authorizationKeyId: string,
    authorizationAlgorithm: string,
    authorizationSignature: string,
    traceId: string,
  ) => Promise<NativeStatus>;
  getStatus: () => Promise<NativeStatus>;
  addListener: (eventName: string) => void;
  removeListeners: (count: number) => void;
};

export type UpdateCheckMode = "automatic" | "manual" | "campaign";
type UpdatePhase = "hidden" | "checking" | "available" | "downloading" | "verifying" | "ready" | "installing" | "permission" | "current" | "applied" | "error";

type UpdateUiState = {
  phase: UpdatePhase;
  progress: number;
  message: string;
  detail?: string;
  releaseKey?: string;
  force?: boolean;
  bytesDownloaded?: number;
  bytesTotal?: number;
  traceId?: string;
  errorCode?: string;
};

type DeferredUpdate = { key: string; until: number };

const INITIAL_UI: UpdateUiState = { phase: "hidden", progress: 0, message: "" };
const nativeInstaller = NativeModules.OnCampusApkInstaller as NativeInstaller | undefined;

function emitUpdateUi(state: UpdateUiState) {
  updateUiListener?.(state);
}

function normalizeVersion(value?: string | null) {
  return String(value || "0.0.0").trim().replace(/^v/i, "").split("-")[0];
}

function versionParts(value: string) {
  return normalizeVersion(value).split(".").slice(0, 3).map((part) => {
    const parsed = Number.parseInt(part.replace(/\D/g, ""), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  });
}

function compareVersions(left: string, right: string) {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] || 0) > (b[index] || 0)) return 1;
    if ((a[index] || 0) < (b[index] || 0)) return -1;
  }
  return 0;
}

function currentVersion() {
  return normalizeVersion(Constants.expoConfig?.version);
}

function traceId() {
  return `ota2-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function trustedRelease(release: NativeRelease) {
  const version = normalizeVersion(release.version);
  const signature = String(release.authorization?.signature || "");
  return Boolean(
    release.schemaVersion === 2 &&
    release.transport === "native-apk" &&
    release.available &&
    /^\d+\.\d+\.\d+$/.test(version) &&
    Number.isInteger(release.versionCode) && Number(release.versionCode) > 0 &&
    Number.isInteger(release.size) && Number(release.size) >= 1024 * 1024 &&
    /^[a-fA-F0-9]{64}$/.test(String(release.sha256 || "")) &&
    release.apkUrl === `${TRUSTED_APK_PREFIX}${version}` &&
    (!release.telemetryUrl || release.telemetryUrl === TELEMETRY_API) &&
    release.authorization?.keyId === AUTH_KEY_ID &&
    release.authorization?.algorithm === AUTH_ALGORITHM &&
    signature.length >= 64 && signature.length <= 2048 &&
    /^[A-Za-z0-9+/=]+$/.test(signature)
  );
}

async function postTelemetry(stage: string, values: Partial<NativeStatus> = {}) {
  const id = values.traceId || pendingTraceId;
  if (!id) return;
  const acceptedStages = new Set([
    "check", "available", "download_start", "downloading", "download_complete",
    "verify_hash", "verify_package", "verify_signature", "ready",
    "installer_opened", "installed", "error",
  ]);
  if (!acceptedStages.has(stage)) return;
  try {
    await fetch(TELEMETRY_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        traceId: id,
        stage,
        nativeVersion: currentVersion(),
        targetVersion: values.targetVersion || pendingRelease?.version || undefined,
        progress: Number.isFinite(values.progress) ? Math.max(0, Math.min(100, Number(values.progress))) : undefined,
        errorCode: values.errorCode || undefined,
        detail: values.detail?.slice(0, 500),
      }),
    });
  } catch {
    // Telemetry must never block or weaken update delivery.
  }
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

async function isDeferred(key: string, mode: UpdateCheckMode, force: boolean) {
  if (mode === "manual" || force) return false;
  const deferred = await readDeferred();
  return deferred?.key === key;
}

async function deferUpdate(key?: string) {
  if (!key) return;
  await AsyncStorage.setItem(DEFER_KEY, JSON.stringify({ key, until: Date.now() + DEFER_MS } satisfies DeferredUpdate)).catch(() => undefined);
}

async function clearDeferral() {
  await AsyncStorage.removeItem(DEFER_KEY).catch(() => undefined);
}

async function fetchRelease(strict = false): Promise<NativeRelease | null> {
  try {
    const url = new URL(UPDATE_V2_API);
    url.searchParams.set("currentVersion", currentVersion());
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    });
    if (!response.ok) throw new Error(`Update service returned ${response.status}`);
    return await response.json() as NativeRelease;
  } catch (error) {
    if (strict) throw error;
    return null;
  }
}

function releaseUi(release: NativeRelease, mode: UpdateCheckMode) {
  const version = normalizeVersion(release.version);
  const force = Boolean(release.forceUpdate) || compareVersions(currentVersion(), normalizeVersion(release.minVersion)) < 0;
  const releaseKey = `apk-v2:${version}`;
  pendingRelease = release;
  pendingTraceId = traceId();
  void postTelemetry("available", {
    traceId: pendingTraceId,
    targetVersion: version,
    detail: `Update Engine v2 offered RSA-authorized OnCampus ${version} during ${mode} check`,
  });
  const size = release.size && release.size > 0 ? ` ${(release.size / 1024 / 1024).toFixed(1)} MB.` : "";
  emitUpdateUi({
    phase: "available",
    progress: 0,
    releaseKey,
    force,
    traceId: pendingTraceId,
    message: force ? "OnCampus update required" : `OnCampus ${version} is ready`,
    detail: `${String(release.notes || "Secure Android update available.").trim().slice(0, 420)}${size}`,
  });
}

async function recoverNativeStatus() {
  if (Platform.OS !== "android" || !nativeInstaller?.getStatus) return false;
  try {
    const status = await nativeInstaller.getStatus();
    if (!status?.phase || status.phase === "idle") return false;
    pendingTraceId = status.traceId || pendingTraceId;
    const releaseKey = status.targetVersion ? `apk-v2:${status.targetVersion}` : undefined;
    if (status.phase === "installed") {
      emitUpdateUi({ phase: "applied", progress: 100, releaseKey, traceId: status.traceId, message: "Update complete", detail: `OnCampus ${status.targetVersion || ""} is installed and verified.` });
      void postTelemetry("installed", status);
      return true;
    }
    if (status.phase === "ready") {
      emitUpdateUi({ phase: "ready", progress: 100, releaseKey, traceId: status.traceId, message: "Update verified", detail: "The APK passed release authorization, hash, package, version and signing-certificate checks. Tap Install update to open Android's installer." });
      return true;
    }
    if (status.phase === "verifying") {
      emitUpdateUi({ phase: "verifying", progress: 100, releaseKey, traceId: status.traceId, message: "Verifying update", detail: "OnCampus is validating the downloaded APK before Android can install it." });
      return true;
    }
    if (status.phase === "error") {
      emitUpdateUi({ phase: "error", progress: 0, releaseKey, traceId: status.traceId, errorCode: status.errorCode, message: "Update needs attention", detail: `Android reported ${status.errorCode || "a download error"}. The installed app is unchanged.` });
      return true;
    }
    emitUpdateUi({
      phase: "downloading",
      progress: Math.max(1, Number(status.progress || 1)),
      releaseKey,
      traceId: status.traceId,
      message: "Downloading OnCampus update",
      detail: "Android is continuing the update in the background. It can resume after network or app interruptions.",
      bytesDownloaded: status.downloadedBytes,
      bytesTotal: status.totalBytes,
    });
    return true;
  } catch {
    return false;
  }
}

async function startNativeUpdate(release?: NativeRelease | null, existingTraceId?: string | null) {
  const latest = release && trustedRelease(release) ? release : await fetchRelease(true);
  if (!latest || !trustedRelease(latest) || !nativeInstaller?.startInstall) {
    emitUpdateUi({ phase: "error", progress: 0, message: "Secure updater unavailable", detail: "Update Engine v2 could not validate RSA-authorized release metadata. The installed app is unchanged." });
    return;
  }

  pendingRelease = latest;
  const version = normalizeVersion(latest.version);
  const id = existingTraceId || pendingTraceId || traceId();
  pendingTraceId = id;
  await clearDeferral();
  emitUpdateUi({
    phase: "downloading",
    progress: 1,
    releaseKey: `apk-v2:${version}`,
    traceId: id,
    force: Boolean(latest.forceUpdate),
    message: "Preparing secure update",
    detail: "Android first verifies the production RSA release authorization, then downloads through OnCampus and checks SHA-256, package identity, versionCode and the app signing certificate.",
  });
  void postTelemetry("download_start", { traceId: id, targetVersion: version, progress: 1 });

  try {
    await nativeInstaller.startInstall(
      String(latest.apkUrl),
      String(latest.sha256),
      Number(latest.versionCode),
      version,
      Number(latest.size),
      String(latest.authorization?.keyId),
      String(latest.authorization?.algorithm),
      String(latest.authorization?.signature),
      id,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 300) : "Android could not start the update transfer.";
    emitUpdateUi({ phase: "error", progress: 0, releaseKey: `apk-v2:${version}`, traceId: id, errorCode: "START_FAILED", message: "Update could not start", detail: `${detail} Your installed app is unchanged.` });
    void postTelemetry("error", { traceId: id, targetVersion: version, errorCode: "START_FAILED", detail });
  }
}

export async function checkForAppUpdate(
  modeOrManual: UpdateCheckMode | boolean = "automatic",
  _bypassNativeThrottle = false,
  _bypassOtaThrottle = false,
) {
  const mode: UpdateCheckMode = typeof modeOrManual === "boolean" ? (modeOrManual ? "manual" : "automatic") : modeOrManual;
  if (Platform.OS !== "android") {
    if (mode === "manual") emitUpdateUi({ phase: "current", progress: 100, message: "Updates are managed automatically", detail: "No Android update action is required on this platform." });
    return;
  }

  const now = Date.now();
  if (mode === "automatic" && now - lastAutomaticCheckAt < AUTOMATIC_CHECK_INTERVAL_MS) return;
  if (activeCheck) return activeCheck;
  if (mode === "automatic") lastAutomaticCheckAt = now;

  activeCheck = (async () => {
    if (mode === "manual") emitUpdateUi({ phase: "checking", progress: 10, message: "Checking for updates", detail: "Contacting OnCampus Update Engine v2…" });
    const id = traceId();
    pendingTraceId = id;
    void postTelemetry("check", { traceId: id, detail: `${mode} update check` });
    try {
      if (await recoverNativeStatus()) return;
      const release = await fetchRelease(mode === "manual");
      if (!release?.available || compareVersions(normalizeVersion(release.version), currentVersion()) <= 0) {
        if (mode === "manual") emitUpdateUi({ phase: "current", progress: 100, message: "You’re up to date", detail: `OnCampus ${currentVersion()} is the latest verified Android release.` });
        return;
      }
      if (!trustedRelease(release)) {
        if (mode === "manual") emitUpdateUi({ phase: "error", progress: 0, traceId: id, errorCode: "METADATA_INVALID", message: "Update metadata rejected", detail: "The release did not satisfy Update Engine v2 authorization and integrity requirements. Nothing was downloaded." });
        void postTelemetry("error", { traceId: id, errorCode: "METADATA_INVALID", detail: "Release metadata failed client authorization/integrity checks" });
        return;
      }
      const force = Boolean(release.forceUpdate) || compareVersions(currentVersion(), normalizeVersion(release.minVersion)) < 0;
      const key = `apk-v2:${normalizeVersion(release.version)}`;
      if (await isDeferred(key, mode, force)) return;
      releaseUi(release, mode);
    } catch (error) {
      if (mode === "manual") {
        const detail = error instanceof Error ? error.message.slice(0, 260) : "Could not reach the update service.";
        emitUpdateUi({ phase: "error", progress: 0, traceId: id, errorCode: "CHECK_FAILED", message: "Update check failed", detail: `${detail} The installed app is unchanged.` });
        void postTelemetry("error", { traceId: id, errorCode: "CHECK_FAILED", detail });
      }
    }
  })();

  try {
    await activeCheck;
  } finally {
    activeCheck = null;
  }
}

function formatBytes(value?: number) {
  if (!Number.isFinite(value) || Number(value) < 0) return "";
  const bytes = Number(value);
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function UpdateModal({ state, onClose, onLater, onPrimary }: {
  state: UpdateUiState;
  onClose: () => void;
  onLater: () => void;
  onPrimary: () => void;
}) {
  const { colors } = useTheme();
  const visible = state.phase !== "hidden";
  const busy = ["checking", "downloading", "verifying", "installing"].includes(state.phase);
  const actionable = ["available", "ready", "permission", "error"].includes(state.phase);
  const terminal = ["current", "applied"].includes(state.phase);
  const stages = ["Check", "Download", "Verify", "Install"];
  const stageIndex = useMemo(() => {
    if (["checking", "current"].includes(state.phase)) return 0;
    if (["available", "downloading"].includes(state.phase)) return 1;
    if (state.phase === "verifying") return 2;
    if (["ready", "permission", "installing", "applied"].includes(state.phase)) return 3;
    if (state.phase === "error") return state.progress >= 100 ? 3 : state.progress > 0 ? 1 : 0;
    return 0;
  }, [state.phase, state.progress]);
  const label = state.phase === "error" ? "ATTENTION" : state.phase === "applied" ? "UPDATED" : state.phase === "current" ? "CURRENT" : "UPDATE ENGINE V2";
  const primaryLabel = state.phase === "ready" ? "Install update" : state.phase === "permission" ? "Open settings" : state.phase === "error" ? "Try again" : "Download update";
  const transferred = state.bytesDownloaded != null && state.bytesTotal
    ? `${formatBytes(state.bytesDownloaded)} / ${formatBytes(state.bytesTotal)}`
    : "";

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => { if (!state.force) onClose(); }}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, shadowColor: colors.shadow }]} accessible accessibilityViewIsModal>
          <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.topGlow} />
          <View style={styles.brandRow}>
            <Image source={APP_ICON} style={styles.logo} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.brand, { color: colors.onSurface }]}>OnCampus</Text>
              <Text style={[styles.phase, { color: state.phase === "error" ? colors.error : terminal ? colors.success : colors.info }]}>{label}</Text>
            </View>
            {busy ? <ActivityIndicator color={colors.brandPrimary} /> : null}
          </View>

          <Text style={[styles.title, { color: colors.onSurface }]} accessibilityRole="header">{state.message}</Text>
          {state.detail ? <Text style={[styles.detail, { color: colors.muted }]}>{state.detail}</Text> : null}

          <View style={styles.steps}>
            {stages.map((stage, index) => (
              <View key={stage} style={styles.stepItem}>
                <View style={[styles.stepDot, { backgroundColor: index <= stageIndex ? colors.brandPrimary : colors.border }]} />
                <Text style={[styles.stepText, { color: index <= stageIndex ? colors.onSurface : colors.muted }]}>{stage}</Text>
              </View>
            ))}
          </View>

          {state.phase === "downloading" ? (
            <View style={styles.progressWrap}>
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.progressFill, { backgroundColor: colors.brandPrimary, width: `${Math.max(1, Math.min(100, state.progress))}%` }]} />
              </View>
              <View style={styles.progressMeta}>
                <Text style={[styles.progressText, { color: colors.onSurface }]}>{Math.round(state.progress)}%</Text>
                <Text style={[styles.progressBytes, { color: colors.muted }]}>{transferred || "Android background download"}</Text>
              </View>
            </View>
          ) : null}

          {state.errorCode ? <Text style={[styles.errorCode, { color: colors.muted }]}>Code: {state.errorCode}</Text> : null}

          <View style={styles.actions}>
            {terminal ? (
              <Pressable style={[styles.primaryButton, { backgroundColor: colors.brandPrimary }]} onPress={onClose} accessibilityRole="button">
                <Text style={[styles.primaryText, { color: colors.onBrandPrimary }]}>Done</Text>
              </Pressable>
            ) : null}
            {actionable ? (
              <Pressable style={[styles.primaryButton, { backgroundColor: colors.brandPrimary }]} onPress={onPrimary} accessibilityRole="button">
                <Text style={[styles.primaryText, { color: colors.onBrandPrimary }]}>{primaryLabel}</Text>
              </Pressable>
            ) : null}
            {!state.force && (state.phase === "available" || state.phase === "error") ? (
              <Pressable style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={onLater} accessibilityRole="button">
                <Text style={[styles.secondaryText, { color: colors.onSurface }]}>Later</Text>
              </Pressable>
            ) : null}
            {!state.force && state.phase === "downloading" ? (
              <Pressable style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={onClose} accessibilityRole="button">
                <Text style={[styles.secondaryText, { color: colors.onSurface }]}>Continue in background</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function AppUpdateGate() {
  const [state, setState] = useState<UpdateUiState>(INITIAL_UI);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    updateUiListener = setState;
    const emitter = nativeInstaller ? new NativeEventEmitter(NativeModules.OnCampusApkInstaller) : null;
    const subscription = emitter?.addListener("OnCampusApkInstall", (event: NativeStatus) => {
      pendingTraceId = event.traceId || pendingTraceId;
      const phase = String(event.phase || "");
      void postTelemetry(phase, event);
      if (phase === "downloading" || phase === "download_complete") {
        setState({
          phase: phase === "downloading" ? "downloading" : "verifying",
          progress: Math.max(1, Number(event.progress || 1)),
          releaseKey: event.targetVersion ? `apk-v2:${event.targetVersion}` : undefined,
          traceId: event.traceId,
          message: event.message || (phase === "downloading" ? "Downloading OnCampus update" : "Download complete"),
          detail: event.detail,
          bytesDownloaded: event.downloadedBytes,
          bytesTotal: event.totalBytes,
        });
        return;
      }
      if (["verify_hash", "verify_package", "verify_signature"].includes(phase)) {
        setState({ phase: "verifying", progress: 100, releaseKey: event.targetVersion ? `apk-v2:${event.targetVersion}` : undefined, traceId: event.traceId, message: event.message || "Verifying update", detail: event.detail });
        return;
      }
      if (phase === "ready") {
        setState({ phase: "ready", progress: 100, releaseKey: event.targetVersion ? `apk-v2:${event.targetVersion}` : undefined, traceId: event.traceId, message: event.message || "Update verified", detail: event.detail });
        return;
      }
      if (phase === "permission") {
        setState({ phase: "permission", progress: 100, releaseKey: event.targetVersion ? `apk-v2:${event.targetVersion}` : undefined, traceId: event.traceId, message: event.message || "Permission needed", detail: event.detail });
        return;
      }
      if (phase === "installer_opened") {
        setState({ phase: "installing", progress: 100, releaseKey: event.targetVersion ? `apk-v2:${event.targetVersion}` : undefined, traceId: event.traceId, message: event.message || "Android installer opened", detail: event.detail });
        return;
      }
      if (phase === "installed") {
        setState({ phase: "applied", progress: 100, releaseKey: event.targetVersion ? `apk-v2:${event.targetVersion}` : undefined, traceId: event.traceId, message: event.message || "Update complete", detail: event.detail });
        return;
      }
      if (phase === "error") {
        setState({ phase: "error", progress: Number(event.progress || 0), releaseKey: event.targetVersion ? `apk-v2:${event.targetVersion}` : undefined, traceId: event.traceId, errorCode: event.errorCode, message: event.message || "Update needs attention", detail: event.detail || "The installed app is unchanged." });
      }
    });

    void recoverNativeStatus().then((recovered) => { if (!recovered) void checkForAppUpdate("automatic"); });
    const appState = AppState.addEventListener("change", (next) => {
      if (next === "active") void recoverNativeStatus().then((recovered) => { if (!recovered) void checkForAppUpdate("automatic"); });
    });

    return () => {
      subscription?.remove();
      appState.remove();
      if (updateUiListener === setState) updateUiListener = null;
    };
  }, []);

  const close = () => setState(INITIAL_UI);
  const later = async () => {
    await deferUpdate(state.releaseKey);
    close();
  };
  const primary = async () => {
    if (state.phase === "error") {
      await checkForAppUpdate("manual");
      return;
    }
    await startNativeUpdate(pendingRelease, state.traceId || pendingTraceId);
  };

  return <UpdateModal state={state} onClose={close} onLater={() => { void later(); }} onPrimary={() => { void primary(); }} />;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", padding: spacing.lg },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.lg, overflow: "hidden", shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  topGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 4 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  logo: { width: 46, height: 46, borderRadius: 12 },
  brand: { fontSize: 17, fontWeight: "800" },
  phase: { fontSize: 11, fontWeight: "800", letterSpacing: 1.1, marginTop: 2 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "800" },
  detail: { fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  steps: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.lg, marginBottom: spacing.lg },
  stepItem: { alignItems: "center", flex: 1, gap: 6 },
  stepDot: { width: 8, height: 8, borderRadius: 4 },
  stepText: { fontSize: 11, fontWeight: "700" },
  progressWrap: { marginBottom: spacing.md },
  progressTrack: { height: 8, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
  progressMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 7 },
  progressText: { fontSize: 13, fontWeight: "800" },
  progressBytes: { fontSize: 12 },
  errorCode: { fontSize: 11, marginBottom: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  primaryButton: { minHeight: 48, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  primaryText: { fontSize: 15, fontWeight: "800" },
  secondaryButton: { minHeight: 46, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  secondaryText: { fontSize: 14, fontWeight: "700" },
});