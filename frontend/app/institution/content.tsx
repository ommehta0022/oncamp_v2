import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import {
  institutionContentApi,
  InstitutionContentRequest,
  InstitutionContentStatus,
} from "@/src/lib/institutionContentApi";

const FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "changes_requested", label: "Changes" },
  { key: "approved", label: "Approved" },
  { key: "published", label: "Published" },
  { key: "rejected", label: "Rejected" },
];

export default function InstitutionContentStudio() {
  const { colors } = useTheme();
  const router = useRouter();
  const [box, setBox] = useState<"inbox" | "sent">("inbox");
  const [status, setStatus] = useState("all");
  const [items, setItems] = useState<InstitutionContentRequest[]>([]);
  const [overview, setOverview] = useState({ inboxPending: 0, sentPending: 0, approvedReady: 0, drafts: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [nextOverview, nextItems] = await Promise.all([
        institutionContentApi.overview(),
        institutionContentApi.requests(box, status),
      ]);
      setOverview(nextOverview);
      setItems(Array.isArray(nextItems) ? nextItems : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Content Studio.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [box, status]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { void load(); }, [box, status, load]);

  const filtered = useMemo(() => {
    if (status !== "published") return items;
    return items.filter((item) => item.status === "published" || item.status === "partially_published");
  }, [items, status]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Content Studio" subtitle="Institution publishing & collaboration" onBack={() => router.back()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.brandPrimary} />}
      >
        <View style={styles.heroActions}>
          <ActionCard icon="create" title="Create post" subtitle="Advanced editor" onPress={() => router.push("/institution/content-create" as any)} primary />
          <ActionCard icon="document-text-outline" title="Drafts" subtitle={`${overview.drafts} saved`} onPress={() => router.push("/institution/content-create?drafts=1" as any)} />
        </View>

        <View style={styles.metricRow}>
          <Metric label="Inbox" value={overview.inboxPending} icon="mail-unread-outline" />
          <Metric label="Sent" value={overview.sentPending} icon="paper-plane-outline" />
          <Metric label="Ready" value={overview.approvedReady} icon="checkmark-circle-outline" />
        </View>

        <View style={[styles.segment, { backgroundColor: colors.surfaceTertiary }]}>
          <Segment label="Incoming" count={overview.inboxPending} active={box === "inbox"} onPress={() => setBox("inbox")} />
          <Segment label="Sent" count={overview.sentPending} active={box === "sent"} onPress={() => setBox("sent")} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((filter) => (
            <Pressable
              key={filter.key}
              onPress={() => setStatus(filter.key)}
              style={[styles.filterChip, { backgroundColor: status === filter.key ? colors.brandPrimary : colors.surfaceSecondary, borderColor: colors.border }]}
            >
              <Text style={{ color: status === filter.key ? colors.onBrandPrimary : colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>{filter.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {loading && items.length === 0 ? (
            <View style={{ paddingVertical: 60, alignItems: "center" }}><ActivityIndicator color={colors.brandPrimary} /><Text style={{ color: colors.onSurfaceTertiary, marginTop: spacing.md }}>Loading collaboration requests…</Text></View>
          ) : error && items.length === 0 ? (
            <EmptyState icon="cloud-offline-outline" title="Could not load requests" message={error} actionLabel="Retry" onAction={() => void load()} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={box === "inbox" ? "mail-open-outline" : "paper-plane-outline"}
              title={box === "inbox" ? "No incoming requests" : "No sent requests"}
              message={box === "inbox" ? "Requests from other verified institutions will appear here." : "Create a post and choose Request another institution to start collaboration."}
              actionLabel={box === "sent" ? "Create request" : undefined}
              onAction={box === "sent" ? () => router.push("/institution/content-create" as any) : undefined}
            />
          ) : filtered.map((item) => (
            <RequestCard key={item.id} item={item} box={box} onPress={() => router.push(`/institution/content-request/${item.id}` as any)} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionCard({ icon, title, subtitle, onPress, primary }: { icon: any; title: string; subtitle: string; onPress: () => void; primary?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.actionCard, { backgroundColor: primary ? colors.brandPrimary : colors.surfaceSecondary, borderColor: primary ? colors.brandPrimary : colors.border }]}>
      <View style={[styles.actionIcon, { backgroundColor: primary ? "rgba(255,255,255,.16)" : colors.brandTertiary }]}>
        <Ionicons name={icon} size={22} color={primary ? colors.onBrandPrimary : colors.brandPrimary} />
      </View>
      <Text style={{ color: primary ? colors.onBrandPrimary : colors.onSurface, fontSize: font.base, fontWeight: "600", marginTop: spacing.sm }}>{title}</Text>
      <Text style={{ color: primary ? "rgba(255,255,255,.78)" : colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{subtitle}</Text>
    </Pressable>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: any }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.metric, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      <Ionicons name={icon} size={18} color={colors.brandPrimary} />
      <Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: "600", marginTop: 6 }}>{value}</Text>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{label}</Text>
    </View>
  );
}

function Segment({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.segmentBtn, { backgroundColor: active ? colors.surface : "transparent" }]}>
      <Text style={{ color: active ? colors.onSurface : colors.onSurfaceTertiary, fontSize: font.base, fontWeight: "600" }}>{label}</Text>
      {count > 0 && <View style={[styles.countBadge, { backgroundColor: colors.brandPrimary }]}><Text style={{ color: colors.onBrandPrimary, fontSize: 10, fontWeight: "700" }}>{count > 99 ? "99+" : count}</Text></View>}
    </Pressable>
  );
}

function RequestCard({ item, box, onPress }: { item: InstitutionContentRequest; box: "inbox" | "sent"; onPress: () => void }) {
  const { colors } = useTheme();
  const peer = box === "inbox" ? item.sourceInstitution : item.targetInstitution;
  return (
    <Pressable onPress={onPress} style={[styles.requestCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={[styles.peerIcon, { backgroundColor: colors.brandTertiary }]}><Ionicons name="business" size={18} color={colors.brandPrimary} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }} numberOfLines={1}>{box === "inbox" ? "From" : "To"} {peer?.name || "Institution"}</Text>
          <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "600", marginTop: 2 }} numberOfLines={1}>{item.title}</Text>
        </View>
        <StatusBadge status={item.status} />
      </View>
      <Text style={{ color: colors.onSurfaceSecondary, fontSize: font.sm, lineHeight: 19, marginTop: spacing.md }} numberOfLines={2}>{item.content}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.md }}>
        <Text style={{ flex: 1, color: colors.muted, fontSize: 11 }}>Revision {item.revision || 1} · {prettyDate(item.updated_at || item.created_at)}</Text>
        <Ionicons name="chevron-forward" size={17} color={colors.onSurfaceTertiary} />
      </View>
      {!!item.latest_message && <View style={[styles.latestMessage, { backgroundColor: colors.surfaceTertiary }]}><Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.brandPrimary} /><Text style={{ flex: 1, color: colors.onSurfaceSecondary, fontSize: font.sm }} numberOfLines={2}>{item.latest_message}</Text></View>}
    </Pressable>
  );
}

function StatusBadge({ status }: { status: InstitutionContentStatus }) {
  const { colors } = useTheme();
  const map: Record<string, { label: string; color: string }> = {
    pending: { label: "PENDING", color: colors.warning },
    changes_requested: { label: "CHANGES", color: colors.info },
    revised: { label: "REVISED", color: colors.info },
    approved: { label: "APPROVED", color: colors.success },
    rejected: { label: "REJECTED", color: colors.error },
    withdrawn: { label: "WITHDRAWN", color: colors.muted },
    partially_published: { label: "PARTIAL", color: colors.info },
    published: { label: "PUBLISHED", color: colors.success },
    expired: { label: "EXPIRED", color: colors.muted },
    draft: { label: "DRAFT", color: colors.muted },
  };
  const value = map[status] || map.pending;
  return <View style={{ backgroundColor: value.color + "22", borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 }}><Text style={{ color: value.color, fontSize: 9, fontWeight: "700" }}>{value.label}</Text></View>;
}

function prettyDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const styles = StyleSheet.create({
  heroActions: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  actionCard: { flex: 1, borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, minHeight: 126 },
  actionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  metricRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  metric: { flex: 1, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  segment: { marginHorizontal: spacing.lg, marginTop: spacing.xl, padding: 4, borderRadius: radius.pill, flexDirection: "row" },
  segmentBtn: { flex: 1, height: 40, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  countBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  filters: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  filterChip: { height: 34, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center" },
  requestCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  peerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  latestMessage: { marginTop: spacing.md, padding: spacing.sm, borderRadius: radius.md, flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
});
