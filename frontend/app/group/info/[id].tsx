import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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

export default function GroupInfo() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role, isGroupAdmin } = useRole();
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
    () => members.filter((row) => ["owner", "admin", "moderator"].includes(row.role)).slice(0, 3),
    [members]
  );

  if (!group) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
        <EmptyState icon="people-outline" title="Group not found" message="This group is not available in the database." />
      </SafeAreaView>
    );
  }

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
      <View style={{ position: "relative" }}>
        {group.avatarUrl ? (
          <Image source={{ uri: group.avatarUrl }} style={styles.cover} contentFit="cover" />
        ) : (
          <View style={[styles.cover, { backgroundColor: colors.brandPrimary }]} />
        )}
        <LinearGradient colors={["rgba(0,0,0,0.4)", "transparent", "rgba(0,0,0,0.8)"]} style={styles.scrim} />
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: "#00000055" }]}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.coverContent}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <View style={[styles.pill, { backgroundColor: "#ffffff33" }]}>
              <Text style={{ color: "#fff", fontSize: font.sm, fontWeight: "500" }}>{group.category}</Text>
            </View>
            {group.official && (
              <View style={[styles.pill, { backgroundColor: colors.brandSecondary }]}>
                <Ionicons name="checkmark" size={12} color="#fff" />
                <Text style={{ color: "#fff", fontSize: font.sm, fontWeight: "500" }}>Verified</Text>
              </View>
            )}
          </View>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.groupMeta}>
            {group.city || "Campus"} - {(group.memberCount || members.length).toLocaleString()} members
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ padding: spacing.lg }}>
          <Text style={{ color: colors.onSurface, fontSize: font.base, lineHeight: 22 }}>
            {group.description || "No description added yet."}
          </Text>

          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
            {group.role ? (
              <Pressable onPress={() => router.push(`/group/${group.id}`)} style={[styles.primaryBtn, { backgroundColor: colors.brandPrimary }]} testID="open-chat-btn">
                <Ionicons name="people-circle" size={18} color={colors.onBrandPrimary} />
                <Text style={{ color: colors.onBrandPrimary, fontSize: font.base, fontWeight: "500" }}>Open chat</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={joinGroup}
                disabled={action === "join"}
                style={[styles.primaryBtn, { backgroundColor: colors.brandPrimary }]}
              >
                {action === "join" ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <>
                    <Ionicons name="person-add" size={18} color={colors.onBrandPrimary} />
                    <Text style={{ color: colors.onBrandPrimary, fontSize: font.base, fontWeight: "500" }}>Join group</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </View>

        <Section title="Admins">
          {admins.length === 0 ? (
            <View style={{ padding: spacing.lg }}>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base }}>No admins loaded yet.</Text>
            </View>
          ) : admins.map((row) => (
            <View key={row.user?.id} style={styles.memberRow}>
              <Avatar uri={row.user?.avatarUrl} name={row.user?.name || "Admin"} size={44} verified={row.user?.verified} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{row.user?.name || "Admin"}</Text>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{row.user?.bio || row.role}</Text>
              </View>
              <View style={[styles.roleTag, { backgroundColor: colors.brandTertiary }]}>
                <Text style={{ color: colors.onBrandTertiary, fontSize: 10, fontWeight: "500" }}>{row.role.toUpperCase()}</Text>
              </View>
            </View>
          ))}
          <Pressable onPress={() => router.push(`/group/members/${group.id}`)} style={styles.seeAll} testID="see-all-members-btn">
            <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "500" }}>See all members</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.brandPrimary} />
          </Pressable>
        </Section>

        <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          {isGroupAdmin && (
            <SettingsRow icon="person-add-outline" title="Join requests" onPress={() => router.push(`/group/requests/${group.id}`)} />
          )}
          {role === "normal_user" && (
            <SettingsRow icon="clipboard-outline" title="Submit a post / poster request" subtitle="Ask admins to publish your poster in this group" onPress={() => router.push(`/group/post-request/${group.id}`)} testID="submit-post-request-btn" />
          )}
          {role === "normal_user" && group.institutionId && (
            <SettingsRow
              icon="business-outline"
              title="Send request to institution"
              subtitle="Ask this institution to publish your post in an official group"
              onPress={() => router.push({
                pathname: "/institution/post-request/[id]",
                params: { id: group.institutionId, name: typeof group.institution === "string" ? group.institution : group.name },
              })}
              testID="submit-institution-post-request-btn"
            />
          )}
          {isGroupAdmin && (
            <SettingsRow icon="shield-checkmark-outline" title="Admin panel" subtitle="Manage requests, roles, and content" onPress={() => router.push(`/group/admin/${group.id}`)} testID="open-admin-panel-btn" />
          )}
        </View>

        {group.role && (
          <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <SettingsRow 
              icon={group.pinned ? "pin" : "pin-outline"}
              title={group.pinned ? "Unpin group" : "Pin group"}
              onPress={togglePinned}
            />
            <SettingsRow 
              icon={group.muted ? "volume-mute" : "volume-high-outline"}
              title={group.muted ? "Unmute group" : "Mute group"}
              subtitle="Stop receiving push notifications"
              onPress={toggleMuted}
            />
            <SettingsRow icon="exit-outline" title="Leave group" destructive onPress={leaveGroup} />
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <SettingsRow icon="flag-outline" title="Report group" destructive onPress={() => setReportModalVisible(true)} />
        </View>
      </ScrollView>
      
      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        onSubmit={handleReport}
        title="Report Group"
      />
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "500", paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {title}
      </Text>
      <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: "100%", height: 220 },
  scrim: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  topBar: { position: "absolute", top: 12, left: spacing.md, right: spacing.md, flexDirection: "row", justifyContent: "space-between" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  coverContent: { position: "absolute", bottom: spacing.lg, left: spacing.lg, right: spacing.lg },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  groupName: { color: "#fff", fontSize: 22, fontWeight: "500", marginTop: spacing.sm, letterSpacing: 0 },
  groupMeta: { color: "#ffffffcc", fontSize: font.sm, marginTop: 4 },
  primaryBtn: { flex: 1, height: 48, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  section: { marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.md, overflow: "hidden" },
  memberRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  roleTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  seeAll: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 4, paddingVertical: spacing.md },
});
