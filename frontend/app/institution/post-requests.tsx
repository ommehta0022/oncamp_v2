import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import Avatar from "@/src/components/Avatar";
import EmptyState from "@/src/components/EmptyState";
import { api, getUserErrorMessage } from "@/src/lib/api";
import { formatAgo, formatShortDate, type InstitutionDashboardData } from "@/src/lib/institution";

const FILTERS = ["Pending", "Approved", "Rejected", "All"] as const;

type RequestStatus = "pending" | "approved" | "rejected" | "needs_changes" | "scheduled" | "published" | "expired";

type PostRequest = {
  id: string;
  title: string;
  description: string;
  posterUrl?: string;
  requesterName: string;
  requesterAvatar?: string;
  targetGroupId?: string;
  targetGroupName: string;
  category: string;
  publishDate: string;
  expiryDate: string;
  contactPhone: string;
  contactEmail: string;
  status: RequestStatus;
  createdAt: string;
};

export default function InstitutionPostRequests() {
  const { colors } = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<typeof FILTERS[number]>("Pending");
  const [dashboard, setDashboard] = useState<InstitutionDashboardData | null>(null);
  const [items, setItems] = useState<PostRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const groupsById = useMemo(() => {
    const map: Record<string, any> = {};
    (dashboard?.groups || []).forEach((group) => {
      if (group.id) map[group.id] = group;
    });
    return map;
  }, [dashboard?.groups]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await api.institutions.dashboard()) as InstitutionDashboardData;
      setDashboard(data);
      if (!data.institution?.id) {
        setItems([]);
        return;
      }
      const response = await api.institutions.postRequests(data.institution.id);
      setItems(Array.isArray(response) ? response.map((row) => toPostRequest(row, data.groups || [])) : []);
    } catch {
      setDashboard(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const approve = async (request: PostRequest) => {
    const institutionId = dashboard?.institution?.id;
    const targetGroupId = request.targetGroupId || dashboard?.groups?.[0]?.id;
    if (!institutionId || !targetGroupId) {
      Alert.alert("No target group", "Create or connect an official group before approving this request.");
      return;
    }
    setItems((current) => current.map((item) => item.id === request.id ? { ...item, status: "approved" } : item));
    try {
      await api.institutions.approvePostRequest(institutionId, request.id, targetGroupId);
      loadRequests();
    } catch (error) {
      Alert.alert("Approve failed", getUserErrorMessage(error, "Could not approve this request."));
      loadRequests();
    }
  };

  const reject = async (request: PostRequest) => {
    const institutionId = dashboard?.institution?.id;
    if (!institutionId) return;
    setItems((current) => current.map((item) => item.id === request.id ? { ...item, status: "rejected" } : item));
    try {
      await api.institutions.rejectPostRequest(institutionId, request.id);
      loadRequests();
    } catch (error) {
      Alert.alert("Reject failed", getUserErrorMessage(error, "Could not reject this request."));
      loadRequests();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="institution-post-requests-inbox">
      <Header title="Post requests" subtitle={`${items.filter((i) => i.status === "pending").length} pending`} onBack={() => router.back()} />

      <View style={{ flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.md }}>
        {FILTERS.map((f) => (
          <Pressable key={f} onPress={() => setFilter(f)} style={[styles.tab, { backgroundColor: filter === f ? colors.brandPrimary : colors.surfaceTertiary }]}>
            <Text style={{ color: filter === f ? colors.onBrandPrimary : colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>{f}</Text>
          </Pressable>
        ))}
      </View>

      {list.length === 0 ? (
        <EmptyState icon="checkmark-done-outline" title={loading ? "Loading requests" : "All caught up"} message="No post requests to review right now." />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.md }}>
          {list.map((r) => (
            <View key={r.id} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center", marginBottom: spacing.md }}>
                <Avatar uri={r.requesterAvatar} name={r.requesterName} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{r.requesterName}</Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>Requested {r.createdAt} - to {groupsById[r.targetGroupId || ""]?.name || r.targetGroupName}</Text>
                </View>
                <StatusBadge status={r.status} />
              </View>

              {r.posterUrl ? <Image source={{ uri: r.posterUrl }} style={styles.poster} contentFit="cover" /> : null}

              <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500", marginTop: spacing.md }}>{r.title}</Text>
              <Text style={{ color: colors.onSurfaceSecondary, fontSize: font.base, marginTop: 4, lineHeight: 20 }}>{r.description}</Text>

              <View style={styles.metaGrid}>
                <Meta icon="calendar-outline" label="Publish" value={r.publishDate} />
                <Meta icon="time-outline" label="Expires" value={r.expiryDate} />
                <Meta icon="pricetag-outline" label="Category" value={r.category} />
                <Meta icon="call-outline" label="Contact" value={r.contactPhone || r.contactEmail || "Not provided"} />
              </View>

              {(r.status === "pending" || r.status === "needs_changes") && (
                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                  <Pressable onPress={() => reject(r)} style={[styles.actionBtn, { borderColor: colors.borderStrong }]} testID={`reject-post-${r.id}`}>
                    <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>Reject</Text>
                  </Pressable>
                  <Pressable onPress={() => Alert.alert("Ask changes", "The backend does not expose a change-request endpoint for institution post requests yet.")} style={[styles.actionBtn, { borderColor: colors.borderStrong }]}>
                    <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>Ask changes</Text>
                  </Pressable>
                  <Pressable onPress={() => approve(r)} style={[styles.approve, { backgroundColor: colors.brandPrimary }]} testID={`approve-post-${r.id}`}>
                    <Ionicons name="checkmark" size={16} color={colors.onBrandPrimary} />
                    <Text style={{ color: colors.onBrandPrimary, fontSize: font.sm, fontWeight: "500" }}>Approve</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function toPostRequest(row: any, groups: any[]): PostRequest {
  const group = groups.find((item) => item.id === row.group_id);
  return {
    id: row.id,
    requesterName: row.contact_name || row.requester?.name || "Member",
    requesterAvatar: row.requesterAvatar || row.requester?.avatarUrl || null,
    targetGroupName: row.group_name || row.group?.name || group?.name || "Institution group",
    title: row.title || "Post request",
    description: row.description || "",
    category: row.category || "Post",
    posterUrl: row.poster_url || row.posterUrl,
    targetGroupId: row.group_id,
    publishDate: formatShortDate(row.requested_publish_at || row.requestedPublishAt),
    expiryDate: formatShortDate(row.expires_at || row.expiresAt),
    contactPhone: row.contact_phone || "",
    contactEmail: row.contact_email || "",
    status: row.status || "pending",
    createdAt: formatAgo(row.created_at || row.createdAt),
  };
}

function StatusBadge({ status }: { status: RequestStatus }) {
  const { colors } = useTheme();
  const map: Record<RequestStatus, { c: string; label: string }> = {
    pending: { c: colors.warning, label: "PENDING" },
    approved: { c: colors.success, label: "APPROVED" },
    rejected: { c: colors.error, label: "REJECTED" },
    needs_changes: { c: colors.info, label: "CHANGES" },
    scheduled: { c: colors.info, label: "SCHEDULED" },
    published: { c: colors.success, label: "LIVE" },
    expired: { c: colors.muted, label: "EXPIRED" },
  };
  const m = map[status] || map.pending;
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
      <View style={{ flex: 1 }}>
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
