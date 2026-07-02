import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import { joinRequests } from "@/src/data/mock";
import { api } from "@/src/lib/api";

function normalizeJoinRequest(row: any) {
  return {
    id: row.id,
    userId: row.user_id || row.userId || "",
    name: row.users?.name || row.name || "Student",
    bio: row.source ? `Source: ${row.source}` : row.bio || "Requested to join this group",
    avatar: row.avatar,
    requestedAt: row.created_at ? new Date(row.created_at).toLocaleDateString() : row.requestedAt || "",
  };
}

export default function Requests() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [items, setItems] = useState(joinRequests);

  useEffect(() => {
    if (!id) return;
    api.groups.joinRequests(id)
      .then((rows: any) => {
        if (Array.isArray(rows)) setItems(rows.map(normalizeJoinRequest));
      })
      .catch(() => {});
  }, [id]);

  const handleAction = async (requestId: string, action: "approve" | "reject") => {
    if (!id) return;
    setItems((x) => x.filter((r) => r.id !== requestId));
    try {
      if (action === "approve") await api.groups.approveJoinRequest(id, requestId);
      else await api.groups.rejectJoinRequest(id, requestId);
    } catch {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="requests-screen">
      <Header title="Join requests" subtitle={`${items.length} pending`} onBack={() => router.back()} />
      {items.length === 0 ? (
        <EmptyState icon="checkmark-done" title="All caught up" message="No pending join requests right now." />
      ) : (
        <FlatList showsVerticalScrollIndicator={false}
          data={items}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Avatar uri={item.avatar} name={item.name} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }}>{item.name}</Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{item.bio}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>Requested {item.requestedAt} ago</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                <Pressable
                  onPress={() => handleAction(item.id, "reject")}
                  style={[styles.reject, { borderColor: colors.borderStrong }]}
                  testID={`reject-${item.id}`}
                >
                  <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>Reject</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleAction(item.id, "approve")}
                  style={[styles.approve, { backgroundColor: colors.brandPrimary }]}
                  testID={`approve-${item.id}`}
                >
                  <Ionicons name="checkmark" size={16} color={colors.onBrandPrimary} />
                  <Text style={{ color: colors.onBrandPrimary, fontSize: font.base, fontWeight: "500" }}>Approve</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: 1, padding: spacing.lg },
  reject: {
    flex: 1, height: 42, borderRadius: radius.pill, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  approve: {
    flex: 1, height: 42, borderRadius: radius.pill,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
  },
});
