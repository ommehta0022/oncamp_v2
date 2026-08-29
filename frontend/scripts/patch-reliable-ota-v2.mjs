import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const gatePath = path.join(root, 'src/components/AppUpdateGate.tsx');
let source = fs.readFileSync(gatePath, 'utf8');

function replaceOne(search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  source = source.replace(search, replacement);
}

function replaceBlock(startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`${label}: start marker missing`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`${label}: end marker missing`);
  source = source.slice(0, start) + replacement + source.slice(end);
}

replaceOne(
  'type UpdatePhase = "hidden" | "checking" | "available" | "downloading" | "verifying" | "installing" | "permission" | "current" | "applied" | "error";',
  'type UpdatePhase = "hidden" | "checking" | "available" | "downloading" | "ready" | "verifying" | "installing" | "permission" | "current" | "applied" | "error";',
  'add ready phase',
);

replaceBlock(
  'async function showDownloadedPending(mode: UpdateCheckMode) {',
  '\nasync function checkForOtaUpdate(mode: UpdateCheckMode): Promise<boolean> {',
  `async function showDownloadedPending(mode: UpdateCheckMode) {\n  if (!downloadedPendingKey) return false;\n  if (await isDeferred(downloadedPendingKey, mode)) return true;\n  pendingOtaReleaseKey = downloadedPendingKey;\n  emitUpdateUi({\n    kind: "ota",\n    phase: "ready",\n    progress: 100,\n    releaseKey: downloadedPendingKey,\n    message: "Update downloaded",\n    detail: "100% downloaded and verified. Keep using OnCampus, or restart now when you are ready to apply it.",\n  });\n  return true;\n}\n`,
  'downloaded OTA ready state',
);

replaceOne(
  '    detail: "This signed production update matches your runtime. Download starts immediately and Android can continue retrying if you minimize OnCampus.",',
  '    detail: "Download starts automatically in the background. You can keep using OnCampus and choose when to restart after it reaches 100%.",',
  'automatic OTA copy',
);

replaceBlock(
  'async function reloadReadyOta(releaseKey: string) {',
  '\nasync function downloadAndApplyOta(releaseKey: string) {',
  `async function applyReadyOta(releaseKey: string) {\n  if (Platform.OS !== "android" || !Updates.isEnabled) return false;\n  if (AppState.currentState !== "active") {\n    emitUpdateUi({\n      kind: "ota",\n      phase: "ready",\n      progress: 100,\n      releaseKey,\n      message: "Update downloaded",\n      detail: "Return to OnCampus and tap Restart to apply when the app is active.",\n    });\n    return false;\n  }\n\n  await clearDeferral(releaseKey);\n  await queueOtaApply(releaseKey);\n  emitUpdateUi({\n    kind: "ota",\n    phase: "installing",\n    progress: 100,\n    releaseKey,\n    message: "Applying update",\n    detail: "The update is fully downloaded. OnCampus will restart once to switch to the new version.",\n  });\n  await new Promise((resolve) => setTimeout(resolve, 250));\n\n  try {\n    await Updates.reloadAsync();\n    return true;\n  } catch (expoReloadError) {\n    if (nativeInstaller?.restartForOta) {\n      try {\n        await nativeInstaller.restartForOta();\n        return true;\n      } catch (nativeRestartError) {\n        await Promise.all([\n          AsyncStorage.removeItem(APPLY_OTA_ON_RESUME_KEY),\n          AsyncStorage.removeItem(PENDING_OTA_KEY),\n        ]).catch(() => undefined);\n        emitUpdateUi({\n          kind: "ota",\n          phase: "error",\n          progress: 100,\n          releaseKey,\n          message: "Update downloaded safely",\n          detail: nativeRestartError instanceof Error\n            ? "Restart could not start: " + nativeRestartError.message.slice(0, 140) + ". Close OnCampus completely and reopen it to apply the downloaded update."\n            : "Close OnCampus completely and reopen it to apply the downloaded update.",\n        });\n        return false;\n      }\n    }\n\n    await Promise.all([\n      AsyncStorage.removeItem(APPLY_OTA_ON_RESUME_KEY),\n      AsyncStorage.removeItem(PENDING_OTA_KEY),\n    ]).catch(() => undefined);\n    emitUpdateUi({\n      kind: "ota",\n      phase: "error",\n      progress: 100,\n      releaseKey,\n      message: "Update downloaded safely",\n      detail: expoReloadError instanceof Error\n        ? "Automatic restart is unavailable: " + expoReloadError.message.slice(0, 140) + ". Close OnCampus completely and reopen it to apply the update."\n        : "Close OnCampus completely and reopen it to apply the update.",\n    });\n    return false;\n  }\n}\n`,
  'replace automatic OTA restart path',
);

replaceBlock(
  'async function downloadAndApplyOta(releaseKey: string) {',
  '\nasync function fetchNativeRelease(): Promise<NativeRelease | null> {',
  `async function downloadOtaUpdate(releaseKey: string) {\n  await clearDeferral(releaseKey);\n  pendingOtaReleaseKey = releaseKey;\n\n  emitUpdateUi({\n    kind: "ota",\n    phase: "downloading",\n    progress: 1,\n    releaseKey,\n    message: "Downloading update",\n    detail: "Starting the signed update download…",\n  });\n\n  try {\n    const ready = Boolean(downloadedPendingKey) || await prefetchLatestOta(true);\n    if (!ready) {\n      const serverId = await serverOtaId();\n      if (!serverId || serverId === currentUpdateId()) {\n        emitUpdateUi({\n          kind: "ota",\n          phase: "current",\n          progress: 100,\n          message: "Already up to date",\n          detail: "There is no newer signed update for this installation.",\n        });\n        return;\n      }\n\n      emitUpdateUi({\n        kind: "ota",\n        phase: "error",\n        progress: 0,\n        releaseKey,\n        message: "Download paused",\n        detail: "The update is still available. Check your connection and tap Try again; background retry remains scheduled.",\n      });\n      return;\n    }\n\n    downloadedPendingKey = releaseKey;\n    pendingOtaReleaseKey = releaseKey;\n    emitUpdateUi({\n      kind: "ota",\n      phase: "ready",\n      progress: 100,\n      releaseKey,\n      message: "Update downloaded",\n      detail: "100% downloaded and verified. Tap Restart to apply when you are ready—OnCampus will not close itself automatically.",\n    });\n  } catch (error) {\n    emitUpdateUi({\n      kind: "ota",\n      phase: "error",\n      progress: 0,\n      releaseKey,\n      message: "Update download paused",\n      detail: error instanceof Error ? error.message.slice(0, 180) : "Check your connection and try again.",\n    });\n  }\n}\n`,
  'replace OTA download/apply coupling',
);

replaceOne(
  '  const busy = ["checking", "downloading", "verifying", "installing"].includes(state.phase);\n  const available = state.phase === "available";',
  '  const busy = ["checking", "downloading", "verifying", "installing"].includes(state.phase);\n  const available = state.phase === "available";\n  const ready = state.phase === "ready";',
  'ready modal state',
);

replaceOne(
  '    if (state.phase === "available") return state.kind === "ota" ? "OTA AVAILABLE" : "ANDROID RELEASE";\n    if (state.phase === "downloading") return "DOWNLOADING";',
  '    if (state.phase === "available") return state.kind === "ota" ? "OTA AVAILABLE" : "ANDROID RELEASE";\n    if (state.phase === "downloading") return "DOWNLOADING";\n    if (state.phase === "ready") return "READY TO APPLY";',
  'ready modal label',
);

replaceBlock(
  '          {busy && state.phase !== "checking" && (',
  '\n\n          <View style={[styles.securityRow',
  `          {busy && state.phase !== "checking" && (\n            <>\n              <View style={[styles.progressTrack, { backgroundColor: colors.surfaceTertiary }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: state.progress }}>\n                <View style={[styles.progressFill, { width: String(Math.max(2, Math.min(100, state.progress || 2))) + "%", backgroundColor: state.kind === "apk" ? colors.actionPrimary : colors.brandPrimary }]} />\n              </View>\n              <View style={styles.progressMeta}>\n                <Text style={[styles.progressValue, { color: colors.onSurface }]}>{Math.round(state.progress)}%</Text>\n                <Text style={[styles.progressLabel, { color: colors.onSurfaceTertiary }]}>{state.phase === "downloading" ? "Downloaded" : state.phase === "verifying" ? "Verifying" : "Applying"}</Text>\n              </View>\n            </>\n          )}`,
  'real progress presentation',
);

replaceBlock(
  '          {available && (',
  '\n\n          {(terminal || permission) && (',
  `          {available && (\n            <View style={styles.actions}>\n              {!state.force && <Pressable style={[styles.secondaryButton, { borderColor: colors.borderStrong }]} onPress={onLater} accessibilityRole="button"><Text style={[styles.secondaryText, { color: colors.onSurface }]}>Later</Text></Pressable>}\n              <Pressable style={[styles.primaryButton, { backgroundColor: colors.brandPrimary }]} onPress={onUpdateNow} accessibilityRole="button"><Text style={{ color: colors.onBrandPrimary, fontWeight: "800", fontSize: 14 }}>{state.kind === "ota" ? "Download update" : "Download & install"}</Text></Pressable>\n            </View>\n          )}\n\n          {ready && (\n            <View style={styles.actions}>\n              {!state.force && <Pressable style={[styles.secondaryButton, { borderColor: colors.borderStrong }]} onPress={onLater} accessibilityRole="button"><Text style={[styles.secondaryText, { color: colors.onSurface }]}>Later</Text></Pressable>}\n              <Pressable style={[styles.primaryButton, { backgroundColor: colors.brandPrimary }]} onPress={onUpdateNow} accessibilityRole="button"><Text style={{ color: colors.onBrandPrimary, fontWeight: "800", fontSize: 14 }}>Restart to apply</Text></Pressable>\n            </View>\n          )}`,
  'download and restart actions',
);

replaceOne(
  '              {state.kind === "ota"\n                ? "You can minimize OnCampus. Android keeps a durable retry scheduled and the signed update will apply safely when the app is active again."\n                : "You can minimize OnCampus while Android downloads the APK. Return after it finishes and the verified Android installer will open automatically."}',
  '              {state.kind === "ota"\n                ? "You can minimize OnCampus while the signed update downloads. It will never restart the app until you choose Restart to apply."\n                : "You can minimize OnCampus while Android downloads the APK. After SHA-256 verification, Android\'s system installer will open when the app is active."}',
  'update safety copy',
);

replaceOne(
  '  const { isUpdatePending, downloadedUpdate } = Updates.useUpdates();',
  '  const { isUpdatePending, downloadedUpdate, isDownloading, downloadProgress, downloadError } = Updates.useUpdates();',
  'useUpdates progress fields',
);

replaceBlock(
  '  useEffect(() => {\n    if (Platform.OS !== "android" || !Updates.isEnabled || !isUpdatePending) {',
  '\n  useEffect(() => {\n    if (!nativeInstaller) return;',
  `  useEffect(() => {\n    if (!isDownloading) return;\n    const fraction = Number.isFinite(downloadProgress) ? Number(downloadProgress) : 0;\n    const percent = Math.max(1, Math.min(99, Math.round(fraction * 100)));\n    setUpdateUi((previous) => {\n      if (previous.kind !== "ota" || !["available", "downloading"].includes(previous.phase)) return previous;\n      return {\n        ...previous,\n        phase: "downloading",\n        progress: percent,\n        message: "Downloading update",\n        detail: String(percent) + "% downloaded • signed content is being verified as it arrives.",\n      };\n    });\n  }, [downloadProgress, isDownloading]);\n\n  useEffect(() => {\n    if (!downloadError) return;\n    setUpdateUi((previous) => {\n      if (previous.kind !== "ota" || previous.phase !== "downloading") return previous;\n      return {\n        ...previous,\n        phase: "error",\n        message: "Update download paused",\n        detail: "The signed update did not finish. Tap Try again; your current app remains unchanged.",\n      };\n    });\n  }, [downloadError]);\n\n  useEffect(() => {\n    if (Platform.OS !== "android" || !Updates.isEnabled || !isUpdatePending) {\n      downloadedPendingKey = null;\n      return;\n    }\n    downloadedPendingKey = "ota:" + String(downloadedUpdate?.updateId || currentRuntime() || "pending");\n    pendingOtaReleaseKey = downloadedPendingKey;\n    void showDownloadedPending("automatic");\n  }, [downloadedUpdate?.updateId, isUpdatePending]);\n`,
  'replace pending update auto-restart effect',
);

replaceOne(
  '      const showedApplied = await reconcileAppliedUpdate();\n      if (cancelled || showedApplied) return;\n      const resumed = await resumePendingOtaApply();\n      if (cancelled || resumed) return;\n      timer = setTimeout(() => { void checkForAppUpdate("automatic"); }, 900);',
  '      const showedApplied = await reconcileAppliedUpdate();\n      if (cancelled || showedApplied) return;\n      timer = setTimeout(() => { void checkForAppUpdate("automatic"); }, 900);',
  'remove startup auto apply',
);

replaceOne(
  '      if (state === "active") {\n        void resumePendingOtaApply().then((resumed) => {\n          if (!resumed) void checkForAppUpdate("automatic");\n        });\n      }',
  '      if (state === "active") {\n        void checkForAppUpdate("automatic");\n      }',
  'remove resume auto apply',
);

replaceBlock(
  '  const updateNow = () => {',
  '\n\n  return <UpdateModal',
  `  const updateNow = () => {\n    if (updateUi.kind === "ota") {\n      const key = updateUi.releaseKey || pendingOtaReleaseKey || downloadedPendingKey || ("ota:" + currentRuntime());\n      if (updateUi.phase === "ready" || isUpdatePending) {\n        void applyReadyOta(key);\n      } else {\n        void downloadOtaUpdate(key);\n      }\n      return;\n    }\n    if (pendingNativeRelease) void startNativeInstall(pendingNativeRelease);\n  };`,
  'separate OTA download from apply action',
);

replaceOne(
  '  progressFill: { height: "100%", borderRadius: 7 },',
  '  progressFill: { height: "100%", borderRadius: 7 },\n  progressMeta: { marginTop: 8, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },\n  progressValue: { fontSize: 14, fontWeight: "800", fontVariant: ["tabular-nums"] },\n  progressLabel: { fontSize: 11, fontWeight: "600" },',
  'progress meta styles',
);

if (source.includes('resumePendingOtaApply()')) throw new Error('automatic resume apply call still present');
if (source.includes('downloadAndApplyOta(')) throw new Error('old coupled OTA function still present');
if (!source.includes('downloadProgress')) throw new Error('real Expo download progress missing');
if (!source.includes('Restart to apply')) throw new Error('explicit restart action missing');
if (!source.includes('await Updates.reloadAsync()')) throw new Error('in-process reload primary path missing');
if (!source.includes('nativeInstaller?.restartForOta')) throw new Error('cold restart fallback missing');

fs.writeFileSync(gatePath, source);
console.log('Repaired OTA UX: real progress, no automatic restart, explicit apply, native fallback retained.');
