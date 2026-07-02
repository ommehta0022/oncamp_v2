import React, { useState, useMemo, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, RefreshControl } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import { groups, Group } from "@/src/data/mock";
import { useRole } from "@/src/context/RoleProvider";
import { api, GroupDto } from "@/src/lib/api";

const FILTERS = ["All", "Unread", "Announcements", "Muted"];

type RowItem =
  | { type: "section"; id: string; label: string; count: number }
  | { type: "group"; id: string; group: Group };

export default function Groups() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { canCreateGroups } = useRole();
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<Group[]>(groups);

  const loadGroups = useCallback(async () => {
    try {
      const response = await api.groups.listMine();
      if (response.length > 0) setItems(response.map(toGroup));
    } catch {
      setItems(groups);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadGroups().finally(() => setRefreshing(false));
  }, [loadGroups]);

  const filtered = useMemo(() => {
    let list = items;
    if (filter === "Unread") list = list.filter((g) => (g.unread || 0) > 0);
    else if (filter === "Announcements") list = list.filter((g) => g.category === "Official");
    else if (filter === "Muted") list = list.filter((g) => g.muted);
    if (query) list = list.filter((g) => g.name.toLowerCase().includes(query.toLowerCase()) || g.institution.toLowerCase().includes(query.toLowerCase()));
    return list;
  }, [filter, items, query]);

  const pinned = filtered.filter((g) => g.pinned);
  const others = filtered.filter((g) => !g.pinned);
  const totalUnread = items.reduce((s, g) => s + (g.unread || 0), 0);

  const data: RowItem[] = [];
  if (pinned.length > 0) {
    data.push({ type: "section", id: "s-pinned", label: "Pinned", count: pinned.length });
    pinned.forEach((g) => data.push({ type: "group", id: g.id, group: g }));
  }
  if (others.length > 0) {
    data.push({ type: "section", id: "s-all", label: filter === "All" ? "All groups" : filter, count: others.length });
    others.forEach((g) => data.push({ type: "group", id: g.id, group: g }));
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="groups-screen">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.onSurface }]}>Groups</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
            <View style={[styles.livedot, { backgroundColor: totalUnread > 0 ? colors.brandSecondary : colors.muted }]} />
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>
              {items.length} joined · {totalUnread} unread
            </Text>
          </View>
        </View>
        <Pressable style={[styles.iconBtn, { backgroundColor: colors.surfaceTertiary }]} testID="groups-search-btn" onPress={() => router.push("/search")}>
          <Ionicons name="search" size={20} color={colors.onSurface} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xs }}>
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceTertiary }]}>
          <Ionicons name="search" size={18} color={colors.onSurfaceTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your groups"
            placeholderTextColor={colors.muted}
            style={{ flex: 1, color: colors.onSurface, fontSize: font.base, marginLeft: spacing.sm }}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.onSurfaceTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={{ height: 56, marginTop: spacing.md }}>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(f) => f}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" }}
          renderItem={({ item }) => {
            const active = filter === item;
            const unreadCount = item === "Unread" ? totalUnread : 0;
            return (
              <Pressable
                onPress={() => setFilter(item)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? "#111414" : colors.surface,
                    borderColor: active ? "#111414" : colors.borderStrong,
                  },
                ]}
                testID={`groups-filter-${item.toLowerCase()}`}
              >
                <Text style={{ color: active ? "#fff" : colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{item}</Text>
                {unreadCount > 0 && (
                  <View style={[styles.chipBadge, { backgroundColor: active ? "#ffffff33" : colors.brandSecondary }]}>
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "500" }}>{unreadCount}</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 140 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brandPrimary}
            colors={[colors.brandPrimary]}
          />
        }
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          if (item.type === "section") {
            return (
              <View style={styles.sectionHead}>
                <Text style={[styles.sectionLabel, { color: colors.onSurfaceTertiary }]}>
                  {item.label.toUpperCase()}
                </Text>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{item.count}</Text>
              </View>
            );
          }
          return <GroupRow group={item.group} onPress={() => router.push(`/group/${item.group.id}`)} />;
        }}
        ListEmptyComponent={
          <View style={{ padding: spacing["2xl"], alignItems: "center" }}>
            <Ionicons name="folder-open-outline" size={36} color={colors.muted} />
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base, marginTop: spacing.md }}>
              No groups match this filter
            </Text>
          </View>
        }
      />

      {canCreateGroups && (
        <Pressable
          onPress={() => router.push("/create-group")}
          style={[styles.fab, { backgroundColor: colors.brandPrimary, bottom: insets.bottom + 92 }]}
          testID="new-group-fab"
        >
          <Ionicons name="add" size={26} color={colors.onBrandPrimary} />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

function toGroup(group: GroupDto): Group {
  const institution =
    typeof group.institution === "string"
      ? group.institution
      : group.institution?.name || group.city || "OnCampus";

  return {
    id: group.id,
    name: group.name,
    description: group.description || "",
    image: group.avatarUrl || group.image || "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=80",
    institution,
    city: group.city || "",
    category: group.category,
    visibility: group.visibility,
    members: group.memberCount || 0,
    memberLimit: 50000,
    createdBy: "",
    createdAt: "",
    unread: group.unread || 0,
    lastMessage: group.lastMessage || group.description || "",
    lastMessageAt: group.lastMessageAt || "",
    verified: group.official,
    role: group.role === "owner" || group.role === "admin" || group.role === "member" ? group.role : "member",
  };
}

function GroupRow({ group, onPress }: { group: Group; onPress: () => void }) {
  const { colors } = useTheme();
  const hasUnread = (group.unread || 0) > 0;

  // Parse sender + message
  const lastMsg = group.lastMessage || group.description;
  const senderMatch = lastMsg.match(/^([^:]+):\s(.*)$/);
  const sender = senderMatch?.[1];
  const msgBody = senderMatch?.[2] || lastMsg;

  const categoryColors: Record<string, string> = {
    Batch: colors.info,
    Clubs: colors.brandPrimary,
    Official: colors.brandSecondary,
    Events: colors.warning,
    Study: "#B85E9F",
    Sports: colors.success,
    Tech: colors.info,
    Arts: colors.brandSecondary,
    Career: colors.brandPrimary,
  };
  const catColor = categoryColors[group.category] || colors.muted;

  return (
    <Pressable
      onPress={onPress}
      testID={`group-row-${group.id}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.surfaceTertiary : colors.surfaceSecondary,
          borderColor: hasUnread ? catColor + "44" : colors.border,
        },
      ]}
    >
      {/* Left accent bar shows unread + category color */}
      {hasUnread && <View style={[styles.leftBar, { backgroundColor: catColor }]} />}

      <View style={{ position: "relative" }}>
        <Avatar uri={group.image} name={group.name} size={52} verified={group.verified} />
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {group.pinned && <Ionicons name="pin" size={12} color={colors.onSurfaceTertiary} />}
          <Text
            style={{
              color: colors.onSurface,
              fontSize: font.lg,
              fontWeight: hasUnread ? "500" : "400",
              flex: 1,
              letterSpacing: -0.2,
            }}
            numberOfLines={1}
          >
            {group.name}
          </Text>
          <Text
            style={{
              color: hasUnread ? catColor : colors.onSurfaceTertiary,
              fontSize: font.sm,
              fontWeight: hasUnread ? "500" : "400",
            }}
          >
            {group.lastMessageAt}
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={[styles.catPill, { backgroundColor: catColor + "22" }]}>
            <Text style={{ color: catColor, fontSize: 10, fontWeight: "500", letterSpacing: 0.3 }}>
              {group.category.toUpperCase()}
            </Text>
          </View>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, flex: 1 }} numberOfLines={1}>
            {sender && (
              <Text style={{ color: colors.onSurface, fontWeight: "500" }}>{sender}: </Text>
            )}
            {msgBody}
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Ionicons name="people" size={11} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              {group.members.toLocaleString()}
            </Text>
          </View>
          {group.role && group.role !== "member" && (
            <View style={[styles.roleTag, { backgroundColor: colors.brandTertiary }]}>
              <Text style={{ color: colors.onBrandTertiary, fontSize: 9, fontWeight: "500", letterSpacing: 0.3 }}>
                {group.role.toUpperCase()}
              </Text>
            </View>
          )}
          {group.muted && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Ionicons name="volume-mute" size={11} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 11 }}>muted</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {hasUnread && (
            <View style={[styles.unreadBadge, { backgroundColor: catColor }]}>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "500" }}>
                {(group.unread || 0) > 99 ? "99+" : group.unread}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  title: { fontSize: 30, fontWeight: "500", letterSpacing: -0.5 },
  livedot: { width: 8, height: 8, borderRadius: 4 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  searchBox: {
    flexDirection: "row", alignItems: "center",
    height: 46, borderRadius: radius.pill, paddingHorizontal: spacing.md,
  },
  chip: {
    height: 38, paddingHorizontal: spacing.lg, borderRadius: radius.pill,
    borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0,
    flexDirection: "row", gap: 6,
  },
  chipBadge: {
    minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },

  sectionHead: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: spacing.lg, marginBottom: spacing.sm, paddingHorizontal: 2,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: "500", letterSpacing: 0.6,
  },

  row: {
    flexDirection: "row", gap: spacing.md, alignItems: "center",
    padding: spacing.md, borderRadius: radius.md, borderWidth: 1,
    marginBottom: spacing.sm, position: "relative", overflow: "hidden",
  },
  leftBar: {
    position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
  },
  catPill: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  roleTag: {
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3,
  },
  unreadBadge: {
    minWidth: 22, height: 22, paddingHorizontal: 6,
    borderRadius: 11, alignItems: "center", justifyContent: "center",
  },

  fab: {
    position: "absolute", right: spacing.lg,
    width: 56, height: 56, borderRadius: 28,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
  },
});
