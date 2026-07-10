import { useEffect, useState } from "react";
import { api, getAccessToken } from "@/src/lib/api";
import { AppState, AppStateStatus } from "react-native";

/**
 * Hook to fetch real-time badge counts for tabs
 * Updates every 30 seconds and when app returns to foreground
 * Only fetches if user is authenticated
 */
export function useTabBadges() {
  const [groupsUnread, setGroupsUnread] = useState(0);
  const [notificationsUnread, setNotificationsUnread] = useState(0);

  const fetchBadges = async () => {
    try {
      // Check if user is authenticated first
      const token = await getAccessToken();
      if (!token) {
        // User not logged in, reset badges
        setGroupsUnread(0);
        setNotificationsUnread(0);
        return;
      }

      // Fetch groups with unread counts
      const groups = await api.groups.listMine();
      const totalUnread = groups.reduce((sum, g) => sum + (g.unread || 0), 0);
      setGroupsUnread(totalUnread > 99 ? 99 : totalUnread);

      // Fetch notifications
      const notifications = await api.notifications.list();
      if (Array.isArray(notifications)) {
        const unreadCount = notifications.filter((n: any) => !n.read_at && !n.read).length;
        setNotificationsUnread(unreadCount > 99 ? 99 : unreadCount);
      }
    } catch (error) {
      // Silently fail if authentication error
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("Authentication required")) {
        console.error("Failed to fetch tab badges:", error);
      }
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchBadges();

    // Poll every 30 seconds
    const interval = setInterval(fetchBadges, 30000);

    // Refresh when app comes to foreground
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
