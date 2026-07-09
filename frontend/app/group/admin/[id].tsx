import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import { api, GroupDto } from "@/src/lib/api";

export default function GroupAdmin() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<GroupDto | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [postRequests, setPostRequests] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    api.groups.get(id).then(setGroup).catch(() => setGroup(null));
    api.groups.members(id).then((rows: any) => Array.isArray(rows) && setMembers(rows)).catch(() => setMembers([]));
    api.groups.joinRequests(id).then((rows: any) => Array.isArray(rows) && setJoinRequests(rows)).catch(() => setJoinRequests([]));
    api.groups.postRequests(id).then((rows: any) => Array.isArray(rows) && setPostRequests(rows)).catch(() => setPostRequests([]));
  }, [id]);

  const kpis = useMemo(() => [
    { label: "Members", value: String(members.length || group?.memberCount || 0), icon: "people" as const, color: "#2E5C4E" },
    { label: "Join requests", value: String(joinRequests.length), icon: "person-add" as const, color: "#E87A5D" },
    { label: "Post requests", value: String(postRequests.filter((r) => r.status === "pending").length), icon: "clipboard" as const, color: "#4A788C" },
    { label: "Reports", value: "0", icon: "flag" as const, color: "#D14D4D" },
  ], [group?.memberCount, joinRequests.length, members.length, postRequests]);

  if (!group) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
        <Header title="Admin panel" onBack={() => router.back()} />
        <EmptyState icon="shield-checkmark-outline" title="Group not found" message="This admin panel needs a real group from the database." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="group-admin-screen">
      <Header title="Admin panel" subtitle={group.name} onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={[styles.heroWrap, { backgroundColor: colors.brandPrimary }]}>
          <View style={{ padding: spacing.md }}>
            <View style={[styles.pill, { backgroundColor: "#ffffff22" }]}>
              <Ionicons name="shield-checkmark" size={11} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "500", letterSpacing: 0.3 }}>ADMIN VIEW</Text>
            </View>
            <Text style={styles.heroTitle} numberOfLines={2}>{group.name}</Text>
            <Text style={styles.heroSub}>{(group.memberCount || members.length).toLocaleString()} members - {group.category}</Text>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          {kpis.map((k) => (
            <View key={k.label} style={[styles.kpi, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <View style={[styles.kpiIcon, { backgroundColor: k.color + "22" }]}>
                <Ionicons name={k.icon} size={16} color={k.color} />
              </View>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: spacing.sm }}>{k.label}</Text>
              <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "500", letterSpacing: -0.5, marginTop: 2 }}>{k.value}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Manage</Text>
        <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Row icon="people" title="Members" subtitle="Roles, mute, remove" color="#4A788C" onPress={() => router.push(`/group/members/${id}`)} />
          <Divider />
          <Row icon="person-add" title="Join requests" subtitle={`${joinRequests.length} pending`} color="#E87A5D" onPress={() => router.push(`/group/requests/${id}`)} badge={joinRequests.length ? String(joinRequests.length) : undefined} />
          <Divider />
          <Row icon="clipboard" title="Post / poster requests" subtitle={`${postRequests.filter((r) => r.status === "pending").length} pending review`} color="#4A788C" onPress={() => router.push(`/group/admin/post-requests/${id}`)} badge={postRequests.length ? String(postRequests.length) : undefined} />
          <Divider />
          <Row icon="settings" title="Settings" subtitle="Name, description, visibility" color="#8A4A8C" onPress={() => router.push(`/group/admin/settings?id=${id}`)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, title, subtitle, color, onPress, badge }: { icon: any; title: string; subtitle: string; color: string; onPress: () => void; badge?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{title}</Text>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{subtitle}</Text>
      </View>
      {badge && (
        <View style={[styles.badge, { backgroundColor: colors.brandSecondary }]}>
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "500" }}>{badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
    </Pressable>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 64 }} />;
}

const styles = StyleSheet.create({
  heroWrap: { height: 140, margin: spacing.lg, borderRadius: radius.md, overflow: "hidden", justifyContent: "flex-end" },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "500", letterSpacing: -0.5, marginTop: spacing.sm },
  heroSub: { color: "#ffffffcc", fontSize: font.sm, marginTop: 2 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, paddingHorizontal: spacing.lg },
  kpi: { width: "47.5%", padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  kpiIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: font.lg, fontWeight: "500", paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md },
  section: { marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 60 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});
