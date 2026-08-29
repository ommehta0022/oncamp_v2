import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

const API_BASE = "https://oncampus-backend-production.up.railway.app/v1";
const BACKGROUND_TASK_NAME = "oncampus-background-ota-v1";
const BACKGROUND_MIN_INTERVAL_MINUTES = 15;
const STATUS_TIMEOUT_MS = 7_000;
const FOREGROUND_PREFETCH_COOLDOWN_MS = 90_000;

export const OTA_BACKGROUND_READY_KEY = "oncampus.ota.background.ready.v1";
const OTA_BACKGROUND_SERVER_KEY = "oncampus.ota.background.server.v1";
const OTA_BACKGROUND_ERROR_KEY = "oncampus.ota.background.error.v1";

type ReadyMarker = {
  runtimeVersion: string;
  updateId: string;
  downloadedAt: number;
};

type ServerStatus = {
  releaseAvailable?: boolean;
  updateId?: string | null;
};

let activePrefetch: Promise<boolean> | null = null;
let lastForegroundPrefetchAt = 0;
let lastPrefetchError: string | null = null;

function runtimeVersion() {
  return String(Updates.runtimeVersion || "");
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim().slice(0, 320);
  return "OTA download could not be completed";
}

async function readServerStatus(): Promise<ServerStatus | null> {
  const runtime = runtimeVersion();
  if (!runtime) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}/updates/status?runtimeVersion=${encodeURIComponent(runtime)}`, {
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as ServerStatus;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function persistReady(updateId: string) {
  const marker: ReadyMarker = {
    runtimeVersion: runtimeVersion(),
    updateId,
    downloadedAt: Date.now(),
  };
  await AsyncStorage.multiSet([
    [OTA_BACKGROUND_READY_KEY, JSON.stringify(marker)],
    [OTA_BACKGROUND_SERVER_KEY, updateId],
  ]).catch(() => undefined);
  await AsyncStorage.removeItem(OTA_BACKGROUND_ERROR_KEY).catch(() => undefined);
  lastPrefetchError = null;
}

async function persistFailure(error: unknown) {
  const message = errorMessage(error);
  lastPrefetchError = message;
  await AsyncStorage.setItem(
    OTA_BACKGROUND_ERROR_KEY,
    JSON.stringify({ at: Date.now(), message }),
  ).catch(() => undefined);
}

async function fetchUpdateOnce(expectedUpdateId: string) {
  try {
    lastPrefetchError = null;
    const fetched = await Updates.fetchUpdateAsync();
    const manifestId = String((fetched as any)?.manifest?.id || expectedUpdateId || "pending");
    if (expectedUpdateId && manifestId && manifestId !== expectedUpdateId) {
      throw new Error(`OTA changed during download (${manifestId} != ${expectedUpdateId})`);
    }
    if (fetched.isNew || expectedUpdateId !== String(Updates.updateId || "")) {
      await persistReady(expectedUpdateId || manifestId);
      return true;
    }
    return false;
  } catch (error) {
    await persistFailure(error);
    return false;
  }
}

async function runPrefetch(force = false): Promise<boolean> {
  if (Platform.OS !== "android" || !Updates.isEnabled) return false;

  const now = Date.now();
  if (!force && now - lastForegroundPrefetchAt < FOREGROUND_PREFETCH_COOLDOWN_MS) return false;
  lastForegroundPrefetchAt = now;

  const status = await readServerStatus();
  const serverUpdateId = status?.releaseAvailable && status.updateId ? String(status.updateId) : "";
  if (!serverUpdateId) return false;

  // If the server is still advertising the update currently running on this
  // device, there is nothing to fetch.
  if (serverUpdateId === String(Updates.updateId || "")) return false;

  // Do one controlled native transfer. expo-updates already reuses cached
  // content-addressed assets. Repeating fetchUpdateAsync several times in one
  // tap restarts manifest/asset work and can create a retry storm on weak links.
  return fetchUpdateOnce(serverUpdateId);
}

export function getLastOtaPrefetchError() {
  return lastPrefetchError;
}

export function prefetchLatestOta(force = false): Promise<boolean> {
  if (activePrefetch) return activePrefetch;
  activePrefetch = runPrefetch(force).finally(() => {
    activePrefetch = null;
  });
  return activePrefetch;
}

export async function setupBackgroundOta() {
  if (Platform.OS !== "android" || !Updates.isEnabled) return;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    await BackgroundTask.registerTaskAsync(BACKGROUND_TASK_NAME, {
      minimumInterval: BACKGROUND_MIN_INTERVAL_MINUTES,
    });
  } catch (error) {
    await persistFailure(error);
  }
}

TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
  try {
    await prefetchLatestOta(true);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    await persistFailure(error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
