import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import { NetworkError } from "@/src/components/NetworkError";
import { api } from "@/src/lib/api";
import { normalizeNotification } from "@/src/lib/mappers";

export default function NotificationDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [notification, setNotification] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const rows = await api.notifications.list();
      const item = (rows || []).map(normalizeNotification).find((row) => row.id === id);
      if (!item) throw new Error("This notification is no longer available.");
      setNotification(item);
      if (!item.read) await api.notifications.markRead(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this notification.");
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
    <Header title="Notification" onBack={() => router.back()} />
    {loading ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.brandPrimary} /></View>
      : error ? <NetworkError onRetry={load} message={error} />
      : <View style={{ padding: spacing.xl }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary }}><Ionicons name="notifications" size={24} color={colors.onBrandTertiary} /></View>
          <Text style={{ color: colors.onSurface, fontSize: font.xl, fontWeight: "600", marginTop: spacing.lg }}>{notification.title}</Text>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: spacing.sm }}>{notification.createdAt}</Text>
          <Text style={{ color: colors.onSurface, fontSize: font.base, lineHeight: 23, marginTop: spacing.xl }}>{notification.body}</Text>
          {!!notification.data?.postId && <Pressable onPress={() => router.push(`/post/${notification.data.postId}`)} style={{ marginTop: spacing.xl }}><Text style={{ color: colors.brandPrimary, fontWeight: "600" }}>Open related post</Text></Pressable>}
          {!!notification.data?.groupId && <Pressable onPress={() => router.push(`/group/${notification.data.groupId}`)} style={{ marginTop: spacing.lg }}><Text style={{ color: colors.brandPrimary, fontWeight: "600" }}>Open related group</Text></Pressable>}
        </View>}
  </SafeAreaView>;
}
