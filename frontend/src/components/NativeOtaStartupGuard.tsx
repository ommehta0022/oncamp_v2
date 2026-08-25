import { useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";
import * as Updates from "expo-updates";

const API_BASE = "https://oncampus-backend-production.up.railway.app/v1";

function shortError(value: unknown) {
  const message = value instanceof Error ? value.message : String(value || "Unknown update error");
  return message.replace(/\s+/g, " ").trim().slice(0, 420);
}

async function retryUpdate() {
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) {
      Alert.alert(
        "Update not accepted",
        "The server has an update, but this installed runtime did not accept it. Install the latest OnCampus APK baseline once; future compatible changes will arrive through OTA."
      );
      return;
    }
    const fetched = await Updates.fetchUpdateAsync();
    if (!fetched.isNew) {
      Alert.alert("Updates", "The update is already downloaded or no newer compatible bundle is available.");
      return;
    }
    Alert.alert(
      "OnCampus update ready",
      "The verified OTA update is downloaded and ready to apply.",
      [{ text: "Restart & Apply", onPress: () => { void Updates.reloadAsync(); } }],
      { cancelable: false }
    );
  } catch (error) {
    Alert.alert("OTA update failed", shortError(error));
  }
}

export default function NativeOtaStartupGuard() {
  const {
    isUpdatePending,
    downloadedUpdate,
    checkError,
    downloadError,
  } = Updates.useUpdates();
  const pendingPrompted = useRef<string | null>(null);
  const failurePrompted = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "android" || !Updates.isEnabled || !isUpdatePending) return;
    const updateId = String(downloadedUpdate?.updateId || "pending");
    if (pendingPrompted.current === updateId) return;
    pendingPrompted.current = updateId;

    Alert.alert(
      "OnCampus update ready",
      "A verified update has been downloaded. Restart OnCampus now to apply it.",
      [{ text: "Restart & Apply", onPress: () => { void Updates.reloadAsync(); } }],
      { cancelable: false }
    );
  }, [downloadedUpdate?.updateId, isUpdatePending]);

  useEffect(() => {
    if (Platform.OS !== "android" || !Updates.isEnabled || isUpdatePending) return;
    const error = downloadError || checkError;
    if (!error) return;

    const key = shortError(error);
    if (!key || failurePrompted.current === key) return;

    let cancelled = false;
    const confirmServerExpectedUpdate = async () => {
      try {
        const runtime = String(Updates.runtimeVersion || "");
        if (!runtime) return;
        const response = await fetch(`${API_BASE}/updates/status?runtimeVersion=${encodeURIComponent(runtime)}`, {
          headers: { Accept: "application/json", "Cache-Control": "no-cache" },
        });
        if (!response.ok || cancelled) return;
        const status = await response.json() as { releaseAvailable?: boolean; updateId?: string | null };
        const currentId = String(Updates.updateId || "embedded");
        if (!status.releaseAvailable || !status.updateId || status.updateId === currentId || cancelled) return;

        failurePrompted.current = key;
        Alert.alert(
          "OnCampus update needs attention",
          `The server has a newer OTA, but the native updater rejected or could not download it.\n\n${key}`,
          [
            { text: "Retry OTA", onPress: () => { void retryUpdate(); } },
          ],
          { cancelable: false }
        );
      } catch {
        // Offline failures should not interrupt normal app use.
      }
    };
    void confirmServerExpectedUpdate();
    return () => {
      cancelled = true;
    };
  }, [checkError, downloadError, isUpdatePending]);

  return null;
}
