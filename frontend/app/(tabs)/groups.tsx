import React, { useState, useMemo, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, RefreshControl } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import { usePinnedContent } from "@/src/context/PinnedContentProvider";
import Avatar from "@/src/components/Avatar";
import { api } from "@/src/lib/api";
import { cache } from "@/src/lib/cache";
import { useRole } from "@/src/context/RoleProvider";
import { normalizeGroup } from "@/src/lib/mappers";
import { useToast } from "@/src/components/Toast";

type Group = any;
const APP_ICON = require("../../assets/images/icon.png");
const FILTERS = ["All", "Unread", "Announcements", "Muted"];

type RowItem =
  | { type: "section"; id: string; label: string; count: number }
  | { type: "group"; id: string; group: Group; personalPinned: boolean };

export default function Groups() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { canCreateGroups } = useRole();
  const { showToast } = useToast();
  const { isGroupPinned, toggleGroupPin } = usePinnedContent();
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    setError(null);
    try {
      const cached = await cache.get("my_groups");
      if (cached) setGroups((cached as any[]).map(normalizeGroup));
      const response = await api.groups.listMine();
      const next = ((response as any).groups || response || []).map(normalizeGroup);
      setGroups(next);
      await cache.set("my_groups", next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your groups.");
    }
  }, []);

  useEffect(() => { void fetchGroups(); }, [fetchGroups]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGroups();
    setRefreshing(false);
  }, [fetchGroups]);

  const filtered = useMemo(() => {
    let list = groups;
    if (filter === "Unread") list = list.filter((group) => Number(group.unread || 0) > 0);
    else if (filter === "Announcements") list = list.filter((group) => group.category === "Official");
    else if (filter === "Muted") list = list.filter((group) => group.muted);
    const needle = query.trim().toLowerCase();
    if (needle) list = list.filter((group) => String(group.name || "").toLowerCase().includes(needle) || String(group.institution || "").toLowerCase().includes(needle));
    return list;
  }, [filter, groups, query]);

  const personalPinned = filtered.filter((group) => isGroupPinned(group.id));
  const serverPinned = filtered.filter((group) => !isGroupPinned(group.id) && group.pinned);
  const others = filtered.filter((group) => !isGroupPinned(group.id) && !group.pinned);
  const totalUnread = groups.reduce((sum, group) => sum + Number(group.unread || 0), 0);
  const pinnedCount = groups.reduce((count, group) => count + (isGroupPinned(group.id) ? 1 : 0), 0);

  const data: RowItem[] = [];
  if (personalPinned.length > 0) {
    data.push({ type: "section", id: "s-personal", label: "Your pinned groups", count: personalPinned.length });
    personalPinned.forEach((group) => data.push({ type: "group", id: String(group.id), group, personalPinned: true }));
  }
  if (serverPinned.length > 0) {
    data.push({ type: "section", id: "s-featured", label: "Featured by campus", count: serverPinned.length });
    serverPinned.forEach((group) => data.push({ type: "group", id: String(group.id), group, personalPinned: false }));
  }
  if (others.length > 0) {
    data.push({ type: "section", id: "s-all", label: filter === "All" ? "Your communities" : filter, count: others.length });
    others.forEach((group) => data.push({ type: "group", id: String(group.id), group, personalPinned: false }));
  }

  const onToggleGroupPin = useCallback(async (group: Group) => {
    const next = await toggleGroupPin(group.id);
    showToast({ message: next ? `${group.name} pinned for you` : `${group.name} unpinned`, variant: "success" });
  }, [showToast, toggleGroupPin]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="groups-screen">
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.heroBrand}>
                  <Image source={APP_ICON} style={styles.heroIcon} contentFit="cover" />
                  <View>
                    <Text style={styles.heroEyebrow}>ONCAMPUS COMMUNITIES</Text>
                    <Text style={styles.heroTitle}>Groups</Text>
                  </View>
                </View>
                <Pressable style={styles.heroAction} testID="groups-search-btn" onPress={() => router.push("/search")} accessibilityRole="button" accessibilityLabel="Search communities">
                  <Ionicons name="search" size={20} color="#FFFFFF" />
                </Pressable>
              </View>
              <Text style={styles.heroCopy}>A refined space for your classes, clubs, announcements and people that matter.</Text>
              <View style={styles.metricsRow}>
                <Metric icon="people-outline" value={groups.length} label="joined" />
                <View style={styles.metricDivider} />
                <Metric icon="sparkles-outline" value={pinnedCount} label="pinned" />
                <View style={styles.metricDivider} />
                <Metric icon="chatbubble-ellipses-outline" value={totalUnread} label="unread" />
              </View>
            </LinearGradient>

            <View style={[styles.searchBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.onSurfaceTertiary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search your communities"
                placeholderTextColor={colors.muted}
                style={{ flex: 1, color: colors.onSurface, fontSize: font.base, marginLeft: spacing.sm }}
              />
              {query.length > 0 && <Pressable onPress={() => setQuery("")} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.onSurfaceTertiary} /></Pressable>}
            </View>

            <FlatList
              horizontal
              data={FILTERS}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterList}
              renderItem={({ item }) => {
                const active = filter === item;
                const unreadCount = item === "Unread" ? totalUnread : 0;
                return (
                  <Pressable
                    onPress={() => setFilter(item)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.onSurface : colors.surfaceSecondary,
                        borderColor: active ? colors.onSurface : colors.borderStrong,
                      },
                    ]}
                    testID={`groups-filter-${item.toLowerCase()}`}
                  >
                    <Text style={{ color: active ? colors.surface : colors.onSurface, fontSize: font.base, fontWeight: "700" }}>{item}</Text>
                    {unreadCount > 0 && <View style={[styles.chipBadge, { backgroundColor: active ? colors.luxuryGold : colors.brandPrimary }]}><Text style={{ color: active ? "#171109" : colors.onBrandPrimary, fontSize: 10, fontWeight: "800" }}>{unreadCount}</Text></View>}
                  </Pressable>
                );
              }}
            />
          </>
        }
        renderItem={({ item }) => {
          if (item.type === "section") {
            return (
              <View style={styles.sectionHead}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <View style={[styles.sectionDot, { backgroundColor: item.id === "s-personal" ? colors.luxuryGold : colors.luxuryTeal }]} />
                  <Text style={[styles.sectionLabel, { color: colors.onSurface }]}>{item.label}</Text>
                </View>
                <Text style={[styles.sectionCount, { color: colors.onSurfaceTertiary }]}>{item.count}</Text>
              </View>
            );
          }
          return (
            <GroupRow
              group={item.group}
              personalPinned={item.personalPinned}
              onPress={() => router.push(`/group/${item.group.id}`)}
              onTogglePin={() => { void onToggleGroupPin(item.group); }}
            />
          );
        }}
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.luxuryGoldSoft }]}><Ionicons name={error ? "cloud-offline-outline" : "people-circle-outline"} size={32} color={colors.luxuryGold} /></View>
            <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "800", marginTop: spacing.md }}>{error ? "Couldn’t load groups" : "No matching groups"}</Text>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base, lineHeight: 20, textAlign: "center", marginTop: 5 }}>{error || "Try another filter or search term."}</Text>
            {error ? <Pressable onPress={() => void fetchGroups()} style={[styles.retry, { backgroundColor: colors.brandPrimary }]}><Text style={{ color: colors.onBrandPrimary, fontWeight: "800" }}>Try again</Text></Pressable> : null}
          </View>
        }
      />

      {canCreateGroups && (
        <Pressable onPress={() => router.push("/create-group")} style={[styles.fab, { backgroundColor: colors.luxuryGold, bottom: insets.bottom + 92 }]} testID="new-group-fab" accessibilityRole="button" accessibilityLabel="Create a new group">
          <Ionicons name="add" size={25} color="#171109" />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

function Metric({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: number; label: string }) {
  return <View style={styles.metric}><Ionicons name={icon} size={15} color="#D9C486" /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function GroupRow({ group, personalPinned, onPress, onTogglePin }: { group: Group; personalPinned: boolean; onPress: () => void; onTogglePin: () => void }) {
  const { colors } = useTheme();
  const hasUnread = Number(group.unread || 0) > 0;
  const lastMsg = String(group.lastMessage || group.description || "No recent message");
  const senderMatch = lastMsg.match(/^([^:]+):\s(.*)$/);
  const sender = senderMatch?.[1];
  const msgBody = senderMatch?.[2] || lastMsg;

  const categoryColors: Record<string, string> = {
    Batch: colors.info,
    Clubs: colors.brandPrimary,
    Official: colors.luxuryGold,
    Events: colors.warning,
    Study: colors.luxuryTeal,
    Sports: colors.success,
    Tech: colors.info,
    Arts: colors.brandSecondary,
    Career: colors.brandPrimary,
  };
  const catColor = categoryColors[String(group.category || "")] || colors.luxuryTeal;

  return (
    <Pressable
      onPress={onPress}
      testID={`group-row-${group.id}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.surfaceTertiary : colors.surfaceSecondary,
          borderColor: personalPinned ? colors.luxuryGold : hasUnread ? `${catColor}66` : colors.border,
          shadowColor: colors.shadow,
        },
      ]}
    >
      <View style={[styles.leftBar, { backgroundColor: personalPinned ? colors.luxuryGold : catColor, opacity: hasUnread || personalPinned ? 1 : 0.4 }]} />
      <View style={[styles.avatarRing, { borderColor: `${catColor}55` }]}><Avatar uri={group.image} name={group.name} size={52} verified={group.verified} /></View>
      <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
        <View style={styles.rowTitleLine}>
          <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: hasUnread ? "800" : "700", flex: 1 }} numberOfLines={1}>{group.name}</Text>
          {!!group.lastMessageAt && <Text style={{ color: hasUnread ? catColor : colors.onSurfaceTertiary, fontSize: 11, fontWeight: hasUnread ? "800" : "500" }}>{group.lastMessageAt}</Text>}
        </View>
        <View style={styles.metaLine}>
          <View style={[styles.catPill, { backgroundColor: `${catColor}1F` }]}><Text style={{ color: catColor, fontSize: 9, fontWeight: "900", letterSpacing: 0.5 }}>{String(group.category || "GROUP").toUpperCase()}</Text></View>
          {personalPinned && <View style={[styles.catPill, { backgroundColor: colors.luxuryGoldSoft }]}><Ionicons name="pin" size={10} color={colors.luxuryGold} /><Text style={{ color: colors.luxuryGold, fontSize: 9, fontWeight: "900" }}>YOURS</Text></View>}
          {group.pinned && !personalPinned && <View style={[styles.catPill, { backgroundColor: colors.highlight }]}><Ionicons name="sparkles" size={10} color={colors.luxuryTeal} /><Text style={{ color: colors.luxuryTeal, fontSize: 9, fontWeight: "900" }}>FEATURED</Text></View>}
        </View>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, lineHeight: 18 }} numberOfLines={1}>{sender ? <Text style={{ color: colors.onSurface, fontWeight: "800" }}>{sender}: </Text> : null}{msgBody}</Text>
        <View style={styles.bottomMeta}>
          <View style={styles.memberMeta}><Ionicons name="people-outline" size={12} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 11 }}>{Number(group.members || 0).toLocaleString()}</Text></View>
          {group.role && group.role !== "member" && <Text style={{ color: colors.luxuryGold, fontSize: 10, fontWeight: "800" }}>{String(group.role).toUpperCase()}</Text>}
          {group.muted && <Ionicons name="volume-mute-outline" size={13} color={colors.muted} />}
          <View style={{ flex: 1 }} />
          {hasUnread && <View style={[styles.unreadBadge, { backgroundColor: catColor }]}><Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>{Number(group.unread || 0) > 99 ? "99+" : group.unread}</Text></View>}
        </View>
      </View>
      <Pressable onPress={(event) => { event.stopPropagation(); onTogglePin(); }} hitSlop={8} style={[styles.pinButton, { backgroundColor: personalPinned ? colors.luxuryGoldSoft : colors.surfaceTertiary }]} accessibilityRole="button" accessibilityLabel={personalPinned ? `Unpin ${group.name}` : `Pin ${group.name}`}>
        <Ionicons name={personalPinned ? "pin" : "pin-outline"} size={17} color={personalPinned ? colors.luxuryGold : colors.onSurfaceTertiary} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: spacing.sm, borderRadius: 28, padding: 20, minHeight: 214, justifyContent: "space-between", overflow: "hidden" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroBrand: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroIcon: { width: 46, height: 46, borderRadius: 15 },
  heroEyebrow: { color: "#D9C486", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  heroTitle: { color: "#FFFFFF", fontSize: 31, fontWeight: "900", letterSpacing: -0.8, marginTop: 1 },
  heroAction: { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  heroCopy: { color: "rgba(255,255,255,0.78)", fontSize: 13, lineHeight: 19, maxWidth: 330, marginTop: 18 },
  metricsRow: { flexDirection: "row", alignItems: "center", marginTop: 22, backgroundColor: "rgba(2,10,20,0.18)", borderRadius: 16, paddingVertical: 10 },
  metric: { flex: 1, alignItems: "center" },
  metricValue: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", marginTop: 2 },
  metricLabel: { color: "rgba(255,255,255,0.62)", fontSize: 9, fontWeight: "700", letterSpacing: 0.5, marginTop: 1 },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: "rgba(255,255,255,0.18)" },
  searchBox: { flexDirection: "row", alignItems: "center", height: 48, borderRadius: radius.lg, paddingHorizontal: spacing.md, borderWidth: 1, marginTop: spacing.lg },
  filterList: { gap: spacing.sm, alignItems: "center", paddingVertical: spacing.md },
  chip: { height: 38, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  chipBadge: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg, marginBottom: spacing.sm, paddingHorizontal: 3 },
  sectionDot: { width: 7, height: 7, borderRadius: 4 },
  sectionLabel: { fontSize: 13, fontWeight: "900", letterSpacing: -0.1 },
  sectionCount: { fontSize: 11, fontWeight: "800" },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "center", padding: spacing.md, paddingRight: 46, borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing.sm, position: "relative", overflow: "hidden", shadowOpacity: 0.05, shadowRadius: 13, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  leftBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  avatarRing: { padding: 2, borderRadius: 30, borderWidth: 1 },
  rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  metaLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 },
  catPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill },
  bottomMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  memberMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  unreadBadge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  pinButton: { position: "absolute", right: 10, top: 10, width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  empty: { marginTop: spacing.lg, padding: spacing["2xl"], borderRadius: radius.lg, borderWidth: 1, alignItems: "center" },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  retry: { marginTop: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.md },
  fab: { position: "absolute", right: spacing.xl, width: 56, height: 56, borderRadius: 20, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 8 },
});
