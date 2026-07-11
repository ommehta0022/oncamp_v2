import { useEffect, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { api, getAccessToken } from "@/src/lib/api";

function isExpectedAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return (
    message.includes("Authentication required") ||
    message.includes("Account not found") ||
    message.includes("account may have been deleted") ||
    message.includes("Not Found")
  );
}

export function useTabBadges() {
  const [groupsUnread, setGroupsUnread] = useState(0);
  const [notificationsUnread, setNotificationsUnread] = useState(0);

  const fetchBadges = async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        setGroupsUnread(0);
        setNotificationsUnread(0);
        return;
      }

      const groups = await api.groups.listMine();
      const totalUnread = groups.reduce((sum, g) => sum + (g.unread || 0), 0);
      setGroupsUnread(totalUnread > 99 ? 99 : totalUnread);

      const notifications = await api.notifications.list();
      if (Array.isArray(notifications)) {
        const unreadCount = notifications.filter((n: any) => !n.read_at && !n.read).length;
        setNotificationsUnread(unreadCount > 99 ? 99 : unreadCount);
      }
    } catch (error) {
      setGroupsUnread(0);
      setNotificationsUnread(0);

      if (!isExpectedAuthError(error)) {
        console.warn("Failed to fetch tab badges:", error);
      }
    }
  };

  useEffect(() => {
    fetchBadges();

    const interval = setInterval(fetchBadges, 30000);
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        fetchBadges();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  return { groupsUnread, notificationsUnread };
}
