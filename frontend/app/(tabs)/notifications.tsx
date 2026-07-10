import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import { api } from "@/src/lib/api";
import { cache } from "@/src/lib/cache";
import EmptyState from "@/src/components/EmptyState";
import { NetworkError } from "@/src/components/NetworkError";
import { asArray, normalizeNotification } from "@/src/lib/mappers";
type Notification = ReturnType<typeof normalizeNotification>;

const TABS = ["All", "Mentions", "Announcements"];

const ICONS: Record<string, keyof typeof import("@expo/vector-icons").Ionicons.glyphMap> = {
  mention: "at",
  join: "person-add",
  announcement: "megaphone",
  reply: "arrow-undo",
  approved: "checkmark-circle",
  post: "chatbubble-ellipses",
};

export default function Notifications() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState("All");
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifs = async (useCached = true) => {
    try {
      setError(null);
      if (useCached) {
        const cached = await cache.get("notifications");
        if (cached) setItems(asArray(cached).map(normalizeNotification));
      }
      const rows: any = await api.notifications.list();
      const normalized = asArray(rows).map(normalizeNotification);
      setItems(normalized);
      await cache.set("notifications", normalized);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const markAll = () => {
    api.notifications.markAllRead().catch(() => {});
    setItems((n) => n.map((x) => ({ ...x, read: true })));
  };

  const openNotification = async (notification: Notification) => {
    setItems((n) => n.map((x) => x.id === notification.id ? { ...x, read: true } : x));
    api.notifications.markRead(notification.id).catch(() => {});
    router.push(`/notifications/${notification.id}`);
  };

  let data = items;
  if (tab === "Mentions") data = items.filter((n) => n.type === "mention" || n.type === "reply");
  else if (tab === "Announcements") data = items.filter((n) => n.type === "announcement");

  if (error && items.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="notifications-screen">
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.onSurface }]}>Alerts</Text>
        </View>
        <NetworkError onRetry={() => fetchNotifs(false)} message={error} />
      </SafeAreaView>
    );
  }

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

      <FlatList showsVerticalScrollIndicator={false}
        data={data}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }) => <NotifRow n={item} onPress={() => openNotification(item)} />}
        ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 72 }} />}
        ListEmptyComponent={
          <EmptyState
            icon={loading ? "hourglass-outline" : "notifications-off-outline"}
            title={loading ? "Loading alerts" : "No alerts yet"}
            message={loading ? "Checking your real notifications." : "Mentions, approvals, replies, and announcements will appear here."}
          />
        }
      />
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
  title: { fontSize: 26, fontWeight: "500", letterSpacing: -0.5 },
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
