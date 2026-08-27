import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import SettingsRow from "@/src/components/SettingsRow";
import EmptyState from "@/src/components/EmptyState";
import { useRole } from "@/src/context/RoleProvider";
import { api, getUserErrorMessage, GroupDto } from "@/src/lib/api";
import ReportModal from "@/src/components/ReportModal";

function groupInstitution(group: GroupDto) {
  if (typeof group.institution === "string") return group.institution;
  return group.institution?.name || "";
}

export default function GroupInfo() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isGroupAdmin } = useRole();
  const [group, setGroup] = useState<GroupDto | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [action, setAction] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.groups.get(id).then(setGroup).catch(() => setGroup(null));
    api.groups.members(id).then((rows: any) => Array.isArray(rows) && setMembers(rows)).catch(() => setMembers([]));
  }, [id]);

  const admins = useMemo(
    () => members.filter((row) => ["owner", "admin", "moderator"].includes(row.role)).slice(0, 4),
    [members],
  );

  if (!group) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
        <EmptyState icon="people-outline" title="Group not found" message="This group is not available in the database." />
      </SafeAreaView>
    );
  }

  const campusName = groupInstitution(group);
  const memberCount = Number(group.memberCount || members.length || 0);

  const handleReport = async (reason: string, details: string) => {
    if (!id) return;
    await api.reports.reportGroup(id, { reason, details });
  };

  const refreshGroup = async (groupId: string) => {
    const next = await api.groups.get(groupId);
    setGroup(next);
    return next;
  };

  const joinGroup = async () => {
    if (!group || action) return;
    setAction("join");
    try {
      await api.groups.join(group.id);
      await refreshGroup(group.id);
    } catch (error) {
      Alert.alert("Join failed", getUserErrorMessage(error, "Could not send your join request."));
    } finally {
      setAction(null);
    }
  };

  const togglePinned = async () => {
    if (!group || action) return;
    const previous = group;
    const pinned = !group.pinned;
    setGroup({ ...group, pinned });
    setAction("pin");
    try {
      if (pinned) await api.groups.pinGroup(group.id);
      else await api.groups.unpinGroup(group.id);
    } catch (error) {
      setGroup(previous);
      Alert.alert("Save failed", getUserErrorMessage(error, "Could not update pinned groups."));
    } finally {
      setAction(null);
    }
  };

  const toggleMuted = async () => {
    if (!group || action) return;
    const previous = group;
    const muted = !group.muted;
    setGroup({ ...group, muted });
    setAction("mute");
    try {
      if (muted) await api.groups.muteGroup(group.id);
      else await api.groups.unmuteGroup(group.id);
    } catch (error) {
      setGroup(previous);
      Alert.alert("Save failed", getUserErrorMessage(error, "Could not update group notifications."));
    } finally {
      setAction(null);
    }
  };

  const leaveGroup = () => {
    if (!group || action) return;
    Alert.alert("Leave group?", `You will stop receiving posts and messages from ${group.name}.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          setAction("leave");
          try {
            await api.groups.leave(group.id);
            router.back();
          } catch (error) {
            Alert.alert("Leave failed", getUserErrorMessage(error, "Could not leave this group."));
          } finally {
            setAction(null);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="group-info-screen">
      <View style={[styles.navBar, { borderBottomColor: colors.divider }]}> 
        <Pressable onPress={() => router.back()} style={styles.navButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={25} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.onSurface }]}>Group info</Text>
        <View style={styles.navButton} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Avatar uri={group.avatarUrl || group.image} name={group.name} size={88} verified={Boolean(group.official)} withBorder />
          <View style={styles.heroCopy}>
            <View style={styles.titleLine}>
              <Text style={[styles.groupName, { color: colors.onSurface }]} numberOfLines={2}>{group.name}</Text>
              {group.official ? <Ionicons name="checkmark-circle" size={18} color={colors.success} /> : null}
            </View>
            {!!campusName && <Text style={[styles.campusName, { color: colors.onSurfaceTertiary }]} numberOfLines={1}>{campusName}</Text>}
            <View style={styles.metaLine}>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{memberCount.toLocaleString()} members</Text>
              {!!group.category && <Text style={{ color: colors.muted, fontSize: font.sm }}>• {group.category}</Text>}
              {!!group.city && <Text style={{ color: colors.muted, fontSize: font.sm }} numberOfLines={1}>• {group.city}</Text>}
            </View>
          </View>
        </View>

        {!!group.description && (
          <View style={styles.descriptionWrap}>
            <Text style={{ color: colors.onSurface, fontSize: font.base, lineHeight: 22 }}>{group.description}</Text>
          </View>
        )}

        <View style={styles.primaryActions}>
          {group.role ? (
            <Pressable onPress={() => router.push(`/group/${group.id}`)} style={[styles.primaryBtn, { backgroundColor: colors.brandPrimary }]} testID="open-chat-btn">
              <Ionicons name="chatbubble-outline" size={18} color={colors.onBrandPrimary} />
              <Text style={{ color: colors.onBrandPrimary, fontSize: font.base, fontWeight: "700" }}>Open chat</Text>
            </Pressable>
          ) : (
            <Pressable onPress={joinGroup} disabled={action === "join"} style={[styles.primaryBtn, { backgroundColor: colors.brandPrimary }]}> 
              {action === "join" ? <ActivityIndicator color={colors.onBrandPrimary} /> : <><Ionicons name="person-add-outline" size={18} color={colors.onBrandPrimary} /><Text style={{ color: colors.onBrandPrimary, fontSize: font.base, fontWeight: "700" }}>Join group</Text></>}
            </Pressable>
          )}
        </View>

        <Section title="Admins">
          {admins.length === 0 ? (
            <View style={styles.emptyAdmins}>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base }}>No admins loaded yet.</Text>
            </View>
          ) : admins.map((row) => (
            <View key={`${row.user?.id || row.userId}-${row.role}`} style={[styles.memberRow, { borderBottomColor: colors.divider }]}> 
              <Avatar uri={row.user?.avatarUrl} name={row.user?.name || "Admin"} size={46} verified={row.user?.verified} />
              <View style={styles.memberCopy}>
                <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "700" }} numberOfLines={1}>{row.user?.name || "Admin"}</Text>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }} numberOfLines={1}>{row.user?.bio || String(row.role || "member").replace("_", " ")}</Text>
              </View>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>{String(row.role || "member")}</Text>
            </View>
          ))}
          <Pressable onPress={() => router.push(`/group/members/${group.id}`)} style={styles.seeAll} testID="see-all-members-btn">
            <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "700" }}>See all members</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.brandPrimary} />
          </Pressable>
        </Section>

        {isGroupAdmin ? (
          <SettingsSection>
            <SettingsRow icon="person-add-outline" title="Join requests" onPress={() => router.push(`/group/requests/${group.id}`)} />
            <SettingsRow icon="shield-checkmark-outline" title="Admin panel" subtitle="Members, roles and group controls" onPress={() => router.push(`/group/admin/${group.id}`)} testID="open-admin-panel-btn" />
          </SettingsSection>
        ) : null}

        {group.role ? (
          <SettingsSection>
            <SettingsRow icon={group.pinned ? "pin" : "pin-outline"} title={group.pinned ? "Unpin group" : "Pin group"} onPress={togglePinned} />
            <SettingsRow icon={group.muted ? "volume-mute" : "volume-high-outline"} title={group.muted ? "Unmute group" : "Mute group"} subtitle="Control push notifications for this group" onPress={toggleMuted} />
            <SettingsRow icon="exit-outline" title="Leave group" destructive onPress={leaveGroup} />
          </SettingsSection>
        ) : null}

        <SettingsSection>
          <SettingsRow icon="flag-outline" title="Report group" destructive onPress={() => setReportModalVisible(true)} />
        </SettingsSection>
      </ScrollView>

      <ReportModal visible={reportModalVisible} onClose={() => setReportModalVisible(false)} onSubmit={handleReport} title="Report Group" />
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.block}>
      <Text style={[styles.sectionLabel, { color: colors.onSurfaceTertiary }]}>{title}</Text>
      <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

function SettingsSection({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.section, styles.settingsSection, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>{children}</View>;
}

const styles = StyleSheet.create({
  navBar: { height: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  navButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  navTitle: { flex: 1, textAlign: "center", fontSize: font.lg, fontWeight: "700" },
  content: { paddingBottom: 60 },
  hero: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, flexDirection: "row", alignItems: "center", gap: spacing.lg },
  heroCopy: { flex: 1, minWidth: 0 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  groupName: { flexShrink: 1, fontSize: 22, lineHeight: 27, fontWeight: "700", letterSpacing: -0.35 },
  campusName: { fontSize: font.base, fontWeight: "600", marginTop: 4 },
  metaLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4, marginTop: 5 },
  descriptionWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  primaryActions: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  primaryBtn: { height: 46, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  block: { marginTop: spacing.xl },
  sectionLabel: { fontSize: 12, fontWeight: "700", paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  section: { marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  settingsSection: { marginTop: spacing.lg },
  memberRow: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  memberCopy: { flex: 1, minWidth: 0 },
  emptyAdmins: { padding: spacing.lg },
  seeAll: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 4, minHeight: 48 },
});
