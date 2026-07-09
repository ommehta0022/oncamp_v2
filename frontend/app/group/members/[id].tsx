import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import OptionsMenu from "@/src/components/OptionsMenu";
import { api, GroupDto, SessionUser } from "@/src/lib/api";
import { useRole } from "@/src/context/RoleProvider";
import { useToast } from "@/src/components/Toast";

export default function Members() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useRole();
  const { showToast } = useToast();
  
  const [group, setGroup] = useState<GroupDto | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  
  const [activeMenuMember, setActiveMenuMember] = useState<any | null>(null);
  const [roleMenuMember, setRoleMenuMember] = useState<any | null>(null);

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  const load = () => {
    if (!id) return;
    api.groups.get(id).then(setGroup).catch(() => setGroup(null));
    api.groups.members(id).then((rows: any) => Array.isArray(rows) && setMembers(rows)).catch(() => setMembers([]));
  };

  const list = useMemo(
    () => members.filter((row) => (row.user?.name || "").toLowerCase().includes(query.toLowerCase())),
    [members, query]
  );

  const isAdmin = group?.role === "owner" || group?.role === "admin";
  const isOwner = group?.role === "owner";

  const handleRemove = async (userId: string) => {
    if (!id) return;
    try {
      await api.groups.removeMember(id, userId);
      showToast({ message: "Member removed", variant: "success" });
      setMembers(m => m.filter(x => x.userId !== userId));
    } catch {
      showToast({ message: "Failed to remove member", variant: "error" });
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    if (!id) return;
    try {
      await api.groups.updateMemberRole(id, userId, newRole);
      showToast({ message: "Role updated", variant: "success" });
      setMembers(m => m.map(x => x.userId === userId ? { ...x, role: newRole } : x));
    } catch {
      showToast({ message: "Failed to update role", variant: "error" });
    }
  };

  const getOptions = () => {
    if (!activeMenuMember) return [];
    const opts = [];
    
    opts.push({
      label: "View Profile",
      icon: "person-outline",
      onPress: () => router.push((`/profile/${activeMenuMember.userId}`) as any),
    });

    if (isAdmin && activeMenuMember.userId !== user?.id) {
      if (isOwner || (activeMenuMember.role !== "owner" && activeMenuMember.role !== "admin")) {
        opts.push({
          label: "Change Role",
          icon: "shield-checkmark-outline",
          onPress: () => setRoleMenuMember(activeMenuMember),
        });
        opts.push({
          label: "Remove from Group",
          icon: "person-remove-outline",
          color: colors.danger,
          onPress: () => handleRemove(activeMenuMember.userId),
        });
      }
    }
    
    return opts;
  };

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
        keyExtractor={(row) => row.user?.id || row.userId}
        contentContainerStyle={{ paddingVertical: spacing.md }}
        ListEmptyComponent={<EmptyState icon="people-outline" title="No members found" message="Try searching for a different name." />}
        renderItem={({ item }) => (
          <Pressable 
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => {
              if (Platform.OS === 'ios') Haptics.selectionAsync();
              setActiveMenuMember(item);
            }}
          >
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
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.borderStrong} style={{ marginLeft: spacing.sm }} />
          </Pressable>
        )}
      />

      <OptionsMenu
        visible={!!activeMenuMember && !roleMenuMember}
        onClose={() => setActiveMenuMember(null)}
        options={getOptions()}
      />

      <OptionsMenu
        title="Select Role"
        visible={!!roleMenuMember}
        onClose={() => setRoleMenuMember(null)}
        options={[
          { label: "Admin", icon: "star", onPress: () => handleChangeRole(roleMenuMember.userId, "admin") },
          { label: "Moderator", icon: "shield", onPress: () => handleChangeRole(roleMenuMember.userId, "moderator") },
          { label: "Member", icon: "person", onPress: () => handleChangeRole(roleMenuMember.userId, "member") },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchBox: { flexDirection: "row", alignItems: "center", height: 42, borderRadius: radius.pill, paddingHorizontal: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
});
