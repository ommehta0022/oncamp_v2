import React, { useState, useMemo, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, RefreshControl } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
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
  | { type: "section"; id: string; label: string }
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

  const data: RowItem[] = [];
  if (personalPinned.length > 0) {
    data.push({ type: "section", id: "s-personal", label: "Pinned" });
    personalPinned.forEach((group) => data.push({ type: "group", id: String(group.id), group, personalPinned: true }));
  }
  if (serverPinned.length > 0) {
    data.push({ type: "section", id: "s-featured", label: "Campus picks" });
    serverPinned.forEach((group) => data.push({ type: "group", id: String(group.id), group, personalPinned: false }));
  }
  if (others.length > 0) {
    data.push({ type: "section", id: "s-all", label: filter === "All" ? "Your groups" : filter });
    others.forEach((group) => data.push({ type: "group", id: String(group.id), group, personalPinned: false }));
  }

  const onToggleGroupPin = useCallback(async (group: Group) => {
    const next = await toggleGroupPin(group.id);
    showToast({ message: next ? `${group.name} pinned` : `${group.name} unpinned`, variant: "success" });
  }, [showToast, toggleGroupPin]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="groups-screen">
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 132 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.luxuryGold} colors={[colors.luxuryGold]} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <View style={styles.titleRow}>
              <View style={styles.brandRow}>
                <Image source={APP_ICON} style={styles.brandIcon} contentFit="cover" />
                <View>
                  <Text style={[styles.title, { color: colors.onSurface }]}>Groups</Text>
                  <Text style={[styles.subtitle, { color: colors.onSurfaceTertiary }]}>Communities you belong to</Text>
                </View>
              </View>
              <Pressable
                style={[styles.iconButton, { backgroundColor: colors.surfaceTertiary }]}
                testID="groups-search-btn"
                onPress={() => router.push("/search")}
                accessibilityRole="button"
                accessibilityLabel="Search communities"
              >
                <Ionicons name="search" size={20} color={colors.onSurface} />
              </Pressable>
            </View>

            <View style={[styles.searchBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.onSurfaceTertiary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search groups"
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
                  <Pressable onPress={() => setFilter(item)} style={styles.filterButton} testID={`groups-filter-${item.toLowerCase()}`}>
                    <Text style={[styles.filterText, { color: active ? colors.onSurface : colors.onSurfaceTertiary, fontWeight: active ? "800" : "600" }]}>{item}</Text>
                    {unreadCount > 0 && <View style={[styles.filterBadge, { backgroundColor: colors.luxuryGold }]}><Text style={styles.filterBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text></View>}
                    <View style={[styles.filterUnderline, { backgroundColor: active ? colors.luxuryGold : "transparent" }]} />
                  </Pressable>
                );
              }}
            />
          </View>
        }
        renderItem={({ item }) => {
          if (item.type === "section") {
            return <Text style={[styles.sectionLabel, { color: colors.onSurfaceTertiary }]}>{item.label}</Text>;
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
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.luxuryGoldSoft }]}><Ionicons name={error ? "cloud-offline-outline" : "people-outline"} size={28} color={colors.luxuryGold} /></View>
            <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "800", marginTop: spacing.md }}>{error ? "Couldn’t load groups" : "No matching groups"}</Text>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base, lineHeight: 20, textAlign: "center", marginTop: 5 }}>{error || "Try another filter or search term."}</Text>
            {error ? <Pressable onPress={() => void fetchGroups()} style={[styles.retry, { backgroundColor: colors.onSurface }]}><Text style={{ color: colors.surface, fontWeight: "800" }}>Try again</Text></Pressable> : null}
          </View>
        }
      />

      {canCreateGroups && (
        <Pressable onPress={() => router.push("/create-group")} style={[styles.fab, { backgroundColor: colors.onSurface, bottom: insets.bottom + 88 }]} testID="new-group-fab" accessibilityRole="button" accessibilityLabel="Create a new group">
          <Ionicons name="add" size={25} color={colors.surface} />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

function GroupRow({ group, personalPinned, onPress, onTogglePin }: { group: Group; personalPinned: boolean; onPress: () => void; onTogglePin: () => void }) {
  const { colors } = useTheme();
  const hasUnread = Number(group.unread || 0) > 0;
  const lastMsg = String(group.lastMessage || group.description || "No recent message");
  const senderMatch = lastMsg.match(/^([^:]+):\s(.*)$/);
  const sender = senderMatch?.[1];
  const msgBody = senderMatch?.[2] || lastMsg;

  return (
    <Pressable
      onPress={onPress}
      testID={`group-row-${group.id}`}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceTertiary : "transparent", borderBottomColor: colors.divider }]}
    >
      <Avatar uri={group.image} name={group.name} size={52} verified={group.verified} />
      <View style={styles.rowBody}>
        <View style={styles.rowTitleLine}>
          <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: hasUnread ? "800" : "700", flex: 1 }} numberOfLines={1}>{group.name}</Text>
          {!!group.lastMessageAt && <Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "600" }}>{group.lastMessageAt}</Text>}
        </View>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, lineHeight: 18 }} numberOfLines={1}>{sender ? <Text style={{ color: colors.onSurface, fontWeight: "700" }}>{sender}: </Text> : null}{msgBody}</Text>
        <View style={styles.bottomMeta}>
          {!!group.category && <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700" }}>{String(group.category)}</Text>}
          {!!group.category && <Text style={{ color: colors.muted }}>·</Text>}
          <Ionicons name="people-outline" size={12} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 10.5 }}>{Number(group.members || 0).toLocaleString()}</Text>
          {group.role && group.role !== "member" && <><Text style={{ color: colors.muted }}>·</Text><Text style={{ color: colors.luxuryGold, fontSize: 10, fontWeight: "800" }}>{String(group.role).toUpperCase()}</Text></>}
          {group.muted && <Ionicons name="volume-mute-outline" size={13} color={colors.muted} />}
        </View>
      </View>
      <View style={styles.trailing}>
        <Pressable onPress={(event) => { event.stopPropagation(); onTogglePin(); }} hitSlop={8} style={styles.pinButton} accessibilityRole="button" accessibilityLabel={personalPinned ? `Unpin ${group.name}` : `Pin ${group.name}`}>
          <Ionicons name={personalPinned ? "pin" : "pin-outline"} size={17} color={personalPinned ? colors.luxuryGold : colors.onSurfaceTertiary} />
        </Pressable>
        {hasUnread && <View style={[styles.unreadBadge, { backgroundColor: colors.luxuryGold }]}><Text style={styles.unreadText}>{Number(group.unread || 0) > 99 ? "99+" : group.unread}</Text></View>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 2 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  brandIcon: { width: 38, height: 38, borderRadius: 12 },
  title: { fontSize: 28, fontWeight: "900", letterSpacing: -0.8 },
  subtitle: { fontSize: 12, marginTop: 1 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  searchBox: { flexDirection: "row", alignItems: "center", height: 46, borderRadius: 15, paddingHorizontal: spacing.md, borderWidth: StyleSheet.hairlineWidth, marginTop: spacing.lg },
  filterList: { gap: spacing.lg, alignItems: "center", paddingTop: 14, paddingBottom: 8 },
  filterButton: { paddingVertical: 8, minHeight: 38, justifyContent: "center", flexDirection: "row", alignItems: "center", gap: 6, position: "relative" },
  filterText: { fontSize: 13.5 },
  filterBadge: { minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  filterBadgeText: { color: "#17130E", fontSize: 9, fontWeight: "900" },
  filterUnderline: { position: "absolute", left: 2, right: 2, bottom: 0, height: 2, borderRadius: 1 },
  sectionLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", paddingHorizontal: spacing.lg, paddingTop: 22, paddingBottom: 8 },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "center", minHeight: 78, paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowBody: { flex: 1, gap: 4, minWidth: 0 },
  rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  bottomMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  trailing: { width: 34, alignItems: "center", gap: 8 },
  pinButton: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  unreadBadge: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  unreadText: { color: "#17130E", fontSize: 9.5, fontWeight: "900" },
  empty: { paddingHorizontal: spacing.xl, paddingVertical: 54, alignItems: "center" },
  emptyIcon: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  retry: { marginTop: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.pill },
  fab: { position: "absolute", right: spacing.xl, width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
});
