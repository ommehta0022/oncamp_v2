import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useRouter } from "expo-router";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import { api } from "@/src/lib/api";
import { cache } from "@/src/lib/cache";
import { normalizeNotification } from "@/src/lib/mappers";
import SkeletonLoader from "@/src/components/SkeletonLoader";
import EmptyState from "@/src/components/EmptyState";
import { NetworkError } from "@/src/components/NetworkError";
import { useToast } from "@/src/components/Toast";
type Notification = any;

const TABS = ["All", "Mentions", "Announcements"];

const ICONS: Record<Notification["type"], keyof typeof import("@expo/vector-icons").Ionicons.glyphMap> = {
  mention: "at",
  join: "person-add",
  announcement: "megaphone",
  reply: "arrow-undo",
  approved: "checkmark-circle",
  post: "newspaper",
};

export default function Notifications() {
  const { colors } = useTheme();
  const router = useRouter();
  const { showToast } = useToast();
  const [tab, setTab] = useState("All");
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cached = await cache.get<Notification[]>("notifications");
      if (cached?.length) setItems(cached.map(normalizeNotification));
      const rows = await api.notifications.list();
      const next = (rows || []).map(normalizeNotification);
      setItems(next);
      await cache.set("notifications", next, 5 * 60 * 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchNotifs(); }, [fetchNotifs]);

  const markAll = async () => {
    const previous = items;
    setItems((n) => n.map((x) => ({ ...x, read: true })));
    try {
      await api.notifications.markAllRead();
    } catch (err) {
      setItems(previous);
      showToast({ message: err instanceof Error ? err.message : "Could not update notifications.", variant: "error" });
    }
  };

  const openNotification = async (notification: Notification) => {
    if (!notification.read) {
      setItems((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item));
      try { await api.notifications.markRead(notification.id); } catch { /* Detail remains available; retry happens on next load. */ }
    }
    
    if (notification.data?.postId) {
      router.push(`/post/${notification.data.postId}`);
    } else if (notification.data?.groupId) {
      router.push(`/group/${notification.data.groupId}`);
    } else {
      router.push(`/notifications/${notification.id}`);
    }
  };

  let data = items;
  if (tab === "Mentions") data = items.filter((n) => n.type === "mention" || n.type === "reply");
  else if (tab === "Announcements") data = items.filter((n) => n.type === "announcement");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="notifications-screen">
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Alerts</Text>
        <Pressable onPress={markAll} testID="mark-all-read-btn">
          <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "500" }}>Mark all read</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.md }}>
        {TABS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[
              styles.tab,
              { backgroundColor: tab === t ? colors.brandPrimary : colors.surfaceTertiary },
            ]}
          >
            <Text
              style={{
                color: tab === t ? colors.onBrandPrimary : colors.onSurface,
                fontSize: font.base,
                fontWeight: "500",
              }}
            >
              {t}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading && items.length === 0 ? <SkeletonLoader type="groupRow" count={5} /> : error && items.length === 0 ? (
        <NetworkError onRetry={fetchNotifs} message={error} />
      ) : <FlatList showsVerticalScrollIndicator={false}
        data={data}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ paddingBottom: 120, flexGrow: 1 }}
        ListEmptyComponent={<EmptyState icon="notifications-off-outline" title="No notifications" message={tab === "All" ? "You are all caught up." : "No notifications match this filter."} />}
        renderItem={({ item }) => <NotifRow n={item} onPress={() => void openNotification(item)} />}
        ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 72 }} />}
      />}
    </SafeAreaView>
  );
}

function NotifRow({ n, onPress }: { n: Notification; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: !n.read ? colors.brandTertiary + "60" : pressed ? colors.surfaceTertiary : colors.surface,
        },
      ]}
    >
      <View style={{ position: "relative" }}>
        <Avatar uri={n.avatar} name={n.title} size={44} />
        <View style={[styles.typeBadge, { backgroundColor: colors.brandPrimary, borderColor: colors.surface }]}>
          <Ionicons name={ICONS[n.type] || "notifications"} size={11} color="#fff" />
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }} numberOfLines={1}>
          {n.title}
        </Text>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2, lineHeight: 18 }} numberOfLines={2}>
          {n.body}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{n.createdAt}</Text>
      </View>
      {!n.read && <View style={[styles.dot, { backgroundColor: colors.brandSecondary }]} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 26, fontWeight: "500", letterSpacing: 0 },
  tab: {
    height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  row: {
    flexDirection: "row", gap: spacing.md, alignItems: "center",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 72,
  },
  typeBadge: {
    position: "absolute", right: -3, bottom: -3,
    width: 20, height: 20, borderRadius: 10,
    alignItems: "center", justifyContent: "center", borderWidth: 2,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
