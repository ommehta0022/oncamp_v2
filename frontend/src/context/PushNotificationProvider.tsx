import React, { createContext, useContext, useEffect, useRef } from "react";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "@/src/lib/api";
import { useRole } from "./RoleProvider";

type PushNotificationContextValue = Record<string, never>;
type NotificationSubscription = { remove: () => void };
type NotificationsModule = typeof import("expo-notifications");

const PushNotificationContext = createContext<PushNotificationContextValue | null>(null);
const isAndroidExpoGo = Platform.OS === "android" && Constants.appOwnership === "expo";

export function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useRole();
  const notificationListener = useRef<NotificationSubscription | null>(null);
  const responseListener = useRef<NotificationSubscription | null>(null);

  useEffect(() => {
    if (!user) return;

    if (isAndroidExpoGo) {
      console.warn("Push notifications require a development build on Android; skipping registration in Expo Go.");
      return;
    }

    let cancelled = false;

    const setupNotifications = async () => {
      try {
        const Notifications = await import("expo-notifications");
        if (cancelled) return;

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });

        const token = await registerForPushNotificationsAsync(Notifications);
        if (cancelled) return;

        if (token) {
          api.notifications.registerDevice(token, Platform.OS).catch(e => {
            console.warn("Failed to register device token with backend", e);
          });
        }

        notificationListener.current = Notifications.addNotificationReceivedListener(() => {
          // Could trigger a UI refresh here
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
          // Handle deep linking based on notification data
        });
      } catch (e) {
        console.warn("Failed to initialize push notifications", e);
      }
    };

    void setupNotifications();

    return () => {
      cancelled = true;
      notificationListener.current?.remove();
      responseListener.current?.remove();
      notificationListener.current = null;
      responseListener.current = null;
    };
  }, [user]);

  return (
    <PushNotificationContext.Provider value={{}}>
      {children}
    </PushNotificationContext.Provider>
  );
}

export function usePushNotifications() {
  const ctx = useContext(PushNotificationContext);
  if (!ctx) throw new Error("usePushNotifications must be used within PushNotificationProvider");
  return ctx;
}

async function registerForPushNotificationsAsync(Notifications: NotificationsModule) {
  let token;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      return null;
    }
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.warn("Missing eas.projectId in app config; skipping push token registration.");
        return null;
      }

      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (e) {
      console.warn("Error getting expo push token", e);
    }
  }

  return token;
}
