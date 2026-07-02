import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import { groups, Group } from "@/src/data/mock";
import { useRole } from "@/src/context/RoleProvider";

const FILTERS = ["All", "Unread", "Pinned", "Batch", "Clubs", "Official"];

type Activity = {
  id: string;
  kind: "announcement" | "mention" | "join" | "posts" | "pinned";
  groupId: string;
  groupName: string;
  groupImage: string;
  text: string;
  time: string;
  count?: number;
};

const ACTIVITIES: Activity[] = [
  { id: "a1", kind: "announcement", groupId: "g3", groupName: "Campus Announcements", groupImage: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&q=80", text: "New announcement: Semester exam schedule released", time: "1h", count: 1 },
  { id: "a2", kind: "mention", groupId: "g2", groupName: "IITB Robotics Club", groupImage: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=400&q=80", text: "Rohan mentioned you: \u201c@Aarav can you handle the control demo?\u201d", time: "2h" },
  { id: "a3", kind: "posts", groupId: "g5", groupName: "Placement Prep 2026", groupImage: "https://images.unsplash.com/photo-1517420704952-d9f39e95b43e?w=400&q=80", text: "24 new messages while you were away", time: "5h", count: 24 },
  { id: "a4", kind: "join", groupId: "g1", groupName: "CSE Batch of 2026", groupImage: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=400&q=80", text: "Kabir Mehta and 2 others joined", time: "1d" },
];

export default function Groups() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { canCreateGroups } = useRole();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");

  const pulseGroups = useMemo(() => groups.filter((g) => (g.unread || 0) > 0 || g.pinned).slice(0, 8), []);
  const pinnedGroups = useMemo(() => groups.filter((g) => g.pinned || (g.unread || 0) > 10).slice(0, 4), []);

  const filteredAll = useMemo(() => {
    let list = groups;
    if (filter === "Unread") list = list.filter((g) => (g.unread || 0) > 0);
    else if (filter === "Pinned") list = list.filter((g) => g.pinned);
    else if (filter !== "All") list = list.filter((g) => g.category === filter);
    if (query) list = list.filter((g) => g.name.toLowerCase().includes(query.toLowerCase()));
    return list;
  }, [filter, query]);

  const tileWidth = (width - spacing.lg * 2 - spacing.md) / 2;
  const totalUnread = groups.reduce((sum, g) => sum + (g.unread || 0), 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="groups-screen">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.onSurface }]}>Groups</Text>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>
            {groups.length} joined · {totalUnread} unread
          </Text>
        </View>
        <Pressable style={[styles.iconBtn, { backgroundColor: colors.surfaceTertiary }]} testID="groups-search-btn" onPress={() => router.push("/search")}>
          <Ionicons name="search" size={20} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
          <View style={[styles.searchBox, { backgroundColor: colors.surfaceTertiary }]}>
            <Ionicons name="search" size={18} color={colors.onSurfaceTertiary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search your groups"
              placeholderTextColor={colors.muted}
              style={{ flex: 1, color: colors.onSurface, fontSize: font.base, marginLeft: spacing.sm }}
            />
          </View>
        </View>

        {/* PULSE — story-style rings for unread groups */}
        <View style={{ marginTop: spacing.lg }}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={[styles.livedot, { backgroundColor: colors.brandSecondary }]} />
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Pulse</Text>
            </View>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{pulseGroups.length} active</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
            <Pressable onPress={() => router.push("/(tabs)/discover")} style={{ alignItems: "center", width: 72 }}>
              <View style={[styles.discoverRing, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceTertiary }]}>
                <Ionicons name="compass" size={26} color={colors.brandPrimary} />
              </View>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 6, fontWeight: "500" }} numberOfLines={1}>Discover</Text>
            </Pressable>
            {pulseGroups.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => router.push(`/group/${g.id}`)}
                style={{ alignItems: "center", width: 72 }}
                testID={`pulse-${g.id}`}
              >
                <View style={[styles.pulseRing, { borderColor: (g.unread || 0) > 0 ? colors.brandSecondary : colors.brandPrimary }]}>
                  <Image source={{ uri: g.image }} style={{ width: 56, height: 56, borderRadius: 28 }} contentFit="cover" />
                  {(g.unread || 0) > 0 && (
                    <View style={[styles.unreadDot, { backgroundColor: colors.brandSecondary, borderColor: colors.surface }]}>
                      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "500" }}>
                        {(g.unread || 0) > 99 ? "99+" : g.unread}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: colors.onSurface, fontSize: font.sm, marginTop: 6, fontWeight: "500" }} numberOfLines={1}>
                  {g.name.split(" ")[0]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* PINNED — 2-column mini-cards */}
        {pinnedGroups.length > 0 && (
          <View style={{ marginTop: spacing.xl }}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="pin" size={14} color={colors.onSurface} />
                <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Pinned</Text>
              </View>
            </View>
            <View style={styles.grid}>
              {pinnedGroups.map((g) => (
                <PinnedTile key={g.id} group={g} width={tileWidth} onPress={() => router.push(`/group/${g.id}`)} />
              ))}
            </View>
          </View>
        )}

        {/* RECENT ACTIVITY — timeline stream */}
        <View style={{ marginTop: spacing.xl }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Recent activity</Text>
            <Pressable>
              <Text style={{ color: colors.brandPrimary, fontSize: font.sm, fontWeight: "500" }}>See all</Text>
            </Pressable>
          </View>
          <View style={[styles.activityCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            {ACTIVITIES.map((a, i) => (
              <View key={a.id}>
                {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 60 }} />}
                <ActivityRow activity={a} onPress={() => router.push(`/group/${a.groupId}`)} />
              </View>
            ))}
          </View>
        </View>

        {/* FILTERS */}
        <View style={{ height: 56, marginTop: spacing.xl }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" }}>
            {FILTERS.map((f) => (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: filter === f ? "#111414" : colors.surface,
                    borderColor: filter === f ? "#111414" : colors.borderStrong,
                  },
                ]}
              >
                <Text style={{ color: filter === f ? "#fff" : colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{f}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* ALL GROUPS — 2-column tile grid */}
        <View style={styles.grid}>
          {filteredAll.map((g) => (
            <GroupTile key={g.id} group={g} width={tileWidth} onPress={() => router.push(`/group/${g.id}`)} />
          ))}
        </View>

        {filteredAll.length === 0 && (
          <View style={{ padding: spacing["2xl"], alignItems: "center" }}>
            <Ionicons name="folder-open-outline" size={36} color={colors.muted} />
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base, marginTop: spacing.md }}>No groups match this filter</Text>
          </View>
        )}
      </ScrollView>

      {/* FAB for institution_admin to create groups */}
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

function PinnedTile({ group, width, onPress }: { group: Group; width: number; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ width, height: 110, borderRadius: radius.md, overflow: "hidden" }} testID={`pinned-${group.id}`}>
      <Image source={{ uri: group.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.85)"]} style={StyleSheet.absoluteFill} />
      {(group.unread || 0) > 0 && (
        <View style={[styles.cornerBadge, { backgroundColor: colors.brandSecondary }]}>
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "500" }}>{group.unread} new</Text>
        </View>
      )}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="pin" size={11} color="#ffffffcc" />
          <Text style={{ color: "#ffffffcc", fontSize: 10, fontWeight: "500", letterSpacing: 0.3 }}>PINNED</Text>
        </View>
        <Text style={{ color: "#fff", fontSize: font.base, fontWeight: "500", marginTop: 2 }} numberOfLines={1}>
          {group.name}
        </Text>
      </View>
    </Pressable>
  );
}

function ActivityRow({ activity, onPress }: { activity: Activity; onPress: () => void }) {
  const { colors } = useTheme();
  const iconMap: Record<Activity["kind"], { icon: any; c: string }> = {
    announcement: { icon: "megaphone", c: colors.brandSecondary },
    mention: { icon: "at", c: colors.info },
    join: { icon: "person-add", c: colors.success },
    posts: { icon: "chatbubbles", c: colors.brandPrimary },
    pinned: { icon: "pin", c: colors.warning },
  };
  const m = iconMap[activity.kind];

  return (
    <Pressable onPress={onPress} style={styles.activityRow}>
      <View style={{ position: "relative" }}>
        <Image source={{ uri: activity.groupImage }} style={{ width: 40, height: 40, borderRadius: 10 }} contentFit="cover" />
        <View style={[styles.actIcon, { backgroundColor: m.c, borderColor: colors.surfaceSecondary }]}>
          <Ionicons name={m.icon} size={10} color="#fff" />
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "500", letterSpacing: 0.2 }} numberOfLines={1}>
          {activity.groupName.toUpperCase()}
        </Text>
        <Text style={{ color: colors.onSurface, fontSize: font.sm, marginTop: 2, lineHeight: 18 }} numberOfLines={2}>
          {activity.text}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{activity.time}</Text>
      </View>
      {activity.count && activity.count > 1 && (
        <View style={[styles.countBadge, { backgroundColor: colors.brandTertiary }]}>
          <Text style={{ color: colors.onBrandTertiary, fontSize: font.sm, fontWeight: "500" }}>{activity.count}</Text>
        </View>
      )}
    </Pressable>
  );
}

function GroupTile({ group, width, onPress }: { group: Group; width: number; onPress: () => void }) {
  const { colors } = useTheme();
  const roleColor = group.role === "owner" || group.role === "admin" ? colors.brandSecondary : null;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.tile, { width, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
      testID={`group-tile-${group.id}`}
    >
      <View style={{ height: 96, position: "relative" }}>
        <Image source={{ uri: group.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.55)"]} style={StyleSheet.absoluteFill} />

        <View style={styles.tileTop}>
          {group.verified && (
            <View style={[styles.tilePill, { backgroundColor: colors.brandPrimary }]}>
              <Ionicons name="checkmark" size={9} color="#fff" />
            </View>
          )}
          {group.muted && (
            <View style={[styles.tilePill, { backgroundColor: "#00000066" }]}>
              <Ionicons name="volume-mute" size={10} color="#fff" />
            </View>
          )}
        </View>

        {(group.unread || 0) > 0 && (
          <View style={[styles.tileUnread, { backgroundColor: colors.brandSecondary }]}>
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "500" }}>
              {(group.unread || 0) > 99 ? "99+" : group.unread}
            </Text>
          </View>
        )}

        <Text style={styles.tileCategory}>{group.category.toUpperCase()}</Text>
      </View>

      <View style={{ padding: spacing.md }}>
        <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }} numberOfLines={1}>
          {group.members.toLocaleString()} members
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={[styles.pulseDotSmall, { backgroundColor: (group.unread || 0) > 0 ? colors.brandSecondary : colors.muted }]} />
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{group.lastMessageAt || "quiet"}</Text>
          </View>
          {roleColor && (
            <View style={[styles.roleChip, { backgroundColor: roleColor + "22" }]}>
              <Text style={{ color: roleColor, fontSize: 10, fontWeight: "500", letterSpacing: 0.3 }}>
                {group.role?.toUpperCase()}
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
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  searchBox: {
    flexDirection: "row", alignItems: "center",
    height: 46, borderRadius: radius.pill, paddingHorizontal: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: font.lg, fontWeight: "500", letterSpacing: -0.3 },
  livedot: { width: 8, height: 8, borderRadius: 4 },

  discoverRing: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderStyle: "dashed",
  },
  pulseRing: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2.5, padding: 2,
    alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  unreadDot: {
    position: "absolute", right: -2, top: -2,
    minWidth: 22, height: 22, paddingHorizontal: 5,
    borderRadius: 11, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },

  grid: {
    flexDirection: "row", flexWrap: "wrap", gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  cornerBadge: {
    position: "absolute", top: 8, right: 8,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },

  activityCard: {
    marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, overflow: "hidden",
  },
  activityRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  actIcon: {
    position: "absolute", right: -4, bottom: -4,
    width: 18, height: 18, borderRadius: 9, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  countBadge: {
    minWidth: 32, height: 24, paddingHorizontal: 8,
    borderRadius: 12, alignItems: "center", justifyContent: "center",
  },

  chip: {
    height: 38, paddingHorizontal: spacing.lg, borderRadius: radius.pill,
    borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0,
  },

  tile: {
    borderRadius: radius.md, borderWidth: 1, overflow: "hidden",
  },
  tileTop: {
    position: "absolute", top: 8, left: 8, flexDirection: "row", gap: 4,
  },
  tilePill: {
    width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center",
  },
  tileUnread: {
    position: "absolute", top: 8, right: 8,
    minWidth: 24, height: 22, paddingHorizontal: 6, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
  },
  tileCategory: {
    position: "absolute", bottom: 8, left: 12,
    color: "#ffffffee", fontSize: 10, fontWeight: "500", letterSpacing: 0.4,
  },
  pulseDotSmall: {
    width: 6, height: 6, borderRadius: 3,
  },
  roleChip: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },

  fab: {
    position: "absolute", right: spacing.lg,
    width: 56, height: 56, borderRadius: 28,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
  },
});
