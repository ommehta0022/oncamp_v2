import React, { useState, useMemo, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, RefreshControl } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import { api } from "@/src/lib/api";
import { cache } from "@/src/lib/cache";
import { useRole } from "@/src/context/RoleProvider";
import { normalizeGroup } from "@/src/lib/mappers";

type Group = any;
const FILTERS = ["All", "Unread", "Announcements", "Muted"] as const;

type RowItem =
  | { type: "section"; id: string; label: string }
  | { type: "group"; id: string; group: Group };

function institutionName(group: Group) {
  if (typeof group?.institution === "string") return group.institution;
  return group?.institution?.name || group?.institutionName || group?.campusName || "";
}

export default function Groups() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { canCreateGroups } = useRole();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
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
    else if (filter === "Announcements") list = list.filter((group) => group.official || group.category === "Official");
    else if (filter === "Muted") list = list.filter((group) => group.muted);

    const value = query.trim().toLowerCase();
    if (value) {
      list = list.filter((group) => [group.name, group.description, institutionName(group), group.category]
        .some((candidate) => String(candidate || "").toLowerCase().includes(value)));
    }
    return list;
  }, [filter, groups, query]);

  const pinned = filtered.filter((group) => group.pinned);
  const others = filtered.filter((group) => !group.pinned);
  const totalUnread = groups.reduce((sum, group) => sum + Number(group.unread || 0), 0);

  const data: RowItem[] = [];
  if (pinned.length > 0) {
    data.push({ type: "section", id: "s-pinned", label: "Pinned" });
    pinned.forEach((group) => data.push({ type: "group", id: group.id, group }));
  }
  if (others.length > 0) {
    data.push({ type: "section", id: "s-all", label: filter === "All" ? "Your groups" : filter });
    others.forEach((group) => data.push({ type: "group", id: group.id, group }));
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="groups-screen">
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Groups</Text>
      </View>

      <View style={{ paddingHorizontal: spacing.lg }}>
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.onSurfaceTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search groups or universities"
            placeholderTextColor={colors.muted}
            style={{ flex: 1, color: colors.onSurface, fontSize: font.base, marginLeft: spacing.sm, paddingVertical: 0 }}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityLabel="Clear group search">
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.filtersWrap}>
        <FlatList
          horizontal
          data={FILTERS as readonly string[]}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          renderItem={({ item }) => {
            const active = filter === item;
            const unreadCount = item === "Unread" ? totalUnread : 0;
            return (
              <Pressable
                onPress={() => setFilter(item as (typeof FILTERS)[number])}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.surfaceInverse : colors.surface,
                    borderColor: active ? colors.surfaceInverse : colors.borderStrong,
                  },
                ]}
                testID={`groups-filter-${item.toLowerCase()}`}
              >
                <Text style={{ color: active ? colors.onSurfaceInverse : colors.onSurface, fontSize: font.sm, fontWeight: "700" }}>{item}</Text>
                {unreadCount > 0 ? (
                  <View style={[styles.chipBadge, { backgroundColor: active ? `${colors.onSurfaceInverse}26` : colors.brandSecondary }]}>
                    <Text style={{ color: active ? colors.onSurfaceInverse : colors.onBrandSecondary, fontSize: 10, fontWeight: "700" }}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => item.type === "section"
          ? <SectionHeader label={item.label} />
          : <GroupRow group={item.group} onPress={() => router.push(`/group/${item.group.id}`)} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceTertiary }]}>
              <Ionicons name={error ? "cloud-offline-outline" : "people-outline"} size={26} color={colors.onSurfaceTertiary} />
            </View>
            <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "700", marginTop: spacing.md }}>
              {error ? "Groups unavailable" : query ? "No matching groups" : "No groups here yet"}
            </Text>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base, marginTop: 5, textAlign: "center", lineHeight: 20 }}>
              {error || (query ? "Try a different group or university name." : "Joined university groups will appear here.")}
            </Text>
            {error ? (
              <Pressable onPress={() => void fetchGroups()} style={[styles.retry, { borderColor: colors.borderStrong }]}>
                <Text style={{ color: colors.onSurface, fontWeight: "600" }}>Try again</Text>
              </Pressable>
            ) : null}
          </View>
        }
      />

      {canCreateGroups ? (
        <Pressable
          onPress={() => router.push("/create-group")}
          style={[styles.fab, { backgroundColor: colors.brandPrimary, bottom: insets.bottom + 88 }]}
          testID="new-group-fab"
          accessibilityLabel="Create group"
        >
          <Ionicons name="add" size={25} color={colors.onBrandPrimary} />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

function SectionHeader({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHead}>
      <Text style={[styles.sectionLabel, { color: colors.onSurfaceTertiary }]}>{label}</Text>
    </View>
  );
}

function GroupRow({ group, onPress }: { group: Group; onPress: () => void }) {
  const { colors } = useTheme();
  const hasUnread = Number(group.unread || 0) > 0;
  const campus = institutionName(group);
  const lastMessage = String(group.lastMessage || group.description || "Open group").trim();
  const senderMatch = lastMessage.match(/^([^:]+):\s(.*)$/);
  const sender = senderMatch?.[1];
  const messageBody = senderMatch?.[2] || lastMessage;
  const memberCount = Number(group.memberCount || group.members || 0);

  return (
    <Pressable
      onPress={onPress}
      testID={`group-row-${group.id}`}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceTertiary : "transparent", borderBottomColor: colors.divider }]}
    >
      <Avatar uri={group.avatarUrl || group.image} name={group.name} size={54} verified={Boolean(group.official || group.verified)} />

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <View style={styles.nameWrap}>
            <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: hasUnread ? "700" : "600", flex: 1 }} numberOfLines={1}>{group.name}</Text>
            {group.pinned ? <Ionicons name="pin" size={12} color={colors.onSurfaceTertiary} /> : null}
          </View>
          {!!group.lastMessageAt && <Text style={{ color: colors.muted, fontSize: 11 }}>{group.lastMessageAt}</Text>}
        </View>

        {!!campus && <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "500" }} numberOfLines={1}>{campus}</Text>}

        <View style={styles.messageRow}>
          <Text style={{ color: hasUnread ? colors.onSurface : colors.onSurfaceTertiary, fontSize: font.sm, flex: 1 }} numberOfLines={1}>
            {sender ? <Text style={{ fontWeight: "600" }}>{sender}: </Text> : null}{messageBody}
          </Text>
          {hasUnread ? (
            <View style={[styles.unreadBadge, { backgroundColor: colors.brandSecondary }]}>
              <Text style={{ color: colors.onBrandSecondary, fontSize: 10, fontWeight: "800" }}>{Number(group.unread || 0) > 99 ? "99+" : group.unread}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          <Text style={{ color: colors.muted, fontSize: 11 }}>{memberCount.toLocaleString()} members</Text>
          {group.category ? <Text style={{ color: colors.muted, fontSize: 11 }}>• {group.category}</Text> : null}
          {group.role && group.role !== "member" ? <Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "600" }}>• {String(group.role).replace("_", " ")}</Text> : null}
          {group.muted ? <Ionicons name="volume-mute-outline" size={13} color={colors.muted} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  title: { fontSize: 29, fontWeight: "700", letterSpacing: -0.55 },
  searchBox: { flexDirection: "row", alignItems: "center", height: 44, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1 },
  filtersWrap: { height: 54, marginTop: spacing.sm },
  filters: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" },
  chip: { height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  chipBadge: { minWidth: 19, height: 19, paddingHorizontal: 5, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sectionHead: { paddingTop: spacing.lg, paddingBottom: 2 },
  sectionLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.2 },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "center", paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  rowBody: { flex: 1, gap: 4 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  nameWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  messageRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  unreadBadge: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  empty: { paddingHorizontal: spacing.xl, paddingVertical: spacing["3xl"], alignItems: "center" },
  emptyIcon: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  retry: { marginTop: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1 },
  fab: { position: "absolute", right: spacing.lg, width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 7, elevation: 5 },
});
