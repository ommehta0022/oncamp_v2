import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import * as Updates from "expo-updates";

import { prefetchLatestOta, setupBackgroundOta } from "@/src/updates/backgroundOta";

const ACTIVE_PREFETCH_INTERVAL_MS = 2 * 60 * 1000;

export default function BackgroundOtaCoordinator() {
  useEffect(() => {
    if (Platform.OS !== "android" || !Updates.isEnabled) return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    let startupTimer: ReturnType<typeof setTimeout> | null = null;

    const prefetch = (force = false) => {
      if (cancelled) return;
      void prefetchLatestOta(force).catch(() => undefined);
    };

    void setupBackgroundOta().catch(() => undefined);

    // Give the first screen a moment to render, then silently start fetching a
    // compatible signed update. This shifts network time ahead of the user's
    // Update now tap and makes the visible install step much faster.
    startupTimer = setTimeout(() => prefetch(true), 1200);

    interval = setInterval(() => {
      if (AppState.currentState === "active") prefetch(false);
    }, ACTIVE_PREFETCH_INTERVAL_MS);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        prefetch(true);
        return;
      }

      if (state === "inactive" || state === "background") {
        // Start one best-effort fetch immediately before JS is suspended.
        // Android WorkManager remains registered as the durable fallback.
        prefetch(true);
      }
    });

    return () => {
      cancelled = true;
      if (startupTimer) clearTimeout(startupTimer);
      if (interval) clearInterval(interval);
      subscription.remove();
    };
  }, []);

  return null;
}
