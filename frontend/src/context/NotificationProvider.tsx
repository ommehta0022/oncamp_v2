import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/src/lib/api";
import { useRole } from "./RoleProvider";

type NotificationContextValue = {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

function isExpectedAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return (
    message.includes("Authentication required") ||
    message.includes("Account not found") ||
    message.includes("account may have been deleted") ||
    message.includes("Not Found")
  );
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useRole();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.notifications.unreadCount();
      setUnreadCount(data.unread || 0);
    } catch (e) {
      setUnreadCount(0);
      if (!isExpectedAuthError(e)) {
        console.warn("Failed to fetch unread count", e);
      }
    }
  }, [user]);

  const markAllRead = useCallback(async () => {
    try {
      await api.notifications.markAllRead();
      setUnreadCount(0);
    } catch (e) {
      if (!isExpectedAuthError(e)) {
        console.warn("Failed to mark all read", e);
      }
    }
  }, []);

  useEffect(() => {
    if (user) {
      refreshUnreadCount();
      const interval = setInterval(refreshUnreadCount, 60000);
      return () => clearInterval(interval);
    }
  }, [user, refreshUnreadCount]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnreadCount, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
