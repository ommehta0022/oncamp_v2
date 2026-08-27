import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import ImageViewer from "@/src/components/ImageViewer";
import { useRole } from "@/src/context/RoleProvider";
import { api } from "@/src/lib/api";
import { campusApi } from "@/src/lib/campusApi";
import { normalizeGroup } from "@/src/lib/mappers";
import InstitutionDashboard from "../institution/dashboard";

type UserStats = { groups?: number; streak?: number; daysSinceJoin?: number; followers?: number; following?: number };
type Achievement = { id: string; label: string; icon: string; color: string; earned: boolean; description: string };
type InstitutionIdentity = { id?: string; name?: string; city?: string; state?: string; logo_url?: string; logoUrl?: string; status?: string };

export default function Profile() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, canManageInstitution } = useRole();
  const [groups, setGroups] = useState<any[]>([]);
  const [stats, setStats] = useState<UserStats>({});
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [institution, setInstitution] = useState<InstitutionIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewImage, setViewImage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (canManageInstitution) return;
    setLoading(true);
    try {
      const [groupsResult, statsResult, achievementsResult, hubResult] = await Promise.all([
        api.groups.listMine().catch(() => ({ groups: [] })),
        api.users.stats().catch(() => ({ groups: 0, streak: 0, daysSinceJoin: 0 })),
        api.users.achievements().catch(() => []),
        campusApi.student.hub().catch(() => null),
      ]);
      setGroups((((groupsResult as any)?.groups || groupsResult || []) as any[]).map(normalizeGroup).slice(0, 6));
      setStats((statsResult || {}) as UserStats);
      setAchievements((achievementsResult || []) as Achievement[]);
      setInstitution(((hubResult as any)?.institution || null) as InstitutionIdentity | null);
    } finally {
      setLoading(false);
    }
  }, [canManageInstitution]);

  useEffect(() => { void load(); }, [load]);
  if (canManageInstitution) return <InstitutionDashboard embedded />;

  const avatar = (user as any)?.avatarUrl || (user as any)?.avatar;
  const cover = (user as any)?.coverUrl;
  const streak = Number(stats.streak || 0);
  const institutionLogo = institution?.logo_url || institution?.logoUrl;
  const institutionLocation = [institution?.city, institution?.state].filter(Boolean).join(", ");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="profile-screen">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ position: "relative" }}>
          <Pressable onPress={() => cover && setViewImage(cover)}>
            {cover ? (
              <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <LinearGradient colors={[colors.brandTertiary, colors.surfaceTertiary]} style={styles.cover} />
            )}
            {cover ? <LinearGradient colors={["transparent", "rgba(0,0,0,.48)"]} style={styles.coverScrim} /> : null}
          </Pressable>
          <View style={styles.topBar}>
            <View />
            <Pressable
              onPress={() => router.push("/settings")}
              style={[styles.iconBtn, { backgroundColor: cover ? "#00000055" : colors.surfaceSecondary, borderColor: colors.border }]}
              testID="profile-settings-btn"
              accessibilityRole="button"
              accessibilityLabel="Profile settings"
            >
              <Ionicons name="settings-outline" size={20} color={cover ? "#fff" : colors.onSurface} />
            </Pressable>
          </View>
        </View>

        <View style={styles.profileHeader}>
          <View style={styles.avatarLift}>
            <Avatar uri={avatar} name={user?.name || "User"} size={96} verified={(user as any)?.verified} withBorder onPress={() => avatar && setViewImage(avatar)} />
          </View>
          <Pressable onPress={() => router.push("/settings/edit-profile")} style={[styles.editBtn, { borderColor: colors.borderStrong }]}>
            <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "600" }}>Edit profile</Text>
          </Pressable>
        </View>

        <View style={styles.identityBlock}>
          <View style={styles.nameRow}>
            <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "700", letterSpacing: -0.35 }}>{user?.name || "User"}</Text>
            {(user as any)?.verified ? <Ionicons name="checkmark-circle" size={19} color={colors.brandPrimary} /> : null}
          </View>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base, marginTop: 3 }}>
            {(user as any)?.handle ? `@${(user as any).handle}` : (user as any)?.email || ""}
          </Text>
          {!!(user as any)?.bio && <Text style={{ color: colors.onSurface, fontSize: font.base, marginTop: spacing.md, lineHeight: 22 }}>{(user as any).bio}</Text>}

          {institution?.name ? (
            <Pressable
              onPress={() => institution.id && router.push(`/institution-profile/${institution.id}` as any)}
              style={({ pressed }) => [styles.institutionRow, { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceTertiary : colors.surfaceSecondary }]}
              testID="profile-institution-row"
            >
              {institutionLogo ? (
                <Image source={{ uri: institutionLogo }} style={styles.institutionLogo} contentFit="contain" cachePolicy="memory-disk" />
              ) : (
                <View style={[styles.institutionLogo, styles.institutionLogoFallback, { backgroundColor: colors.brandTertiary }]}>
                  <Ionicons name="school-outline" size={20} color={colors.onBrandTertiary} />
                </View>
              )}
              <View style={styles.institutionCopy}>
                <View style={styles.institutionNameLine}>
                  <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "700", flexShrink: 1 }} numberOfLines={1}>{institution.name}</Text>
                  {institution.status === "approved" ? <Ionicons name="checkmark-circle" size={15} color={colors.success} /> : null}
                </View>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }} numberOfLines={1}>
                  {institutionLocation || "Verified campus"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.muted} />
            </Pressable>
          ) : null}

          <View style={styles.metaWrap}>
            {(user as any)?.course ? <Meta icon="book-outline" text={(user as any).course} /> : null}
            {(user as any)?.city ? <Meta icon="location-outline" text={(user as any).city} /> : null}
            {streak > 0 ? <Meta icon="flame" text={`${streak} day streak`} color={colors.warning} /> : null}
          </View>

          {loading ? (
            <ActivityIndicator color={colors.brandPrimary} style={{ marginVertical: spacing.xl }} />
          ) : (
            <View style={[styles.stats, { borderColor: colors.border }]}> 
              <Stat label="Groups" value={String(stats.groups || 0)} />
              <Divider />
              <Stat label="Day streak" value={String(streak)} highlight={streak > 0} />
              <Divider />
              <Stat label="Days here" value={String(stats.daysSinceJoin || 0)} />
            </View>
          )}
        </View>

        {achievements.length > 0 ? (
          <Section title="Achievements">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
              {achievements.map((achievement) => (
                <View key={achievement.id} style={[styles.achievement, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, opacity: achievement.earned === false ? .55 : 1 }]}>
                  <View style={[styles.achievementIcon, { backgroundColor: achievement.color + "22" }]}><Ionicons name={achievement.icon as any} size={22} color={achievement.color} /></View>
                  <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "600", textAlign: "center", marginTop: spacing.sm }}>{achievement.label}</Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: 10, textAlign: "center", marginTop: 2 }} numberOfLines={2}>{achievement.description}</Text>
                </View>
              ))}
            </ScrollView>
          </Section>
        ) : null}

        <Section title="Your groups" action="See all" onAction={() => router.push("/(tabs)/groups")}>
          {groups.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Ionicons name="people-outline" size={24} color={colors.onSurfaceTertiary} />
              <Text style={{ color: colors.onSurfaceTertiary }}>Joined campus groups will appear here.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
              {groups.map((group) => (
                <Pressable key={group.id} onPress={() => router.push(`/group/${group.id}`)} style={[styles.groupCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}> 
                  {group.avatarUrl || group.image ? <Image source={{ uri: group.avatarUrl || group.image }} style={styles.groupImage} contentFit="cover" cachePolicy="memory-disk" /> : <View style={[styles.groupImage, { backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }]}><Ionicons name="people" size={28} color={colors.onSurfaceTertiary} /></View>}
                  <View style={{ padding: spacing.md }}>
                    <Text style={{ color: colors.onSurface, fontWeight: "600" }} numberOfLines={1}>{group.name}</Text>
                    <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{Number(group.memberCount || group.members || 0).toLocaleString()} members</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Section>

        <Section title="Your activity">
          <View style={[styles.workspace, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}> 
            <Action icon="bookmark-outline" label="Saved posts" onPress={() => router.push("/saved")} />
            <Action icon="time-outline" label="Activity log" onPress={() => router.push("/settings/activity")} />
            <Action icon="people-outline" label="My groups" onPress={() => router.push("/(tabs)/groups")} />
            <Action icon="person-circle-outline" label="Account settings" onPress={() => router.push("/settings")} />
          </View>
        </Section>
      </ScrollView>
      <ImageViewer visible={!!viewImage} imageUrl={viewImage || ""} onClose={() => setViewImage(null)} />
    </SafeAreaView>
  );
}

function Section({ title, children, action, onAction }: { title: string; children: React.ReactNode; action?: string; onAction?: () => void }) { const { colors } = useTheme(); return <View style={{ marginTop: spacing.xl, paddingHorizontal: spacing.lg }}><View style={styles.sectionHeader}><Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "700" }}>{title}</Text>{action && onAction ? <Pressable onPress={onAction}><Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "600" }}>{action}</Text></Pressable> : null}</View>{children}</View>; }
function Meta({ icon, text, color }: { icon: any; text: string; color?: string }) { const { colors } = useTheme(); const c = color || colors.onSurfaceTertiary; return <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Ionicons name={icon} size={15} color={c} /><Text style={{ color: c, fontSize: font.base }}>{text}</Text></View>; }
function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) { const { colors } = useTheme(); return <View style={{ flex: 1, alignItems: "center" }}><Text style={{ color: highlight ? colors.warning : colors.onSurface, fontSize: font.xl, fontWeight: "700" }}>{value}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{label}</Text></View>; }
function Divider() { const { colors } = useTheme(); return <View style={{ width: StyleSheet.hairlineWidth, height: 32, backgroundColor: colors.border }} />; }
function Action({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) { const { colors } = useTheme(); return <Pressable onPress={onPress} style={[styles.action, { borderBottomColor: colors.divider }]}><Ionicons name={icon} size={18} color={colors.onSurfaceTertiary} /><Text style={{ flex: 1, color: colors.onSurface, fontSize: font.base }}>{label}</Text><Ionicons name="chevron-forward" size={17} color={colors.onSurfaceTertiary} /></Pressable>; }

const styles = StyleSheet.create({
  cover: { width: "100%", height: 164 },
  coverScrim: { position: "absolute", left: 0, right: 0, top: 0, height: 164 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", padding: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  profileHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  avatarLift: { marginTop: -48 },
  editBtn: { marginTop: spacing.md, paddingHorizontal: spacing.lg, height: 40, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  identityBlock: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  institutionRow: { minHeight: 64, marginTop: spacing.lg, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12 },
  institutionLogo: { width: 42, height: 42, borderRadius: 10 },
  institutionLogoFallback: { alignItems: "center", justifyContent: "center" },
  institutionCopy: { flex: 1, minWidth: 0 },
  institutionNameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaWrap: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md, flexWrap: "wrap" },
  stats: { flexDirection: "row", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.lg, marginTop: spacing.lg },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  achievement: { width: 130, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  achievementIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  groupCard: { width: 180, borderWidth: 1, borderRadius: radius.md, overflow: "hidden" },
  groupImage: { width: "100%", height: 92 },
  emptyBox: { borderWidth: 1, borderRadius: radius.md, padding: spacing.xl, alignItems: "center", gap: spacing.sm },
  workspace: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, overflow: "hidden" },
  action: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
});
