import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "@/src/lib/api";

type NotificationContextValue = {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await api.notifications.unreadCount();
      setUnreadCount(res.unread || 0);
    } catch (e) {
      console.warn("Failed to fetch unread count:", e);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.notifications.markAllRead();
      setUnreadCount(0);
    } catch (e) {
      console.warn("Failed to mark all read:", e);
    }
  }, []);

  useEffect(() => {
    refreshUnreadCount();
    // Optional: Set up polling or realtime subscription here
    const interval = setInterval(refreshUnreadCount, 60000); // Poll every minute
    return () => clearInterval(interval);
  }, [refreshUnreadCount]);

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
