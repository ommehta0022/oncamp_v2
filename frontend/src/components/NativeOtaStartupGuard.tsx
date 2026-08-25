import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Updates from "expo-updates";

/**
 * Native startup safety observer.
 *
 * Expo Updates still performs the native ON_LOAD check before React mounts,
 * while AppUpdateGate owns the only user-facing update experience. Keeping
 * this observer silent prevents duplicate dialogs when native and JS checks
 * notice the same release at nearly the same time.
 */
export default function NativeOtaStartupGuard() {
  const { checkError, downloadError } = Updates.useUpdates();
  const lastObserved = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "android" || !Updates.isEnabled) return;
    const error = downloadError || checkError;
    if (!error) return;
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.replace(/\s+/g, " ").trim().slice(0, 320);
    if (!normalized || lastObserved.current === normalized) return;
    lastObserved.current = normalized;
    // Diagnostics only. AppUpdateGate retries through the unified UI on an
    // explicit/manual check and automatic failures never interrupt startup.
    console.warn(`[OnCampus OTA] native startup check: ${normalized}`);
  }, [checkError, downloadError]);

  return null;
}
