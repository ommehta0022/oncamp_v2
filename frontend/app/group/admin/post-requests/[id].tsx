import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import Avatar from "@/src/components/Avatar";
import EmptyState from "@/src/components/EmptyState";
import { api } from "@/src/lib/api";

const FILTERS = ["Pending", "Approved", "Rejected", "All"] as const;

type PostRequest = {
  id: string;
  title: string;
  description: string;
  posterUrl?: string;
  requesterName: string;
  requesterAvatar?: string;
  targetGroupId: string;
  targetGroupName: string;
  category: string;
  publishDate: string;
  expiryDate: string;
  contactPhone: string;
  contactEmail: string;
  status: "pending" | "approved" | "rejected" | "needs_changes" | "scheduled" | "published" | "expired";
  createdAt: string;
};

export default function PostRequestsInbox() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [filter, setFilter] = useState<typeof FILTERS[number]>("Pending");
  const [items, setItems] = useState<PostRequest[]>([]);

  const loadRequests = useCallback(async () => {
    try {
      const response = await api.groups.postRequests(id!);
      if (Array.isArray(response)) setItems(response.map(toPostRequest));
    } catch {
      setItems([]);
    }
  }, [id]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const list = items.filter((r) => {
    if (filter === "All") return true;
    if (filter === "Pending") return r.status === "pending" || r.status === "needs_changes";
    if (filter === "Approved") return r.status === "approved" || r.status === "scheduled" || r.status === "published";
    if (filter === "Rejected") return r.status === "rejected";
    return true;
  });

  const setStatus = async (rid: string, status: PostRequest["status"]) => {
    setItems((x) => x.map((r) => (r.id === rid ? { ...r, status } : r)));
    try {
      if (status === "approved") await api.groups.approvePostRequest(id!, rid);
      if (status === "rejected") await api.groups.rejectPostRequest(id!, rid);
    } catch {
      loadRequests();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="post-requests-inbox">
      <Header title="Post requests" subtitle={`${items.filter((i) => i.status === "pending").length} pending`} onBack={() => router.back()} />

      <View style={{ flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.md }}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.tab, { backgroundColor: filter === f ? colors.brandPrimary : colors.surfaceTertiary }]}
          >
            <Text style={{ color: filter === f ? colors.onBrandPrimary : colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>{f}</Text>
          </Pressable>
        ))}
      </View>

      {list.length === 0 ? (
        <EmptyState icon="shield-checkmark-outline" title="All caught up" message="No post requests to review right now." />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.md }}>
          {list.map((r) => (
            <View key={r.id} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center", marginBottom: spacing.md }}>
                <Avatar uri={r.requesterAvatar} name={r.requesterName} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{r.requesterName}</Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>Requested {r.createdAt} - to {r.targetGroupName}</Text>
                </View>
                <StatusBadge status={r.status} />
              </View>

              {r.posterUrl && (
                <Image source={{ uri: r.posterUrl }} style={styles.poster} contentFit="cover" />
              )}

              <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500", marginTop: spacing.md }}>{r.title}</Text>
              <Text style={{ color: colors.onSurfaceSecondary, fontSize: font.base, marginTop: 4, lineHeight: 20 }}>{r.description}</Text>

              <View style={styles.metaGrid}>
                <Meta icon="calendar-outline" label="Publish" value={r.publishDate} />
                <Meta icon="time-outline" label="Expires" value={r.expiryDate} />
                <Meta icon="pricetag-outline" label="Category" value={r.category} />
                <Meta icon="call-outline" label="Contact" value={r.contactPhone} />
              </View>

              {(r.status === "pending" || r.status === "needs_changes") && (
                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                  <Pressable
                    onPress={() => setStatus(r.id, "rejected")}
                    style={[styles.actionBtn, { borderColor: colors.borderStrong }]}
                    testID={`reject-post-${r.id}`}
                  >
                    <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>Reject</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setStatus(r.id, "approved")}
                    style={[styles.approve, { backgroundColor: colors.brandPrimary }]}
                    testID={`approve-post-${r.id}`}
                  >
                    <Ionicons name="checkmark" size={16} color={colors.onBrandPrimary} />
                    <Text style={{ color: colors.onBrandPrimary, fontSize: font.sm, fontWeight: "500" }}>Approve</Text>
                  </Pressable>
                </View>
              )}
              {r.status === "approved" && (
                <Pressable
                  onPress={() => setStatus(r.id, "published")}
                  style={[styles.approve, { backgroundColor: colors.brandPrimary, marginTop: spacing.md, alignSelf: "stretch" }]}
                >
                  <Ionicons name="paper-plane" size={16} color={colors.onBrandPrimary} />
                  <Text style={{ color: colors.onBrandPrimary, fontSize: font.sm, fontWeight: "500" }}>Publish now</Text>
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function toPostRequest(row: any): PostRequest {
  return {
    id: row.id,
    requesterName: row.contact_name || row.requester?.name || "Member",
    requesterAvatar: row.requesterAvatar || row.requester?.avatarUrl || null,
    targetGroupName: row.group_name || row.group?.name || "Group",
    title: row.title,
    description: row.description,
    category: row.category,
    posterUrl: row.poster_url,
    targetGroupId: row.group_id,
    publishDate: row.requested_publish_at || "Requested",
    expiryDate: row.expires_at || "Not set",
    contactPhone: row.contact_phone || "",
    contactEmail: row.contact_email || "",
    status: row.status,
    createdAt: row.created_at || "",
  };
}

function StatusBadge({ status }: { status: PostRequest["status"] }) {
  const { colors } = useTheme();
  const map: Record<PostRequest["status"], { c: string; label: string }> = {
    pending: { c: colors.warning, label: "PENDING" },
    approved: { c: colors.success, label: "APPROVED" },
    rejected: { c: colors.error, label: "REJECTED" },
    needs_changes: { c: colors.info, label: "CHANGES" },
    scheduled: { c: colors.info, label: "SCHEDULED" },
    published: { c: colors.success, label: "LIVE" },
    expired: { c: colors.muted, label: "EXPIRED" },
  };
  const m = map[status];
  return (
    <View style={{ backgroundColor: m.c + "22", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
      <Text style={{ color: m.c, fontSize: 10, fontWeight: "500", letterSpacing: 0.3 }}>{m.label}</Text>
    </View>
  );
}

function Meta({ icon, label, value }: { icon: any; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={14} color={colors.onSurfaceTertiary} />
      <View>
        <Text style={{ color: colors.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</Text>
        <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500" }} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { height: 34, paddingHorizontal: spacing.lg, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  card: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  poster: { width: "100%", aspectRatio: 16 / 10, borderRadius: radius.md, marginTop: spacing.xs },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.md },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, width: "46%" },
  actionBtn: { flex: 1, height: 40, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  approve: { flex: 1.2, height: 40, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
});
