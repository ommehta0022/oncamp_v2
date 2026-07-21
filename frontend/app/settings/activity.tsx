import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import { api, getUserErrorMessage, NotificationDto, PostRequestDto } from "@/src/lib/api";
import { formatAgo } from "@/src/lib/institution";

type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  createdAt?: string;
  onPress?: () => void;
};

export default function ActivityLog() {
  const { colors } = useTheme();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [postRequests, setPostRequests] = useState<PostRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [notificationRows, requestRows] = await Promise.all([
        api.notifications.list().catch(() => []),
        api.users.myPostRequests().catch(() => []),
      ]);
      setNotifications(Array.isArray(notificationRows) ? notificationRows : []);
      setPostRequests(Array.isArray(requestRows) ? requestRows : []);
    } catch (err) {
      setError(getUserErrorMessage(err, "Could not load activity."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const items = useMemo<ActivityItem[]>(() => {
    const notificationItems = notifications.map((item) => ({
      id: `notification-${item.id}`,
      title: item.title || "Notification",
      detail: item.body || "Account notification",
      icon: "notifications-outline" as const,
      createdAt: item.createdAt || (item as any).created_at,
    }));

    const requestItems = postRequests.map((item: any) => ({
      id: `post-request-${item.id}`,
      title: item.title || item.postData?.title || "Post request",
      detail: `Status: ${String(item.status || "pending").replace("_", " ")}`,
      icon: "clipboard-outline" as const,
      createdAt: item.createdAt || item.created_at,
      onPress: () => router.push("/(tabs)/profile/my-requests" as any),
    }));

    return [...notificationItems, ...requestItems]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 50);
  }, [notifications, postRequests, router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Activity log" onBack={() => router.back()} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, padding: spacing.lg }}>
          <EmptyState icon="cloud-offline-outline" title="Could not load activity" message={error} actionLabel="Try again" onAction={loadActivity} />
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, padding: spacing.lg }}>
          <EmptyState icon="time-outline" title="No activity yet" message="Notifications and post request updates for your account will appear here." />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              onPress={item.onPress}
              disabled={!item.onPress}
              style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
              <View style={[styles.icon, { backgroundColor: colors.surfaceTertiary }]}>
                <Ionicons name={item.icon} size={18} color={colors.onSurfaceTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{item.title}</Text>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{item.detail}</Text>
                {!!item.createdAt && (
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{formatAgo(item.createdAt)}</Text>
                )}
              </View>
              {item.onPress ? <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
