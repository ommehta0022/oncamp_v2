import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import EmptyState from "@/src/components/EmptyState";
import { useRole } from "@/src/context/RoleProvider";
import { api, GroupDto } from "@/src/lib/api";

export default function Profile() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, refreshUser } = useRole();
  const [myGroups, setMyGroups] = useState<GroupDto[]>([]);
  const [stats, setStats] = useState({ groups: 0, posts: 0, followers: 0, following: 0 });

  const load = useCallback(async () => {
    await refreshUser().catch(() => {});
    api.groups.listMine().then(setMyGroups).catch(() => setMyGroups([]));
    api.users.stats().then(setStats).catch(() => setStats({ groups: 0, posts: 0, followers: 0, following: 0 }));
  }, [refreshUser]);

  useEffect(() => {
    load();
  }, [load]);

  const displayName = user?.name || "Complete your profile";
  const handle = user?.handle ? `@${user.handle}` : user?.city || "Complete your profile";
  const bio = user?.bio || user?.course || "Add your course, bio, and campus details.";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="profile-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={{ position: "relative" }}>
          <View style={[styles.cover, { backgroundColor: colors.brandPrimary }]} />
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={styles.coverScrim} />
          <View style={styles.topBar}>
            <View />
            <Pressable
              onPress={() => router.push("/settings")}
              style={[styles.iconBtn, { backgroundColor: "#00000055" }]}
              testID="profile-settings-btn"
            >
              <Ionicons name="settings-outline" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>

        <View style={styles.profileHeader}>
          <View style={{ marginTop: -50, alignSelf: "flex-start" }}>
            <Avatar uri={user?.avatarUrl} name={displayName} size={100} verified={user?.verified} />
          </View>
          <View style={{ flex: 1, marginTop: spacing.md, flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
            <Pressable
              onPress={() => router.push("/settings/edit-profile")}
              style={[styles.outlineBtn, { borderColor: colors.borderStrong }]}
              testID="edit-profile-btn"
            >
              <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>Edit profile</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "500", letterSpacing: -0.5 }}>
              {displayName}
            </Text>
            {user?.verified && (
              <View style={[styles.badgeChip, { backgroundColor: colors.brandTertiary }]}>
                <Text style={{ color: colors.onBrandTertiary, fontSize: 10, fontWeight: "500" }}>VERIFIED</Text>
              </View>
            )}
          </View>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base, marginTop: 2 }}>
            {handle}
          </Text>
          <Text style={{ color: colors.onSurface, fontSize: font.base, marginTop: spacing.md, lineHeight: 22 }}>
            {bio}
          </Text>

          <View style={{ flexDirection: "row", gap: spacing.lg, marginTop: spacing.md, flexWrap: "wrap" }}>
            {!!user?.course && <MetaRow icon="school-outline" text={user.course} />}
            {!!user?.city && <MetaRow icon="location-outline" text={user.city} />}
          </View>

          <View style={styles.statsRow}>
            <Stat label="Groups" value={String(stats.groups || myGroups.length)} />
            <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
            <Stat label="Posts" value={String(stats.posts)} />
            <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
            <Stat label="Followers" value={String(stats.followers)} />
          </View>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <View style={styles.sectionHeader}>
            <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }}>Your groups</Text>
            <Pressable onPress={() => router.push("/(tabs)/groups")}>
              <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "500" }}>See all</Text>
            </Pressable>
          </View>
          {myGroups.length === 0 ? (
            <View style={{ minHeight: 180 }}>
              <EmptyState icon="people-outline" title="No groups yet" message="Your joined groups will show here." />
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              {myGroups.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => router.push(`/group/${g.id}`)}
                style={[styles.groupTile, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              >
                <Image source={g.avatarUrl ? { uri: g.avatarUrl } : undefined} style={styles.groupTileImg} contentFit="cover" />
                <View style={{ padding: spacing.md }}>
                  <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }} numberOfLines={1}>
                    {g.name}
                  </Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>
                    {(g.memberCount || 0).toLocaleString()} members
                  </Text>
                </View>
              </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaRow({ icon, text }: { icon: any; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Ionicons name={icon} size={15} color={colors.onSurfaceTertiary} />
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base }}>{text}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ color: colors.onSurface, fontSize: font.xl, fontWeight: "500" }}>{value}</Text>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: "100%", height: 160 },
  coverScrim: { position: "absolute", left: 0, right: 0, top: 0, height: 160 },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", justifyContent: "space-between",
    padding: spacing.md,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  profileHeader: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
  },
  outlineBtn: {
    paddingHorizontal: spacing.lg, height: 40, borderRadius: radius.pill,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  badgeChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 4 },
  statsRow: {
    flexDirection: "row", alignItems: "center",
    marginTop: spacing.xl, paddingVertical: spacing.md,
  },
  statDiv: { width: 1, height: 30 },
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  groupTile: {
    width: 200, borderRadius: radius.md, borderWidth: 1, overflow: "hidden",
  },
  groupTileImg: { width: "100%", height: 100 },
});
