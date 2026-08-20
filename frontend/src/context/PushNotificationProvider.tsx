import React, { createContext, useContext, useEffect, useRef } from "react";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { useRole } from "./RoleProvider";

type PushNotificationContextValue = Record<string, never>;
type NotificationSubscription = { remove: () => void };

const PushNotificationContext = createContext<PushNotificationContextValue | null>(null);
const isAndroidExpoGo = Platform.OS === "android" && Constants.appOwnership === "expo";

export function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useRole();
  const notificationListener = useRef<NotificationSubscription | null>(null);
  const responseListener = useRef<NotificationSubscription | null>(null);

  useEffect(() => {
    if (!user || isAndroidExpoGo) return;

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

        // Native FCM token registration and notification permission are owned by
        // ServerUpdateCoordinator. Keeping a second token-registration path here
        // caused duplicate permission prompts and depended on a missing EAS project id.
        notificationListener.current = Notifications.addNotificationReceivedListener(() => {
          // NotificationProvider / feature-specific listeners perform UI refreshes.
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
          // Feature-specific deep links are handled by their own response listeners.
        });
      } catch (error) {
        console.warn("Failed to initialize notification listeners", error);
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
