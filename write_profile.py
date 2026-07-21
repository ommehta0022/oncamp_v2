content = r'''import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import { useRole } from "@/src/context/RoleProvider";
import { api } from "@/src/lib/api";
import { normalizeGroup, normalizePost } from "@/src/lib/mappers";
import InstitutionDashboard from "../institution/dashboard";
import ImageViewer from "@/src/components/ImageViewer";
import PostCard from "@/src/components/PostCard";

interface UserStats {
  groups: number;
  posts: number;
  followers: number;
  following: number;
  streak: number;
  daysSinceJoin: number;
}

interface Achievement {
  id: string;
  label: string;
  icon: string;
  color: string;
  earned: boolean;
  description: string;
}

export default function Profile() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, canManageInstitution } = useRole();
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewImage, setViewImage] = useState<string | null>(null);

  const loadProfileData = useCallback(async () => {
    try {
      setLoading(true);
      const [groupsRes, statsRes, achievementsRes, postsRes] = await Promise.all([
        api.groups.listMine().catch(() => ({ groups: [] })),
        api.users.stats().catch(() => ({ groups: 0, posts: 0, followers: 0, following: 0, streak: 0, daysSinceJoin: 0 })),
        api.users.achievements().catch(() => []),
        (user?.id ? api.users.posts(user.id, 1, 3).catch(() => []) : Promise.resolve([])),
      ]);

      setMyGroups(((groupsRes as any).groups || groupsRes || []).map(normalizeGroup).slice(0, 4));
      setStats(statsRes as UserStats);
      setAchievements(achievementsRes as Achievement[]);
      const rawPosts = (postsRes as any)?.posts || postsRes || [];
      setRecentPosts(rawPosts.map(normalizePost).slice(0, 3));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (canManageInstitution) {
      setLoading(false);
      return;
    }
    void loadProfileData();
  }, [canManageInstitution, loadProfileData]);

  if (canManageInstitution) {
    return <InstitutionDashboard embedded />;
  }

  const streakCount = stats?.streak || 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="profile-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Cover + Top Bar */}
        <View style={{ position: "relative" }}>
          <Pressable onPress={() => { if ((user as any)?.coverUrl) setViewImage((user as any).coverUrl); }}>
            {(user as any)?.coverUrl ? (
              <Image source={{ uri: (user as any).coverUrl }} style={styles.cover} contentFit="cover" />
            ) : (
              <LinearGradient colors={[colors.brandPrimary, colors.brandSecondary || colors.brandPrimary + "aa"]} style={styles.cover} />
            )}
            <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={styles.coverScrim} />
          </Pressable>

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

        {/* Avatar + Edit / Share */}
        <View style={styles.profileHeader}>
          <View style={{ marginTop: -50, alignSelf: "flex-start" }}>
            <Avatar
              uri={(user as any)?.avatarUrl || (user as any)?.avatar}
              name={user?.name || "User"}
              size={100}
              verified={(user as any)?.verified}
              withBorder={true}
              onPress={() => {
                const img = (user as any)?.avatarUrl || (user as any)?.avatar;
                if (img) setViewImage(img);
              }}
            />
          </View>
          <View style={{ flex: 1, marginTop: spacing.md, flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
            <Pressable
              onPress={() => router.push("/settings/edit-profile")}
              style={[styles.outlineBtn, { borderColor: colors.borderStrong }]}
              testID="edit-profile-btn"
            >
              <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>Edit profile</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/settings/invite")}
              style={[styles.filledBtn, { backgroundColor: colors.brandPrimary }]}
            >
              <Ionicons name="share-outline" size={16} color={colors.onBrandPrimary} />
            </Pressable>
          </View>
        </View>

        {/* Name, Handle, Bio, Meta */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "500", letterSpacing: 0 }}>
              {user?.name || "User"}
            </Text>
            {(user as any)?.verified && (
              <View style={[styles.badgeChip, { backgroundColor: colors.brandTertiary }]}>
                <Text style={{ color: colors.onBrandTertiary, fontSize: 10, fontWeight: "500" }}>VERIFIED</Text>
              </View>
            )}
          </View>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base, marginTop: 2 }}>
            {(user as any)?.handle ? @ : (user as any)?.email || ""}
          </Text>

          {!!(user as any)?.bio && (
            <Text style={{ color: colors.onSurface, fontSize: font.base, marginTop: spacing.md, lineHeight: 22 }}>
              {(user as any).bio}
            </Text>
          )}

          <View style={{ flexDirection: "row", gap: spacing.lg, marginTop: spacing.md, flexWrap: "wrap" }}>
            {(user as any)?.course && <MetaRow icon="school-outline" text={(user as any).course} />}
            {(user as any)?.city && <MetaRow icon="location-outline" text={(user as any).city} />}
            {streakCount > 0 && <MetaRow icon="flame" text={${streakCount} day streak} color="#FF6B35" />}
          </View>

          {/* Stats Row: Groups / Posts / Streak */}
          {loading ? (
            <View style={{ alignItems: "center", paddingVertical: spacing.xl }}>
              <ActivityIndicator size="small" color={colors.onSurfaceTertiary} />
            </View>
          ) : (
            <View style={[styles.statsRow, { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
              <Stat label="Groups" value={stats?.groups?.toString() || "0"} />
              <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
              <Stat label="Posts" value={stats?.posts?.toString() || "0"} />
              <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
              <Stat label="Day Streak" value={streakCount.toString()} highlight={streakCount > 0} />
            </View>
          )}
        </View>

        {/* Achievements */}
        {achievements.length > 0 && (
          <View style={{ marginTop: spacing.xl }}>
            <Text style={[styles.sectionHeaderTitle, { color: colors.onSurface }]}>Achievements</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              {achievements.map((a) => (
                <View
                  key={a.id}
                  style={[styles.achievement, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                >
                  <View style={[styles.achIcon, { backgroundColor: a.color + "22" }]}>
                    <Ionicons name={a.icon as any} size={22} color={a.color} />
                  </View>
                  <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500", marginTop: spacing.sm, textAlign: "center" }}>
                    {a.label}
                  </Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 2, textAlign: "center" }} numberOfLines={2}>
                    {a.description}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Your Groups */}
        {myGroups.length > 0 && (
          <View style={{ marginTop: spacing.xl }}>
            <View style={styles.sectionHeader}>
              <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }}>Your groups</Text>
              <Pressable onPress={() => router.push("/(tabs)/groups")}>
                <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "500" }}>See all</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              {myGroups.map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => router.push(/group/)}
                  style={[styles.groupTile, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                >
                  {g.avatarUrl || g.image ? (
                    <Image source={{ uri: g.avatarUrl || g.image }} style={styles.groupTileImg} contentFit="cover" />
                  ) : (
                    <View style={[styles.groupTileImg, { alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary }]}>
                      <Ionicons name="people" size={28} color={colors.onSurfaceTertiary} />
                    </View>
                  )}
                  <View style={{ padding: spacing.md }}>
                    <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }} numberOfLines={1}>
                      {g.name}
                    </Text>
                    <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>
                      {(g.memberCount || g.members || 0).toLocaleString()} members
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Activity */}
        <View style={{ marginTop: spacing.xl }}>
          <View style={styles.sectionHeader}>
            <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }}>Your activity</Text>
          </View>
          <View style={[styles.workspace, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <WorkspaceAction icon="clipboard-outline" label="My post requests" onPress={() => router.push("/(tabs)/profile/my-requests" as any)} />
            <WorkspaceAction icon="bookmark-outline" label="Saved posts" onPress={() => router.push("/saved")} />
            <WorkspaceAction icon="time-outline" label="Activity log" onPress={() => router.push("/settings/activity")} />
            <WorkspaceAction icon="people-outline" label="My groups" onPress={() => router.push("/(tabs)/groups")} />
          </View>
        </View>

        {/* Recent Posts */}
        {recentPosts.length > 0 && (
          <View style={{ marginTop: spacing.xl }}>
            <View style={styles.sectionHeader}>
              <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }}>Recent posts</Text>
            </View>
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
              {recentPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onChange={(updated) => setRecentPosts((prev) => prev.map((p) => p.id === updated.id ? updated : p))}
                  onDeleted={(id) => setRecentPosts((prev) => prev.filter((p) => p.id !== id))}
                />
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <ImageViewer
        visible={!!viewImage}
        imageUrl={viewImage || ""}
        onClose={() => setViewImage(null)}
      />
    </SafeAreaView>
  );
}

function MetaRow({ icon, text, color }: { icon: any; text: string; color?: string }) {
  const { colors } = useTheme();
  const c = color || colors.onSurfaceTertiary;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Ionicons name={icon} size={15} color={c} />
      <Text style={{ color: c, fontSize: font.base }}>{text}</Text>
    </View>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ color: highlight ? "#FF6B35" : colors.onSurface, fontSize: font.xl, fontWeight: "500" }}>{value}</Text>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function WorkspaceAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable onPress={onPress} style={{ minHeight: 46, flexDirection: "row", alignItems: "center", gap: spacing.md }}><Ionicons name={icon} size={18} color={colors.onSurfaceTertiary} /><Text style={{ flex: 1, color: colors.onSurface, fontSize: font.base }}>{label}</Text><Ionicons name="chevron-forward" size={17} color={colors.onSurfaceTertiary} /></Pressable>;
}

const styles = StyleSheet.create({
  cover: { width: "100%", height: 180 },
  coverScrim: { position: "absolute", left: 0, right: 0, top: 0, height: 180 },
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
  filledBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
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
  sectionHeaderTitle: {
    fontSize: font.lg, fontWeight: "500", paddingHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  groupTile: {
    width: 200, borderRadius: radius.md, borderWidth: 1, overflow: "hidden",
  },
  groupTileImg: { width: "100%", height: 100 },
  workspace: { marginHorizontal: spacing.lg, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  achievement: {
    width: 130, borderRadius: radius.md, borderWidth: 1,
    padding: spacing.md, alignItems: "center",
  },
  achIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
});
'''

with open('frontend/app/(tabs)/profile.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Written profile.tsx!")
