import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import { groups, Group } from "@/src/data/mock";
import { useRole } from "@/src/context/RoleProvider";

const FILTERS = ["All", "Unread", "Batch", "Clubs", "Official"];

export default function Groups() {
  const { colors } = useTheme();
  const router = useRouter();
  const { canCreateGroups } = useRole();
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");

  const data = useMemo(() => {
    let list = groups;
    if (filter === "Unread") list = list.filter((g) => (g.unread || 0) > 0);
    else if (filter !== "All") list = list.filter((g) => g.category === filter);
    if (query) list = list.filter((g) => g.name.toLowerCase().includes(query.toLowerCase()));
    return list;
  }, [filter, query]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="groups-screen">
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Groups</Text>
        <View style={{ flexDirection: "row", gap: spacing.xs }}>
          <Pressable style={styles.iconBtn} testID="groups-search-btn" onPress={() => router.push("/search")}>
            <Ionicons name="search" size={22} color={colors.onSurface} />
          </Pressable>
          {canCreateGroups && (
            <Pressable style={styles.iconBtn} testID="new-group-btn" onPress={() => router.push("/create-group")}>
              <Ionicons name="add-circle-outline" size={26} color={colors.brandPrimary} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceTertiary }]}>
          <Ionicons name="search" size={18} color={colors.onSurfaceTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search groups"
            placeholderTextColor={colors.muted}
            style={{ flex: 1, color: colors.onSurface, fontSize: font.base, marginLeft: spacing.sm }}
          />
        </View>
      </View>

      <View style={{ height: 56, marginTop: spacing.md }}>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(f) => f}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setFilter(item)}
              style={[
                styles.chip,
                {
                  backgroundColor: filter === item ? colors.brandPrimary : colors.surfaceTertiary,
                  borderColor: filter === item ? colors.brandPrimary : colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: filter === item ? colors.onBrandPrimary : colors.onSurface,
                  fontSize: font.base,
                  fontWeight: "500",
                }}
              >
                {item}
              </Text>
            </Pressable>
          )}
        />
      </View>

      <FlatList showsVerticalScrollIndicator={false}
        data={data}
        keyExtractor={(g) => g.id}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }) => <GroupRow group={item} />}
        ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 76 }} />}
      />
    </SafeAreaView>
  );
}

function GroupRow({ group }: { group: Group }) {
  const { colors } = useTheme();
  const router = useRouter();
  const hasUnread = (group.unread || 0) > 0;

  return (
    <Pressable
      onPress={() => router.push(`/group/${group.id}`)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.surfaceTertiary : colors.surface },
      ]}
      testID={`group-row-${group.id}`}
    >
      <Avatar uri={group.image} name={group.name} size={52} verified={group.verified} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {group.pinned && <Ionicons name="pin" size={12} color={colors.onSurfaceTertiary} />}
          <Text
            style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500", flex: 1 }}
            numberOfLines={1}
          >
            {group.name}
          </Text>
          <Text style={{ color: hasUnread ? colors.brandPrimary : colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: hasUnread ? "500" : "400" }}>
            {group.lastMessageAt}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: spacing.sm }}>
          <Text
            style={{
              flex: 1,
              color: colors.onSurfaceTertiary,
              fontSize: font.base,
            }}
            numberOfLines={1}
          >
            {group.lastMessage || group.description}
          </Text>
          {group.muted && <Ionicons name="volume-mute" size={14} color={colors.onSurfaceTertiary} />}
          {hasUnread && (
            <View style={[styles.badge, { backgroundColor: colors.brandPrimary }]}>
              <Text style={{ color: colors.onBrandPrimary, fontSize: 11, fontWeight: "500" }}>
                {group.unread}
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
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 26, fontWeight: "500", letterSpacing: -0.5 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  searchBox: {
    flexDirection: "row", alignItems: "center",
    height: 42, borderRadius: radius.pill, paddingHorizontal: spacing.md,
  },
  chip: {
    height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  row: {
    flexDirection: "row", gap: spacing.md, alignItems: "center",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 72,
  },
  badge: {
    minWidth: 22, height: 22, paddingHorizontal: 6,
    borderRadius: 11, alignItems: "center", justifyContent: "center",
  },
});
