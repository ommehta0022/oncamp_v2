import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import { api } from "@/src/lib/api";
import { asArray, normalizeNotification } from "@/src/lib/mappers";

type Notification = ReturnType<typeof normalizeNotification>;

export default function NotificationDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [notification, setNotification] = useState<Notification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!id) return;
      try {
        setError(null);
        await api.notifications.markRead(id).catch(() => {});
        const rows = await api.notifications.list();
        const found = asArray(rows).map(normalizeNotification).find((item) => item.id === id) || null;
        if (mounted) setNotification(found);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Failed to load notification");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const openTarget = () => {
    if (!notification?.targetId) return;
    if (notification.targetType?.includes("group") || notification.type === "join" || notification.type === "announcement") {
      router.push(`/group/info/${notification.targetId}`);
      return;
    }
    if (notification.targetType?.includes("user")) {
      router.push(`/user/${notification.targetId}`);
      return;
    }
    router.push(`/post/${notification.targetId}`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Alert" onBack={() => router.back()} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : error || !notification ? (
        <EmptyState
          icon="notifications-off-outline"
          title="Notification not found"
          message={error || "This alert is not available anymore."}
        />
      ) : (
        <View style={{ padding: spacing.lg }}>
          <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: colors.brandTertiary }]}>
              <Ionicons name="notifications" size={24} color={colors.onBrandTertiary} />
            </View>
            <Text style={{ color: colors.onSurface, fontSize: font.xl, fontWeight: "500", marginTop: spacing.lg }}>
              {notification.title}
            </Text>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base, lineHeight: 22, marginTop: spacing.sm }}>
              {notification.body || "No additional details."}
            </Text>
            <Text style={{ color: colors.muted, fontSize: font.sm, marginTop: spacing.md }}>{notification.createdAt}</Text>

            {!!notification.targetId && (
              <Pressable onPress={openTarget} style={[styles.openBtn, { backgroundColor: colors.brandPrimary }]}>
                <Text style={{ color: colors.onBrandPrimary, fontSize: font.base, fontWeight: "500" }}>Open related item</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.onBrandPrimary} />
              </Pressable>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.lg },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  openBtn: {
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
});
