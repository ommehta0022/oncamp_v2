import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import { api, GroupDto } from "@/src/lib/api";

export default function Members() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<GroupDto | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!id) return;
    api.groups.get(id).then(setGroup).catch(() => setGroup(null));
    api.groups.members(id).then((rows: any) => Array.isArray(rows) && setMembers(rows)).catch(() => setMembers([]));
  }, [id]);

  const list = useMemo(
    () => members.filter((row) => (row.user?.name || "").toLowerCase().includes(query.toLowerCase())),
    [members, query]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="members-screen">
      <Header title="Members" subtitle={group ? `${members.length.toLocaleString()} in ${group.name}` : ""} onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceTertiary }]}>
          <Ionicons name="search" size={18} color={colors.onSurfaceTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search members"
            placeholderTextColor={colors.muted}
            style={{ flex: 1, color: colors.onSurface, fontSize: font.base, marginLeft: spacing.sm }}
          />
        </View>
      </View>
      <FlatList
        showsVerticalScrollIndicator={false}
        data={list}
        keyExtractor={(row) => row.user?.id}
        contentContainerStyle={{ paddingVertical: spacing.md }}
        ListEmptyComponent={<EmptyState icon="people-outline" title="No members" message="Members will appear after real users join this group." />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Avatar uri={item.user?.avatarUrl} name={item.user?.name || "Member"} size={44} verified={item.user?.verified} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{item.user?.name || "Member"}</Text>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }} numberOfLines={1}>{item.user?.bio || item.user?.course || "OnCampus member"}</Text>
            </View>
            {item.role && item.role !== "member" && (
              <View style={[styles.tag, { backgroundColor: colors.brandTertiary }]}>
                <Text style={{ color: colors.onBrandTertiary, fontSize: 10, fontWeight: "500" }}>{item.role.toUpperCase()}</Text>
              </View>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchBox: { flexDirection: "row", alignItems: "center", height: 42, borderRadius: radius.pill, paddingHorizontal: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
});
