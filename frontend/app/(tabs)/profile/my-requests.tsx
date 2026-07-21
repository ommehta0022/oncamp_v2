import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import { api } from "@/src/lib/api";
import { formatAgo, formatShortDate } from "@/src/lib/institution";

type RequestStatus = "pending" | "approved" | "rejected" | "needs_changes" | "scheduled" | "published" | "expired";

export default function MyRequestsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.users.myPostRequests()
      .then((data) => setRequests(Array.isArray(data) ? data : []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="my-post-requests-screen">
      <Header title="My post requests" subtitle={`${requests.length} submitted`} onBack={() => router.back()} />
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : requests.length === 0 ? (
        <EmptyState icon="clipboard-outline" title="No requests sent yet" message="Post and poster requests you submit to groups will appear here." />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}>
          {requests.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => item.group_id && router.push(`/group/${item.group_id}`)}
              style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
                <View style={[styles.iconWrap, { backgroundColor: colors.brandTertiary }]}>
                  <Ionicons name="megaphone" size={18} color={colors.onBrandTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }} numberOfLines={2}>
                    {item.title || "Post request"}
                  </Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 4 }} numberOfLines={2}>
                    {item.description || "No description provided"}
                  </Text>
                </View>
                <StatusBadge status={item.status || "pending"} />
              </View>

              <View style={styles.metaGrid}>
                <Meta icon="time-outline" label="Sent" value={formatAgo(item.created_at)} />
                <Meta icon="calendar-outline" label="Publish" value={formatShortDate(item.requested_publish_at)} />
                <Meta icon="pricetag-outline" label="Category" value={item.category || "Post"} />
                <Meta icon="chatbubble-outline" label="Decision" value={item.decision_note || "Awaiting review"} />
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatusBadge({ status }: { status: RequestStatus }) {
  const { colors } = useTheme();
  const map: Record<RequestStatus, { color: string; label: string }> = {
    pending: { color: colors.warning, label: "PENDING" },
    approved: { color: colors.success, label: "APPROVED" },
    rejected: { color: colors.error, label: "REJECTED" },
    needs_changes: { color: colors.info, label: "CHANGES" },
    scheduled: { color: colors.info, label: "SCHEDULED" },
    published: { color: colors.success, label: "LIVE" },
    expired: { color: colors.muted, label: "EXPIRED" },
  };
  const item = map[status] || map.pending;
  return (
    <View style={{ backgroundColor: item.color + "22", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
      <Text style={{ color: item.color, fontSize: 10, fontWeight: "500", letterSpacing: 0.3 }}>{item.label}</Text>
    </View>
  );
}

function Meta({ icon, label, value }: { icon: any; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={14} color={colors.onSurfaceTertiary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</Text>
        <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500" }} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.md },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, width: "46%" },
});
