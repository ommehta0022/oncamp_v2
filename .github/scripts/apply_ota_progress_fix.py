from pathlib import Path
import re

root = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (root / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (root / path).write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


app_path = "frontend/app.json"
app = read(app_path)
for old, new, label in [
    ('"version": "1.6.7"', '"version": "1.6.8"', "app version"),
    ('"runtimeVersion": "1.6.7"', '"runtimeVersion": "1.6.8"', "runtime version"),
    ('"versionCode": 10607', '"versionCode": 10608', "android versionCode"),
    ('"otaRuntimeVersion": "1.6.7"', '"otaRuntimeVersion": "1.6.8"', "extra runtime"),
]:
    app = replace_once(app, old, new, label)
write(app_path, app)

gradle_path = "frontend/android/app/build.gradle"
gradle = read(gradle_path)
gradle = replace_once(gradle, '?: "1.6.7"', '?: "1.6.8"', "gradle version")
gradle = replace_once(gradle, '?: "10607"', '?: "10608"', "gradle versionCode")
write(gradle_path, gradle)

strings_path = "frontend/android/app/src/main/res/values/strings.xml"
strings = read(strings_path)
strings = replace_once(strings, ">1.6.7</string>", ">1.6.8</string>", "native runtime string")
write(strings_path, strings)

gate_path = "frontend/src/components/AppUpdateGate.tsx"
gate = read(gate_path)

gate = replace_once(
    gate,
    "  releaseKey?: string;\n  force?: boolean;\n};",
    "  releaseKey?: string;\n  force?: boolean;\n  bytesDownloaded?: number;\n  bytesTotal?: number;\n  nextStep?: string;\n};",
    "update UI telemetry fields",
)

gate = replace_once(
    gate,
    "  void prefetchLatestOta(true).catch(() => undefined);\n  if (await isDeferred(releaseKey, mode)) return true;",
    "  // Discovery only announces the release. The explicit Download action owns\n"
    "  // the foreground transfer so progress belongs to the user-visible operation.\n"
    "  if (await isDeferred(releaseKey, mode)) return true;",
    "discovery prefetch race",
)

apply_re = re.compile(r"async function applyReadyOta\(releaseKey: string\) \{.*?\n\}\n\nasync function downloadOtaUpdate", re.S)
apply_new = '''async function applyReadyOta(releaseKey: string) {
  if (Platform.OS !== "android" || !Updates.isEnabled) return false;
  if (AppState.currentState !== "active") {
    emitUpdateUi({
      kind: "ota",
      phase: "ready",
      progress: 100,
      releaseKey,
      message: "Update downloaded",
      detail: "100% downloaded and verified. Return to OnCampus and restart when the app is active.",
      nextStep: "Restart OnCampus once to load the verified update.",
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
    detail: "The signed update is fully downloaded and verified. OnCampus is starting a clean Android restart now.",
    nextStep: "The app will reopen automatically on the new update.",
  });
  await new Promise((resolve) => setTimeout(resolve, 250));

  if (!nativeInstaller?.restartForOta) {
    emitUpdateUi({
      kind: "ota",
      phase: "error",
      progress: 100,
      releaseKey,
      message: "Update is ready — restart required",
      detail: "The update is safely stored, but this build cannot trigger the Android restart. Close OnCampus completely and reopen it; the downloaded update will load on cold start.",
      nextStep: "Close OnCampus completely, then open it again.",
    });
    return false;
  }

  try {
    await nativeInstaller.restartForOta();
    return true;
  } catch (error) {
    // Keep PENDING_OTA_KEY/APPLY_OTA_ON_RESUME_KEY intact. A manual cold start
    // must still be able to activate the already downloaded update.
    emitUpdateUi({
      kind: "ota",
      phase: "error",
      progress: 100,
      releaseKey,
      message: "Update is downloaded — restart again",
      detail: error instanceof Error
        ? `Android restart did not start: ${error.message.slice(0, 140)}. The update is still safe on this device.`
        : "Android restart did not start. The update is still safe on this device.",
      nextStep: "Close OnCampus completely and reopen it to finish applying the update.",
    });
    return false;
  }
}

async function downloadOtaUpdate'''
gate, count = apply_re.subn(apply_new, gate, count=1)
if count != 1:
    raise SystemExit(f"applyReadyOta: expected 1 block, found {count}")

gate = replace_once(
    gate,
    '    phase: "downloading",\n    progress: 1,\n    releaseKey,\n    message: "Downloading update",\n    detail: "Starting the signed update download…",',
    '    phase: "downloading",\n    progress: 0,\n    releaseKey,\n    message: "Downloading update",\n    detail: "Connecting to the signed production update…",\n    nextStep: "Download progress will appear live, then verification runs automatically.",',
    "initial OTA progress",
)

gate = replace_once(
    gate,
    '      } else {\n        emitUpdateUi(INITIAL_UI);\n      }',
    '      } else {\n        // Automatic checks never hide or replace an active update UI. A\n        // transient campaign/network failure is retried on the next poll/resume.\n      }',
    "automatic modal dismissal race",
)

gate = replace_once(
    gate,
    "function UpdateModal({ state, onClose, onLater, onUpdateNow, onRetry }: {",
    '''function formatBytes(value?: number) {
  if (!Number.isFinite(value) || Number(value) < 0) return "";
  const bytes = Number(value);
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function UpdateModal({ state, onClose, onLater, onUpdateNow, onRetry }: {''',
    "formatBytes helper",
)

gate = replace_once(
    gate,
    '  const permission = state.phase === "permission";\n',
    '''  const permission = state.phase === "permission";
  const stages = ["Check", "Download", "Verify", "Apply"];
  const stageIndex = useMemo(() => {
    if (["checking", "available", "current"].includes(state.phase)) return 0;
    if (state.phase === "downloading") return 1;
    if (["ready", "verifying", "permission"].includes(state.phase)) return 2;
    if (["installing", "applied"].includes(state.phase)) return 3;
    if (state.phase === "error") return state.progress >= 100 ? 2 : state.progress > 0 ? 1 : 0;
    return 0;
  }, [state.phase, state.progress]);
  const nextStep = useMemo(() => {
    if (state.nextStep) return state.nextStep;
    if (state.phase === "checking") return "If a compatible update exists, OnCampus will show it before downloading.";
    if (state.phase === "available") return "Tap Download update to start the signed transfer.";
    if (state.phase === "downloading") return "Verification starts automatically when the transfer reaches 100%.";
    if (state.phase === "verifying") return "After verification, Android will prepare the safe apply step.";
    if (state.phase === "ready") return "Restart once to switch to the downloaded update.";
    if (state.phase === "installing") return state.kind === "ota" ? "OnCampus will reopen on the new update." : "Confirm Install on Android's system screen.";
    if (state.phase === "permission") return "Allow installation from OnCampus, then return to continue.";
    if (state.phase === "error") return state.progress >= 100 ? "Close and reopen OnCampus to finish applying the stored update." : "Tap Try again; the current app remains unchanged.";
    return "No action is required.";
  }, [state.kind, state.nextStep, state.phase, state.progress]);
''',
    "stage state model",
)

gate = replace_once(
    gate,
    '          {!!state.detail && <Text style={[styles.detail, { color: colors.onSurfaceTertiary }]}>{state.detail}</Text>}\n',
    '''          {!!state.detail && <Text style={[styles.detail, { color: colors.onSurfaceTertiary }]}>{state.detail}</Text>}

          <View style={styles.stageRow} accessibilityLabel={`Update stage ${stages[Math.min(stageIndex, stages.length - 1)]}`}>
            {stages.map((stage, index) => {
              const done = index < stageIndex || state.phase === "applied";
              const active = index === stageIndex && state.phase !== "current";
              return (
                <View key={stage} style={styles.stageItem}>
                  <View style={[styles.stageDot, { backgroundColor: done || active ? colors.brandPrimary : colors.surfaceTertiary, borderColor: done || active ? colors.brandPrimary : colors.borderStrong }]}>
                    <Text style={[styles.stageNumber, { color: done || active ? colors.onBrandPrimary : colors.onSurfaceTertiary }]}>{done ? "✓" : String(index + 1)}</Text>
                  </View>
                  <Text style={[styles.stageName, { color: active ? colors.onSurface : colors.onSurfaceTertiary }]}>{stage}</Text>
                </View>
              );
            })}
          </View>
''',
    "progress stage UI",
)

gate = replace_once(
    gate,
    '          {busy && state.phase !== "checking" && (',
    '          {((busy && state.phase !== "checking") || ready) && (',
    "ready progress visibility",
)

gate = replace_once(
    gate,
    '<Text style={[styles.progressLabel, { color: colors.onSurfaceTertiary }]}>{state.phase === "downloading" ? "Downloaded" : state.phase === "verifying" ? "Verifying" : "Applying"}</Text>',
    '<Text style={[styles.progressLabel, { color: colors.onSurfaceTertiary }]}>{state.bytesTotal && state.bytesDownloaded !== undefined ? `${formatBytes(state.bytesDownloaded)} / ${formatBytes(state.bytesTotal)}` : state.phase === "downloading" ? "Live download progress" : state.phase === "ready" ? "Downloaded & verified" : state.phase === "verifying" ? "Verifying" : "Applying"}</Text>',
    "progress metadata",
)

gate = replace_once(
    gate,
    '''              </View>
            </>
          )}

          <View style={[styles.securityRow, { backgroundColor: colors.highlight }]}>
''',
    '''              </View>
            </>
          )}

          {!terminal && (
            <View style={[styles.nextCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Text style={[styles.nextLabel, { color: colors.onSurfaceTertiary }]}>NEXT</Text>
              <Text style={[styles.nextText, { color: colors.onSurface }]}>{nextStep}</Text>
            </View>
          )}

          <View style={[styles.securityRow, { backgroundColor: colors.highlight }]}>
''',
    "next step card",
)

progress_effect_re = re.compile(
    r'''  useEffect\(\(\) => \{\n    if \(!isDownloading\) return;\n    const fraction = Number\.isFinite\(downloadProgress\).*?\n  \}, \[downloadProgress, isDownloading\]\);''',
    re.S,
)
progress_effect_new = '''  useEffect(() => {
    if (!isDownloading) return;
    const fraction = Number.isFinite(downloadProgress) ? Number(downloadProgress) : 0;
    const percent = Math.max(0, Math.min(99, Math.round(fraction * 100)));
    setUpdateUi((previous) => {
      if (previous.kind !== "ota" || !["available", "downloading"].includes(previous.phase)) return previous;
      const nextPercent = Math.max(previous.progress || 0, percent);
      return {
        ...previous,
        phase: "downloading",
        progress: nextPercent,
        message: "Downloading update",
        detail: `${nextPercent}% downloaded • this is live Expo Updates transfer progress.`,
        nextStep: "Verification starts automatically at 100%, then you choose when to restart.",
      };
    });
  }, [downloadProgress, isDownloading]);'''
gate, count = progress_effect_re.subn(progress_effect_new, gate, count=1)
if count != 1:
    raise SystemExit(f"Expo progress effect: expected 1 block, found {count}")

error_effect_re = re.compile(
    r'''  useEffect\(\(\) => \{\n    if \(!downloadError\) return;.*?\n  \}, \[downloadError\]\);''',
    re.S,
)
error_effect_new = '''  useEffect(() => {
    if (!downloadError) return;
    setUpdateUi((previous) => {
      if (previous.kind !== "ota" || previous.phase !== "downloading") return previous;
      const at = Math.max(0, Math.min(99, previous.progress || 0));
      return {
        ...previous,
        phase: "error",
        progress: at,
        message: "Update download paused",
        detail: `Download paused at ${at}% before completion. The current app is unchanged and this message will stay open until you choose what to do.`,
        nextStep: "Tap Try again to resume/retry the signed update.",
      };
    });
  }, [downloadError]);'''
gate, count = error_effect_re.subn(error_effect_new, gate, count=1)
if count != 1:
    raise SystemExit(f"download error effect: expected 1 block, found {count}")

gate = replace_once(
    gate,
    'const subscription = emitter.addListener("OnCampusApkInstall", (event: { phase?: UpdatePhase; progress?: number; message?: string; detail?: string }) => {',
    'const subscription = emitter.addListener("OnCampusApkInstall", (event: { phase?: UpdatePhase; progress?: number; message?: string; detail?: string; downloadedBytes?: number; totalBytes?: number }) => {',
    "native progress event type",
)

gate = replace_once(
    gate,
    '        detail: event.detail,\n        releaseKey:',
    '        detail: event.detail,\n        bytesDownloaded: Number.isFinite(event.downloadedBytes) ? Number(event.downloadedBytes) : undefined,\n        bytesTotal: Number.isFinite(event.totalBytes) ? Number(event.totalBytes) : undefined,\n        nextStep: phase === "downloading" ? "Android verifies the APK at 100%, then opens the system installer." : undefined,\n        releaseKey:',
    "native byte telemetry",
)

gate = replace_once(
    gate,
    '  return <UpdateModal state={updateUi} onClose={close} onLater={later} onUpdateNow={updateNow} onRetry={() => { close(); void checkForAppUpdate("manual", true, true); }} />;',
    '''  const retry = () => {
    const key = updateUi.releaseKey || pendingOtaReleaseKey || downloadedPendingKey;
    if (updateUi.kind === "ota" && key?.startsWith("ota:")) {
      if (isUpdatePending || updateUi.progress >= 100) void applyReadyOta(key);
      else void downloadOtaUpdate(key);
      return;
    }
    if (updateUi.kind === "apk" && pendingNativeRelease) {
      void startNativeInstall(pendingNativeRelease);
      return;
    }
    void checkForAppUpdate("manual", true, true);
  };

  return <UpdateModal state={updateUi} onClose={close} onLater={later} onUpdateNow={updateNow} onRetry={retry} />;''',
    "direct retry behavior",
)

gate = replace_once(
    gate,
    '  securityRow: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 9, borderRadius: radius.md, padding: spacing.md },',
    '''  stageRow: { marginTop: 18, flexDirection: "row", justifyContent: "space-between", gap: 6 },
  stageItem: { flex: 1, alignItems: "center", gap: 6 },
  stageDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stageNumber: { fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] },
  stageName: { fontSize: 9, lineHeight: 12, fontWeight: "700" },
  nextCard: { marginTop: 14, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  nextLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1.1 },
  nextText: { marginTop: 3, fontSize: 12, lineHeight: 17, fontWeight: "600" },
  securityRow: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 9, borderRadius: radius.md, padding: spacing.md },''',
    "update modal stage styles",
)
write(gate_path, gate)

installer_path = "frontend/android/app/src/main/java/com/oncampus/app/OnCampusApkInstallerModule.kt"
installer = read(installer_path)
installer = replace_once(
    installer,
    '    return ((state.downloaded * 84L) / state.total).toInt().coerceIn(1, 84)',
    '    return ((state.downloaded * 100L) / state.total).toInt().coerceIn(1, 100)',
    "current APK download percentage",
)
installer = replace_once(
    installer,
    '                ((state.downloaded * 84L) / state.total).toInt().coerceIn(1, 84)',
    '                ((state.downloaded * 100L) / state.total).toInt().coerceIn(1, 100)',
    "monitored APK download percentage",
)
installer = replace_once(
    installer,
    '                emit("downloading", progress, "Downloading OnCampus update", "$progress% downloaded • safe to minimize OnCampus")',
    '                emit("downloading", progress, "Downloading OnCampus update", "$progress% downloaded • safe to minimize OnCampus", state.downloaded, state.total)',
    "native byte progress event",
)
installer = replace_once(
    installer,
    '  private fun emit(phase: String, progress: Int, message: String, detail: String) {',
    '  private fun emit(phase: String, progress: Int, message: String, detail: String, downloadedBytes: Long = -1L, totalBytes: Long = -1L) {',
    "native emit signature",
)
installer = replace_once(
    installer,
    '        putString("detail", detail)\n      }',
    '        putString("detail", detail)\n        if (downloadedBytes >= 0L) putDouble("downloadedBytes", downloadedBytes.toDouble())\n        if (totalBytes > 0L) putDouble("totalBytes", totalBytes.toDouble())\n      }',
    "native emit byte payload",
)
write(installer_path, installer)

validator_path = "frontend/scripts/validate-release-startup.js"
validator = read(validator_path)
validator = replace_once(
    validator,
    "expect(updateGate.includes('await Updates.reloadAsync()'), 'OTA apply must prefer in-process Expo reload');\nexpect(updateGate.includes('nativeInstaller?.restartForOta'), 'OTA apply must retain cold-restart fallback');",
    "expect(!updateGate.includes('Updates.reloadAsync()'), 'OTA apply must not depend on rejected in-process Expo reload');\n"
    "expect(updateGate.includes('nativeInstaller?.restartForOta') && updateGate.includes('await nativeInstaller.restartForOta()'), 'OTA apply must use native cold restart after download');\n"
    "expect(updateGate.includes('Automatic checks never hide or replace an active update UI'), 'automatic update failures must never dismiss active progress UI');\n"
    "expect(updateGate.includes('Live download progress') && updateGate.includes('Math.round(fraction * 100)'), 'professional live OTA percentage UI missing');\n"
    "expect(updateGate.includes('[\\\"Check\\\", \\\"Download\\\", \\\"Verify\\\", \\\"Apply\\\"]'), 'OTA stage stepper missing');",
    "OTA apply validator",
)
validator = replace_once(
    validator,
    "expect(apkInstaller.includes('DownloadManager'), 'APK updater must use Android DownloadManager');",
    "expect(apkInstaller.includes('DownloadManager'), 'APK updater must use Android DownloadManager');\n"
    "expect(apkInstaller.includes('COLUMN_BYTES_DOWNLOADED_SO_FAR') && apkInstaller.includes('downloadedBytes'), 'APK updater must expose real byte progress');\n"
    "expect(apkInstaller.includes('downloaded * 100L') && !apkInstaller.includes('downloaded * 84L'), 'APK download progress must be true transfer percentage');",
    "APK progress validator",
)
write(validator_path, validator)

write(
    "frontend/OTA_PROGRESS_BASELINE",
    """OnCampus 1.6.8 OTA reliability baseline

- Previous clean 1.6.3 UI remains the visual baseline.
- OTA discovery stays server-authoritative.
- Expo Updates useUpdates().downloadProgress drives the visible OTA percentage.
- Automatic/campaign failures never hide an active update modal.
- Download errors stay visible until Retry/Close.
- OTA activation uses native cold restart; no in-process Updates.reloadAsync dependency.
- Android APK DownloadManager reports real transfer percentage and byte counts.
""",
)

print("Guarded 1.6.8 updater migration applied.")
