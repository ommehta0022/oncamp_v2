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
const FALLBACK_POLL_MS = 15_000;

let inFlight = false;
let currentCampaignInMemory: string | null = null;

function makeInstallationId() {
  return `install-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
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

  await Notifications.setNotificationChannelAsync("updates", {
    name: "App updates",
    description: "Critical and feature updates for OnCampus",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 120, 180],
    sound: "default",
  });

  const existing = await Notifications.getPermissionsAsync();
  const permissionResult = existing.status === "granted"
    ? existing
    : await Notifications.requestPermissionsAsync();

  const permission = permissionResult.status === "granted"
    ? "granted"
    : permissionResult.status === "denied"
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
    // Registration is best effort. OTA polling still works without push.
  }
  return id;
}

async function checkServerCampaign(force = false) {
  if (Platform.OS !== "android" || !Updates.isEnabled || inFlight) return;
  if (!force && AppState.currentState !== "active") return;
  inFlight = true;
  try {
    const id = await installationId();
    const runtime = String(Updates.runtimeVersion || Constants.expoConfig?.runtimeVersion || "");
    const currentUpdateId = Updates.updateId || "embedded";
    if (!runtime) return;

    const url = new URL(`${API_BASE}/updates/campaign`);
    url.searchParams.set("runtimeVersion", runtime);
    url.searchParams.set("currentUpdateId", currentUpdateId);
    url.searchParams.set("installationId", id);

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    });
    if (!response.ok) return;

    const campaign = await response.json() as {
      available?: boolean;
      campaignId?: string;
      forceUpdate?: boolean;
    };
    if (!campaign.available || !campaign.campaignId) return;
    if (campaign.campaignId === currentCampaignInMemory && !force) return;

    currentCampaignInMemory = campaign.campaignId;
    await checkForAppUpdate(true);
  } catch {
    // The currently installed bundle remains active on connectivity/server errors.
  } finally {
    inFlight = false;
  }
}

export default function ServerUpdateCoordinator() {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    let cancelled = false;

    const initialize = async () => {
      await registerInstallation();
      if (!cancelled) await checkServerCampaign(true);
    };
    void initialize();

    const received = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown>;
      if (data?.type === "ota_update") void checkServerCampaign(true);
    });

    const tapped = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (data?.type === "ota_update") void checkServerCampaign(true);
    });

    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void registerInstallation();
        void checkServerCampaign(true);
      }
    });

    pollRef.current = setInterval(() => {
      void checkServerCampaign(false);
    }, FALLBACK_POLL_MS);

    return () => {
      cancelled = true;
      received.remove();
      tapped.remove();
      appState.remove();
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, []);

  return null;
}
