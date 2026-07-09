import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Animated, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import EmptyState from "@/src/components/EmptyState";
import Tabs from "@/src/components/Tabs";
import SkeletonLoader from "@/src/components/SkeletonLoader";
import { api } from "@/src/lib/api";
import { typography } from "@/src/theme/typography";
import { useRouter } from "expo-router";
import { useToast } from "@/src/components/Toast";

const TABS = ["All", "Mentions", "Announcements"];

type Notification = {
  id: string;
  type: "mention" | "join" | "announcement" | "reply" | "approved" | "post";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  avatar?: string;
  data?: Record<string, any>;
};

const ICONS: Record<Notification["type"], keyof typeof import("@expo/vector-icons").Ionicons.glyphMap> = {
  mention: "at",
  join: "person-add",
  announcement: "megaphone",
  reply: "arrow-undo",
  approved: "checkmark-circle",
  post: "chatbubble-ellipses",
};

const ICON_COLORS: Record<Notification["type"], string> = {
  mention: "#3b82f6", // info
  join: "#10b981", // success
  announcement: "#f59e0b", // warning
  reply: "#8b5cf6", // purple
  approved: "#10b981", // success
  post: "#3b82f6", // info
};

function normalizeNotification(row: any): Notification {
  const type = ["mention", "join", "announcement", "reply", "approved", "post"].includes(row.type)
    ? row.type
    : "announcement";
  return {
    id: row.id,
    type,
    title: row.title,
    body: row.body,
    createdAt: row.created_at || row.createdAt || "",
    read: !!(row.read_at || row.read),
    avatar: row.avatar || undefined,
    data: row.data || {},
  };
}

export default function Notifications() {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const [tab, setTab] = useState("All");
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const rows: any = await api.notifications.list();
      if (Array.isArray(rows)) setItems(rows.map(normalizeNotification));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const markAll = () => {
    if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setItems((n) => n.map((x) => ({ ...x, read: true })));
    showToast({ message: "All marked as read", variant: "success" });
    api.notifications.markAllRead().catch(() => {});
  };

  const handlePressNotif = (notif: Notification) => {
    if (Platform.OS === 'ios') Haptics.selectionAsync();
    setItems(items.map(n => n.id === notif.id ? { ...n, read: true } : n));
    if (!notif.read) {
      api.notifications.markRead(notif.id).catch(() => {});
    }

    if (notif.data?.postId) {
      router.push(`/post/${notif.data.postId}` as any);
    } else if (notif.data?.groupId) {
      router.push(`/group/${notif.data.groupId}` as any);
    } else if (notif.data?.userId) {
      router.push(`/user/${notif.data.userId}` as any);
    }
  };

  let data = items;
  if (tab === "Mentions") data = items.filter((n) => n.type === "mention" || n.type === "reply");
  else if (tab === "Announcements") data = items.filter((n) => n.type === "announcement");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background || colors.surface }} edges={["top"]} testID="notifications-screen">
      <View style={[styles.header, { backgroundColor: colors.background || colors.surface }]}>
        <Text style={[styles.title, { color: colors.textPrimary || colors.onSurface }]}>Notifications</Text>
        <Pressable 
          onPress={markAll} 
          testID="mark-all-read-btn"
          style={({ pressed }) => [
            styles.markAllBtn,
            { opacity: pressed ? 0.7 : 1 }
          ]}
        >
          <Ionicons name="checkmark-done" size={18} color={colors.brandPrimary} />
          <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "600" }}>Mark all read</Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md, backgroundColor: colors.background || colors.surface }}>
        <Tabs 
          items={TABS.map(t => ({ id: t, label: t }))}
          activeId={tab}
          onChange={(t) => {
            if (Platform.OS === 'ios') Haptics.selectionAsync();
            setTab(t);
          }}
          variant="pill"
        />
      </View>

      {loading ? (
        <View style={{ padding: spacing.xl }}>
          {[1, 2, 3, 4, 5].map(i => (
            <View key={i} style={{ marginBottom: spacing.md }}>
              <SkeletonLoader type="groupRow" />
            </View>
          ))}
        </View>
      ) : (
        <FlatList 
          showsVerticalScrollIndicator={false}
          data={data}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingBottom: 120 }}
          renderItem={({ item }) => <NotifRow n={item} onPress={() => handlePressNotif(item)} />}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border || colors.divider, marginLeft: 76 }} />}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-off-outline"
              title="You're all caught up!"
              message="When you have new mentions, announcements, or replies, they'll show up here."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function NotifRow({ n, onPress }: { n: Notification, onPress: () => void }) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  };

  const iconColor = n.type === 'announcement' ? (colors.warning || ICON_COLORS[n.type]) 
    : n.type === 'join' || n.type === 'approved' ? (colors.success || ICON_COLORS[n.type]) 
    : (colors.brandPrimary || ICON_COLORS[n.type]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[
        styles.row,
        {
          backgroundColor: !n.read ? (colors.brandTertiary || colors.brandPrimary) + "15" : colors.background || colors.surface,
          transform: [{ scale: scaleAnim }]
        },
      ]}>
        {!n.read && (
          <View style={[styles.unreadIndicator, { backgroundColor: colors.brandPrimary }]} />
        )}
        
        <View style={{ position: "relative", marginLeft: !n.read ? spacing.xs : 0 }}>
          <Avatar uri={n.avatar} name={n.title} size={48} />
          <View style={[styles.typeBadge, { backgroundColor: iconColor, borderColor: colors.background || colors.surface }]}>
            <Ionicons name={ICONS[n.type]} size={10} color="#fff" />
          </View>
        </View>
        
        <View style={{ flex: 1, paddingRight: spacing.sm }}>
          <Text style={{ color: colors.textPrimary || colors.onSurface, fontSize: font.base, fontWeight: !n.read ? "700" : "500" }} numberOfLines={1}>
            {n.title}
          </Text>
          <Text style={{ color: colors.textSecondary || colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 4, lineHeight: 20 }} numberOfLines={2}>
            {n.body}
          </Text>
          <Text style={{ color: colors.textSecondary || colors.muted, fontSize: 11, marginTop: 6, fontWeight: "500" }}>
            {n.createdAt}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md,
  },
  title: { 
    ...typography.h2,
    fontSize: 28, 
    letterSpacing: -0.5 
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: radius.md,
  },
  row: {
    flexDirection: "row", gap: spacing.md, alignItems: "flex-start",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, minHeight: 88,
  },
  unreadIndicator: {
    position: "absolute",
    left: 0,
    top: spacing.lg,
    bottom: spacing.lg,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  typeBadge: {
    position: "absolute", right: -4, bottom: -4,
    width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center", borderWidth: 2.5,
  },
});
