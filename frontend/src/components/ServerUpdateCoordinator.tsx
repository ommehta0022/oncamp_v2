import React, { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import * as Updates from "expo-updates";

import { checkForAppUpdate } from "./AppUpdateGate";

const API_BASE = "https://oncampus-backend-production.up.railway.app/v1";
const INSTALLATION_KEY = "oncampus.update.installation_id";
const DEFAULT_POLL_SECONDS = 30;
const MIN_POLL_SECONDS = 30;
const MAX_POLL_SECONDS = 5 * 60;

let inFlight = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function makeInstallationId() {
  return `install-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function pollDelaySeconds(value?: number) {
  if (!Number.isFinite(value)) return DEFAULT_POLL_SECONDS;
  return Math.max(MIN_POLL_SECONDS, Math.min(MAX_POLL_SECONDS, Number(value)));
}

async function installationId() {
  const existing = await SecureStore.getItemAsync(INSTALLATION_KEY);
  if (existing) return existing;
  const next = makeInstallationId();
  await SecureStore.setItemAsync(INSTALLATION_KEY, next);
  return next;
}

async function notificationRegistration() {
  if (Platform.OS !== "android" || !Device.isDevice) {
    return { permission: "unknown" as const, pushToken: null as string | null };
  }

  // Android 13+ needs a channel before the notification permission prompt can
  // be useful. Ask only while the permission is undecided; never nag a denial.
  await Notifications.setNotificationChannelAsync("updates", {
    name: "App updates",
    description: "OnCampus app update alerts",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 120, 180],
    sound: "default",
  });

  let permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== "granted" && permissions.status !== "denied") {
    try {
      permissions = await Notifications.requestPermissionsAsync();
    } catch {
      // Polling remains the delivery guarantee even if permission UI fails.
    }
  }

  const permission = permissions.status === "granted"
    ? "granted"
    : permissions.status === "denied"
      ? "denied"
      : "unknown";

  if (permission !== "granted") {
    return { permission, pushToken: null as string | null };
  }

  try {
    const nativeToken = await Notifications.getDevicePushTokenAsync();
    return {
      permission,
      pushToken: typeof nativeToken.data === "string" ? nativeToken.data : null,
    };
  } catch {
    return { permission, pushToken: null as string | null };
  }
}

async function registerInstallation() {
  if (Platform.OS !== "android") return null;
  const id = await installationId();
  const registration = await notificationRegistration();
  const payload = {
    installationId: id,
    platform: "android",
    pushToken: registration.pushToken,
    notificationPermission: registration.permission,
    nativeVersion: String(Constants.expoConfig?.version || "0.0.0"),
    runtimeVersion: String(Updates.runtimeVersion || Constants.expoConfig?.runtimeVersion || ""),
    currentUpdateId: Updates.updateId || "embedded",
  };

  try {
    await fetch(`${API_BASE}/updates/installations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Registration is best effort. Server polling is the non-push fallback.
  }
  return id;
}

async function checkServerCampaign(force = false): Promise<number> {
  if (Platform.OS !== "android" || !Updates.isEnabled || inFlight) return DEFAULT_POLL_SECONDS;
  if (!force && AppState.currentState !== "active") return DEFAULT_POLL_SECONDS;
  inFlight = true;
  let nextPollSeconds = DEFAULT_POLL_SECONDS;
  try {
    const id = await installationId();
    const runtime = String(Updates.runtimeVersion || Constants.expoConfig?.runtimeVersion || "");
    const nativeVersion = String(Constants.expoConfig?.version || "0.0.0");
    const currentUpdateId = String(Updates.updateId || "embedded");
    if (!runtime) return nextPollSeconds;

    const url = new URL(`${API_BASE}/updates/campaign`);
    url.searchParams.set("runtimeVersion", runtime);
    url.searchParams.set("nativeVersion", nativeVersion);
    url.searchParams.set("currentUpdateId", currentUpdateId);
    url.searchParams.set("installationId", id);

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    });
    if (!response.ok) return nextPollSeconds;

    const campaign = await response.json() as {
      available?: boolean;
      campaignId?: string;
      forceUpdate?: boolean;
      nativeUpdateAvailable?: boolean;
      nativeReleaseVersion?: string | null;
      pollAfterSeconds?: number;
    };
    nextPollSeconds = pollDelaySeconds(campaign.pollAfterSeconds);

    if (campaign.nativeUpdateAvailable || (campaign.available && campaign.campaignId)) {
    await checkForAppUpdate("campaign", true, true);
  }
  return nextPollSeconds;
  } catch {
    return nextPollSeconds;
  } finally {
    inFlight = false;
  }
}

export default function ServerUpdateCoordinator() {
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    let cancelled = false;

    const schedulePoll = (seconds = DEFAULT_POLL_SECONDS) => {
      if (cancelled) return;
      if (pollRef.current) clearTimeout(pollRef.current);
      pollRef.current = setTimeout(async () => {
        const next = await checkServerCampaign(false);
        if (!cancelled) schedulePoll(next);
      }, pollDelaySeconds(seconds) * 1000);
    };

    const initialize = async () => {
      await registerInstallation();
      if (cancelled) return;
      const next = await checkServerCampaign(true);
      if (!cancelled) schedulePoll(next);
    };
    void initialize();

    const received = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown>;
      if (data?.type === "ota_update" || data?.type === "native_update") void checkServerCampaign(true);
    });

    const tapped = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (data?.type === "ota_update" || data?.type === "native_update") void checkServerCampaign(true);
    });

    const tokenChanged = Notifications.addPushTokenListener(() => {
      void registerInstallation();
    });

    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void registerInstallation();
        void checkServerCampaign(true).then((next) => {
          if (!cancelled) schedulePoll(next);
        });
      }
    });

    return () => {
      cancelled = true;
      received.remove();
      tapped.remove();
      tokenChanged.remove();
      appState.remove();
      if (pollRef.current) clearTimeout(pollRef.current);
      pollRef.current = null;
    };
  }, []);

  return null;
}
