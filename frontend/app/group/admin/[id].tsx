import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import { getGroup } from "@/src/data/mock";

const KPIS = [
  { label: "Members", value: "512", trend: "+8", icon: "people" as const, color: "#2E5C4E" },
  { label: "Join requests", value: "3", trend: null, icon: "person-add" as const, color: "#E87A5D" },
  { label: "Post requests", value: "2", trend: null, icon: "clipboard" as const, color: "#4A788C" },
  { label: "Reports", value: "0", trend: null, icon: "flag" as const, color: "#D14D4D" },
];

export default function GroupAdmin() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = getGroup(id!);
  if (!group) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="group-admin-screen">
      <Header title="Admin panel" subtitle={group.name} onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.heroWrap}>
          <Image source={{ uri: group.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={["rgba(0,0,0,0.2)", "rgba(0,0,0,0.85)"]} style={StyleSheet.absoluteFill} />
          <View style={{ padding: spacing.md }}>
            <View style={[styles.pill, { backgroundColor: "#ffffff22" }]}>
              <Ionicons name="shield-checkmark" size={11} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "500", letterSpacing: 0.3 }}>ADMIN VIEW</Text>
            </View>
            <Text style={styles.heroTitle} numberOfLines={2}>{group.name}</Text>
            <Text style={styles.heroSub}>{group.members.toLocaleString()} members · {group.category}</Text>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          {KPIS.map((k) => (
            <View key={k.label} style={[styles.kpi, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <View style={[styles.kpiIcon, { backgroundColor: k.color + "22" }]}>
                <Ionicons name={k.icon} size={16} color={k.color} />
              </View>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: spacing.sm }}>{k.label}</Text>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "500", letterSpacing: -0.5 }}>{k.value}</Text>
                {k.trend && <Text style={{ color: colors.success, fontSize: font.sm, fontWeight: "500" }}>{k.trend}</Text>}
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Manage</Text>
        <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Row icon="information-circle" title="Group info" subtitle="Name, description, image, category" color="#2E5C4E" onPress={() => {}} />
          <Divider />
          <Row icon="people" title="Members" subtitle="Roles, mute, remove" color="#4A788C" onPress={() => router.push(`/group/members/${id}`)} />
          <Divider />
          <Row icon="person-add" title="Join requests" subtitle="3 pending" color="#E87A5D" onPress={() => router.push(`/group/requests/${id}`)} badge="3" />
          <Divider />
          <Row icon="clipboard" title="Post / poster requests" subtitle="2 pending review" color="#4A788C" onPress={() => router.push(`/group/admin/post-requests/${id}`)} badge="2" />
          <Divider />
          <Row icon="calendar" title="Scheduled posts" subtitle="1 upcoming" color="#D9983A" onPress={() => {}} />
          <Divider />
          <Row icon="megaphone" title="Published posts" subtitle="18 all-time" color="#347D5B" onPress={() => {}} />
          <Divider />
          <Row icon="pin" title="Pinned messages" subtitle="3 pinned" color="#8A8D8B" onPress={() => {}} />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Content & safety</Text>
        <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Row icon="images" title="Media & docs" subtitle="128 shared files" color="#4A788C" onPress={() => {}} />
          <Divider />
          <Row icon="flag" title="Reports" subtitle="No open reports" color="#D14D4D" onPress={() => {}} />
          <Divider />
          <Row icon="options" title="Permissions" subtitle="Posting: members can request" color="#8A8D8B" onPress={() => {}} />
          <Divider />
          <Row icon="time" title="Admin activity log" subtitle="Every decision, audited" color="#8A8D8B" onPress={() => {}} />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Danger zone</Text>
        <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginBottom: spacing.lg }]}>
          <Row icon="swap-horizontal" title="Transfer ownership" subtitle="Only for owners" color="#D9983A" onPress={() => {}} />
          <Divider />
          <Row icon="trash" title="Delete group" subtitle="Permanent. This cannot be undone." color="#D14D4D" onPress={() => {}} />
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

function Divider() { const { colors } = useTheme(); return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 64 }} />; }

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
