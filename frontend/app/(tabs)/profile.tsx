import React, { useState, useEffect, useCallback } from "react";
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
import { normalizeGroup } from "@/src/lib/mappers";
import InstitutionDashboard from "../institution/dashboard";
import ImageViewer from "@/src/components/ImageViewer";

interface UserStats {
  groups: number;
  posts: number;
  followers: number;
  following: number;
}

export default function Profile() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, canManageInstitution } = useRole();
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewImage, setViewImage] = useState<string | null>(null);

  const loadProfileData = useCallback(async () => {
    try {
      setLoading(true);
      const [groupsRes, statsRes] = await Promise.all([
        api.groups.listMine().catch(() => ({ groups: [] })),
        api.users.stats().catch(() => ({ groups: 0, posts: 0, followers: 0, following: 0 })),
      ]);
      
      setMyGroups(((groupsRes as any).groups || groupsRes || []).map(normalizeGroup).slice(0, 4));
      setStats(statsRes as UserStats);
    } finally {
      setLoading(false);
    }
  }, []);

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="profile-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={{ position: "relative" }}>
          <Pressable onPress={() => { if ((user as any)?.coverUrl) setViewImage((user as any).coverUrl); }}>
            {(user as any)?.coverUrl ? (
              <Image source={{ uri: (user as any).coverUrl }} style={styles.cover} contentFit="cover" />
            ) : (
              <View style={[styles.cover, { backgroundColor: colors.brandPrimary }]} />
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
            {(user as any)?.handle ? `@${(user as any).handle}` : (user as any)?.email || ""}
          </Text>

          <Text style={{ color: colors.onSurface, fontSize: font.base, marginTop: spacing.md, lineHeight: 22 }}>
            {(user as any)?.bio || "No bio yet."}
          </Text>

          <View style={{ flexDirection: "row", gap: spacing.lg, marginTop: spacing.md, flexWrap: "wrap" }}>
            {(user as any)?.course && (
              <MetaRow icon="school-outline" text={(user as any).course} />
            )}
            {(user as any)?.city && (
              <MetaRow icon="location-outline" text={(user as any).city} />
            )}
          </View>

          {loading ? (
            <View style={{ alignItems: "center", paddingVertical: spacing.xl }}>
              <ActivityIndicator size="small" color={colors.onSurfaceTertiary} />
            </View>
          ) : (
            <View style={[styles.statsRow, { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
              <Stat label="Posts" value={stats?.posts?.toString() || "0"} />
              <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
              <Stat label="Followers" value={stats?.followers?.toString() || "0"} />
              <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
              <Stat label="Following" value={stats?.following?.toString() || "0"} />
            </View>
          )}
        </View>

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
                  onPress={() => router.push(`/group/${g.id}`)}
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

        <View style={{ marginTop: spacing.xl }}>
          <View style={styles.sectionHeader}>
            <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }}>Your activity</Text>
          </View>
          <View style={[styles.workspace, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <WorkspaceAction icon="clipboard-outline" label="My post requests" onPress={() => router.push("/(tabs)/profile/my-requests" as any)} />
            <WorkspaceAction icon="bookmark-outline" label="Saved posts" onPress={() => router.push("/saved")} />
            <WorkspaceAction icon="time-outline" label="Activity log" onPress={() => router.push("/settings/activity")} />
          </View>
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      <ImageViewer 
        visible={!!viewImage} 
        imageUrl={viewImage || ""} 
        onClose={() => setViewImage(null)} 
      />
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

function WorkspaceAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable onPress={onPress} style={{ minHeight: 46, flexDirection: "row", alignItems: "center", gap: spacing.md }}><Ionicons name={icon} size={18} color={colors.onSurfaceTertiary} /><Text style={{ flex: 1, color: colors.onSurface, fontSize: font.base }}>{label}</Text><Ionicons name="chevron-forward" size={17} color={colors.onSurfaceTertiary} /></Pressable>;
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
  workspaceIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  achievement: {
    width: 130, borderRadius: radius.md, borderWidth: 1,
    padding: spacing.md, alignItems: "center",
  },
  achIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
});
