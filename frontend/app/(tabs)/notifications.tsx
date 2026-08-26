import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useRouter } from "expo-router";
import { font, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import { api } from "@/src/lib/api";
import { cache } from "@/src/lib/cache";
import { normalizeNotification } from "@/src/lib/mappers";
import SkeletonLoader from "@/src/components/SkeletonLoader";
import EmptyState from "@/src/components/EmptyState";
import { NetworkError } from "@/src/components/NetworkError";
import { useToast } from "@/src/components/Toast";
type Notification = any;

const TABS = ["All", "Requests", "Mentions", "Announcements"];
const ICONS: Record<string, keyof typeof import("@expo/vector-icons").Ionicons.glyphMap> = {
  mention: "at", join: "person-add", announcement: "megaphone", reply: "arrow-undo", approved: "checkmark-circle", post: "newspaper", institution_post_request: "git-pull-request-outline",
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
    setLoading(true); setError(null);
    try {
      const cached = await cache.get<Notification[]>("notifications");
      if (cached?.length) setItems(cached.map(normalizeNotification));
      const rows = await api.notifications.list();
      const next = (rows || []).map(normalizeNotification);
      setItems(next);
      await cache.set("notifications", next, 2 * 60 * 1000);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load notifications."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchNotifs(); }, [fetchNotifs]);

  const markAll = async () => {
    const previous = items;
    setItems((n) => n.map((x) => ({ ...x, read: true })));
    try { await api.notifications.markAllRead(); }
    catch (err) { setItems(previous); showToast({ message: err instanceof Error ? err.message : "Could not update notifications.", variant: "error" }); }
  };

  const openNotification = async (notification: Notification) => {
    if (!notification.read) {
      setItems((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item));
      try { await api.notifications.markRead(notification.id); } catch { /* non-blocking */ }
    }
    const requestId = notification.data?.request_id || notification.data?.requestId;
    if (requestId || notification.type === "institution_post_request") {
      if (requestId) router.push(`/institution/content-request/${requestId}` as any);
      else router.push("/institution/content" as any);
    } else if (notification.data?.postId || notification.data?.post_id) {
      router.push(`/post/${notification.data.postId || notification.data.post_id}`);
    } else if (notification.data?.groupId || notification.data?.group_id) {
      router.push(`/group/${notification.data.groupId || notification.data.group_id}`);
    } else {
      router.push(`/notifications/${notification.id}`);
    }
  };

  let data = items;
  if (tab === "Requests") data = items.filter((n) => n.type === "institution_post_request");
  else if (tab === "Mentions") data = items.filter((n) => n.type === "mention" || n.type === "reply");
  else if (tab === "Announcements") data = items.filter((n) => n.type === "announcement");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="notifications-screen">
      <View style={[styles.header, { borderBottomColor: colors.divider }]}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Notifications</Text>
        <Pressable onPress={markAll} hitSlop={8}><Text style={{ color: colors.luxuryGold, fontSize: font.sm, fontWeight: "800" }}>Mark all read</Text></Pressable>
      </View>
      <FlatList
        horizontal
        data={TABS}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.lg, paddingTop: 6, paddingBottom: 4 }}
        style={{ flexGrow: 0 }}
        renderItem={({ item: t }) => {
          const active = tab === t;
          return <Pressable onPress={() => setTab(t)} style={styles.tab}>
            <Text style={{ color: active ? colors.onSurface : colors.onSurfaceTertiary, fontSize: font.base, fontWeight: active ? "800" : "600" }}>{t}</Text>
            <View style={[styles.tabLine, { backgroundColor: active ? colors.luxuryGold : "transparent" }]} />
          </Pressable>;
        }}
      />
      {loading && items.length === 0 ? <SkeletonLoader type="groupRow" count={5} /> : error && items.length === 0 ? <NetworkError onRetry={fetchNotifs} message={error} /> : <FlatList
        showsVerticalScrollIndicator={false}
        data={data}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ paddingBottom: 120, flexGrow: 1 }}
        ListEmptyComponent={<EmptyState icon="notifications-off-outline" title="No notifications" message={tab === "All" ? "You are all caught up." : "No notifications match this filter."} />}
        renderItem={({ item }) => <NotifRow n={item} onPress={() => void openNotification(item)} />}
        ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 76 }} />}
      />}
    </SafeAreaView>
  );
}

function NotifRow({ n, onPress }: { n: Notification; onPress: () => void }) {
  const { colors } = useTheme();
  const badgeColor = n.type === "institution_post_request" ? colors.luxuryTeal : colors.luxuryGold;
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { backgroundColor: !n.read ? colors.highlight : pressed ? colors.surfaceTertiary : colors.surface }]}>
    <View style={{ position: "relative" }}>
      <Avatar uri={n.avatar} name={n.title} size={46} />
      <View style={[styles.typeBadge, { backgroundColor: badgeColor, borderColor: colors.surface }]}><Ionicons name={ICONS[n.type] || "notifications"} size={11} color={colors.onBrandPrimary} /></View>
    </View>
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: n.read ? "600" : "800" }} numberOfLines={1}>{n.title}</Text>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 3, lineHeight: 18 }} numberOfLines={2}>{n.body}</Text>
      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 5 }}>{n.createdAt}</Text>
    </View>
    {!n.read && <View style={[styles.dot, { backgroundColor: colors.luxuryGold }]} />}
  </Pressable>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: 10, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 28, fontWeight: "900", letterSpacing: -0.8 },
  tab: { minHeight: 42, paddingHorizontal: 1, alignItems: "center", justifyContent: "center", position: "relative" },
  tabLine: { position: "absolute", bottom: 0, left: 0, right: 0, height: 2, borderRadius: 1 },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: 14, minHeight: 78 },
  typeBadge: { position: "absolute", right: -3, bottom: -3, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
