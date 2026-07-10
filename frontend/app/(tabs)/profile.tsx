import React, { useCallback, useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
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
import { showImagePicker, uploadPostMedia } from "@/src/lib/imageUpload";
import { asArray, normalizeGroup } from "@/src/lib/mappers";

interface UserStats {
  groups: number;
  posts: number;
  followers: number;
  following: number;
}

export default function Profile() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, refreshUser, canManageInstitution } = useRole();
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [institutionDashboard, setInstitutionDashboard] = useState<any | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingCover, setUploadingCover] = useState(false);

  const loadProfileData = useCallback(async () => {
    try {
      setLoading(true);
      const [groupsRes, statsRes, dashboardRes] = await Promise.all([
        api.groups.listMine().catch(() => ({ groups: [] })),
        api.users.stats().catch(() => ({ groups: 0, posts: 0, followers: 0, following: 0 })),
        canManageInstitution ? api.institutions.dashboard().catch(() => null) : Promise.resolve(null),
      ]);
      
      setMyGroups(asArray(groupsRes, "groups").map(normalizeGroup).slice(0, 4));
      setStats(statsRes as UserStats);
      setInstitutionDashboard(dashboardRes);
    } catch (error) {
      console.error("Failed to load profile data:", error);
    } finally {
      setLoading(false);
    }
  }, [canManageInstitution]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const handleChangeCoverImage = async () => {
    try {
      const uri = await showImagePicker({ aspect: [16, 9], quality: 0.8 });
      if (uri) {
        setUploadingCover(true);
        const uploaded = await uploadPostMedia(uri);
        await api.users.updateMe({ coverUrl: uploaded.url } as any);
        await refreshUser();
        Alert.alert("Success", "Cover image updated successfully!");
      }
    } catch (error) {
      console.error("Failed to upload cover image:", error);
      Alert.alert("Error", "Failed to update cover image. Please try again.");
    } finally {
      setUploadingCover(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="profile-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={{ position: "relative" }}>
          {(user as any)?.coverUrl ? (
            <Image
              source={{ uri: (user as any).coverUrl }}
              style={styles.cover}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.cover, styles.coverFallback, { backgroundColor: colors.brandPrimary }]}>
              <Ionicons name="school" size={42} color="#ffffffcc" />
            </View>
          )}
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={styles.coverScrim} />
          
          {uploadingCover && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={{ color: "#fff", marginTop: spacing.sm, fontSize: font.sm }}>
                Uploading cover...
              </Text>
            </View>
          )}
          
          <View style={styles.topBar}>
            <Pressable
              onPress={handleChangeCoverImage}
              style={[styles.iconBtn, { backgroundColor: "#00000055" }]}
              disabled={uploadingCover}
              testID="change-cover-btn"
            >
              <Ionicons name="camera-outline" size={20} color="#fff" />
            </Pressable>
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
            <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "500", letterSpacing: -0.5 }}>
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

        {canManageInstitution && (
          <InstitutionWorkspace dashboard={institutionDashboard} loading={loading} />
        )}

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
                    <Image
                      source={{ uri: g.avatarUrl || g.image }}
                      style={styles.groupTileImg}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.groupTileImg, { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }]}>
                      <Ionicons name="people" size={28} color={colors.onBrandTertiary} />
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

function InstitutionWorkspace({ dashboard, loading }: { dashboard: any | null; loading: boolean }) {
  const { colors } = useTheme();
  const router = useRouter();
  const institution = dashboard?.institution;
  const counts = dashboard?.counts || {};
  const status = institution?.verified_at ? "VERIFIED" : String(institution?.status || "PENDING").toUpperCase();
  const location = [institution?.city, institution?.state, institution?.country].filter(Boolean).join(", ");

  return (
    <View style={{ marginTop: spacing.xl }}>
      <View style={styles.sectionHeader}>
        <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }}>Institution workspace</Text>
        <Pressable onPress={() => router.push("/institution/dashboard")}>
          <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "500" }}>Open</Text>
        </Pressable>
      </View>

      <View style={[styles.institutionCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View style={[styles.institutionLogo, { backgroundColor: colors.brandTertiary }]}>
            {institution?.logo_url || institution?.logoUrl ? (
              <Image source={{ uri: institution.logo_url || institution.logoUrl }} style={styles.institutionLogoImage} contentFit="cover" />
            ) : (
              <Ionicons name="business" size={24} color={colors.onBrandTertiary} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }} numberOfLines={1}>
              {institution?.name || (loading ? "Loading institution" : "Institution setup pending")}
            </Text>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }} numberOfLines={1}>
              {location || "Manage profile, admins, verification, and analytics"}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: institution?.verified_at ? colors.success + "22" : colors.warning + "22" }]}>
            <Text style={{ color: institution?.verified_at ? colors.success : colors.warning, fontSize: 10, fontWeight: "500" }}>
              {status}
            </Text>
          </View>
        </View>

        <View style={[styles.institutionStats, { borderColor: colors.border }]}>
          <MiniStat label="Members" value={counts.members || 0} />
          <MiniStat label="Groups" value={counts.groups || 0} />
          <MiniStat label="Posts" value={counts.posts || 0} />
          <MiniStat label="Requests" value={counts.verificationRequests || 0} />
        </View>

        <View style={{ marginTop: spacing.md }}>
          <InstitutionAction icon="stats-chart" title="Dashboard & analytics" subtitle="Overview, reports, and real activity" onPress={() => router.push("/institution/dashboard")} />
          <InstitutionAction icon="color-palette" title="Institution profile" subtitle="Branding, logo, cover, website, and location" onPress={() => router.push("/institution/branding")} />
          <InstitutionAction icon="shield-checkmark" title="Verification & admins" subtitle="Approval status and institution admin access" onPress={() => router.push("/institution/verification")} />
          <InstitutionAction icon="settings" title="Institution settings" subtitle="Controls, verification policy, and preferences" onPress={() => router.push("/institution/settings")} />
        </View>
      </View>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }}>{Number(value || 0).toLocaleString()}</Text>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function InstitutionAction({ icon, title, subtitle, onPress }: { icon: any; title: string; subtitle: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.institutionAction}>
      <View style={[styles.institutionActionIcon, { backgroundColor: colors.brandTertiary }]}>
        <Ionicons name={icon} size={18} color={colors.onBrandTertiary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{title}</Text>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cover: { width: "100%", height: 160 },
  coverFallback: { alignItems: "center", justifyContent: "center" },
  coverScrim: { position: "absolute", left: 0, right: 0, top: 0, height: 160 },
  uploadingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 160,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
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
  institutionCard: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
  },
  institutionLogo: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  institutionLogoImage: { width: "100%", height: "100%" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  institutionStats: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  institutionAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 58,
  },
  institutionActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  achievement: {
    width: 130, borderRadius: radius.md, borderWidth: 1,
    padding: spacing.md, alignItems: "center",
  },
  achIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
});
