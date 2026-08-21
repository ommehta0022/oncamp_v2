import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import { api, NotificationDto } from "@/src/lib/api";
import { campusApi } from "@/src/lib/campusApi";
import { formatAgo } from "@/src/lib/institution";

type ActivityItem = { id: string; title: string; detail: string; icon: keyof typeof Ionicons.glyphMap; createdAt?: string };

export default function ActivityLog() {
  const { colors } = useTheme();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [notificationRows, activityRows] = await Promise.all([
        api.notifications.list().catch(() => []),
        campusApi.student.activity().catch(() => []),
      ]);
      setNotifications(Array.isArray(notificationRows) ? notificationRows : []);
      setEvents(Array.isArray(activityRows) ? activityRows : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load activity.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadActivity(); }, [loadActivity]);

  const items = useMemo<ActivityItem[]>(() => {
    const notificationItems = notifications.map((item) => ({
      id: `notification-${item.id}`,
      title: item.title || "Notification",
      detail: item.body || "Account notification",
      icon: "notifications-outline" as const,
      createdAt: item.createdAt || (item as any).created_at,
    }));
    const activityItems = events.map((item: any) => ({
      id: `activity-${item.id}`,
      title: labelForEvent(item.event_type),
      detail: detailForEvent(item),
      icon: iconForEvent(item.event_type),
      createdAt: item.created_at,
    }));
    return [...notificationItems, ...activityItems]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 100);
  }, [notifications, events]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Recent activity" onBack={() => router.back()} />
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View> : error ? <View style={{ flex: 1, padding: spacing.lg }}><EmptyState icon="cloud-offline-outline" title="Could not load activity" message={error} actionLabel="Try again" onAction={loadActivity} /></View> : items.length === 0 ? <View style={{ flex: 1, padding: spacing.lg }}><EmptyState icon="time-outline" title="No activity yet" message="Your campus actions and important account notifications will appear here." /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 70 }}>
          {items.map((item) => <View key={item.id} style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><View style={[styles.icon, { backgroundColor: colors.surfaceTertiary }]}><Ionicons name={item.icon} size={18} color={colors.onSurfaceTertiary} /></View><View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "600" }}>{item.title}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{item.detail}</Text>{item.createdAt && <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{formatAgo(item.createdAt)}</Text>}</View></View>)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function labelForEvent(value?: string) {
  const key = String(value || "activity").replace(/[._-]+/g, " ");
  return key.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function detailForEvent(item: any) {
  if (item.metadata?.query) return `Searched for “${item.metadata.query}”`;
  if (item.metadata?.status) return `Status: ${item.metadata.status}`;
  if (item.target_type && item.target_id) return `${item.target_type}: ${item.target_id}`;
  return "Campus activity";
}
function iconForEvent(value?: string): keyof typeof Ionicons.glyphMap {
  const text = String(value || "");
  if (text.includes("search")) return "search-outline";
  if (text.includes("event")) return "calendar-outline";
  if (text.includes("marketplace")) return "storefront-outline";
  if (text.includes("lost_found")) return "search-circle-outline";
  if (text.includes("invite")) return "qr-code-outline";
  if (text.includes("reaction")) return "heart-outline";
  if (text.includes("feedback")) return "chatbox-ellipses-outline";
  return "pulse-outline";
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
