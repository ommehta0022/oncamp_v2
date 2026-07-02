import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import { useRole } from "@/src/context/RoleProvider";

const KPIS = [
  { label: "Members", value: "8,420", trend: "+124", icon: "people" as const, color: "#2E5C4E" },
  { label: "Groups", value: "42", trend: "+3", icon: "chatbubbles" as const, color: "#E87A5D" },
  { label: "Posts (7d)", value: "128", trend: "+18", icon: "megaphone" as const, color: "#4A788C" },
  { label: "Engagement", value: "72%", trend: "+4%", icon: "trending-up" as const, color: "#D9983A" },
];

const QUICK = [
  { icon: "add-circle" as const, label: "Announcement", route: "/create-post", color: "#2E5C4E" },
  { icon: "people-circle" as const, label: "New group", route: "/create-group", color: "#E87A5D" },
  { icon: "calendar" as const, label: "Event", route: null, color: "#4A788C" },
  { icon: "document-text" as const, label: "Notice", route: null, color: "#D9983A" },
];

export default function InstitutionDashboard() {
  const { colors } = useTheme();
  const router = useRouter();
  const { setRole } = useRole();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="institution-dashboard-screen">
      <Header title="Institution dashboard" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.heroWrap}>
          <Image
            source={{ uri: "https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?w=1200&q=80" }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <LinearGradient colors={["rgba(0,0,0,0.3)", "rgba(0,0,0,0.85)"]} style={StyleSheet.absoluteFill} />
          <View style={{ padding: spacing.lg }}>
            <View style={styles.verifiedRow}>
              <View style={styles.verifiedPill}>
                <Ionicons name="checkmark" size={11} color="#fff" />
                <Text style={styles.verifiedText}>VERIFIED</Text>
              </View>
              <View style={[styles.verifiedPill, { backgroundColor: "#ffffff33" }]}>
                <Text style={styles.verifiedText}>UNIVERSITY</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>IIT Bombay</Text>
            <Text style={styles.heroSubtitle}>Mumbai · Maharashtra · India</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
              <Pressable style={styles.heroBtnPrimary}>
                <Text style={{ color: "#fff", fontSize: font.sm, fontWeight: "500" }}>Manage page</Text>
              </Pressable>
              <Pressable style={styles.heroBtnGhost}>
                <Ionicons name="share-outline" size={16} color="#fff" />
                <Text style={{ color: "#fff", fontSize: font.sm, fontWeight: "500" }}>Share</Text>
              </Pressable>
            </View>
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
                <Text style={{ color: colors.success, fontSize: font.sm, fontWeight: "500" }}>{k.trend}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Quick actions</Text>
        <View style={styles.quickRow}>
          {QUICK.map((q) => (
            <Pressable
              key={q.label}
              onPress={() => q.route && router.push(q.route as any)}
              style={styles.quick}
            >
              <View style={[styles.quickIcon, { backgroundColor: q.color }]}>
                <Ionicons name={q.icon} size={22} color="#fff" />
              </View>
              <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500", textAlign: "center" }}>{q.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Manage</Text>
        <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Row icon="megaphone" title="Announcements" subtitle="12 published · 3 scheduled" color="#2E5C4E" onPress={() => router.push("/(tabs)/feed")} />
          <Divider />
          <Row icon="people" title="Official groups" subtitle="42 groups · 8,420 members" color="#E87A5D" onPress={() => router.push("/(tabs)/groups")} />
          <Divider />
          <Row icon="clipboard" title="Post requests" subtitle="7 pending review" color="#4A788C" onPress={() => router.push("/group/admin/post-requests/g2")} badge="7" />
          <Divider />
          <Row icon="shield-checkmark" title="Verification" subtitle="Verified · Approved Nov 12, 2025" color="#347D5B" onPress={() => {}} />
          <Divider />
          <Row icon="stats-chart" title="Analytics" subtitle="Reach, engagement, growth" color="#D9983A" onPress={() => {}} />
          <Divider />
          <Row icon="settings" title="Institution settings" subtitle="Domain, branding, admins" color="#8A8D8B" onPress={() => {}} />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Recent activity</Text>
        <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginBottom: spacing.lg }]}>
          <ActivityItem icon="checkmark-circle" color={colors.success} title="Priya Nair approved 3 join requests" time="12m ago" />
          <Divider />
          <ActivityItem icon="megaphone" color={colors.brandPrimary} title="Announcement published: Semester exam schedule" time="2h ago" />
          <Divider />
          <ActivityItem icon="add-circle" color={colors.brandSecondary} title="New official group created: Alumni Network" time="1d ago" />
          <Divider />
          <ActivityItem icon="flag" color={colors.warning} title="1 message reported in Placement Prep 2026" time="1d ago" />
        </View>

        <View style={{ paddingHorizontal: spacing.lg }}>
          <Pressable
            onPress={() => { setRole("normal_user"); router.replace("/(tabs)/feed"); }}
            style={[styles.exitBtn, { borderColor: colors.borderStrong }]}
            testID="exit-institution-mode"
          >
            <Ionicons name="log-out-outline" size={16} color={colors.onSurface} />
            <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>Exit institution mode</Text>
          </Pressable>
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

function ActivityItem({ icon, color, title, time }: { icon: any; color: string; title: string; time: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.onSurface, fontSize: font.base }} numberOfLines={2}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: font.sm, marginTop: 2 }}>{time}</Text>
      </View>
    </View>
  );
}

function Divider() { const { colors } = useTheme(); return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 64 }} />; }

const styles = StyleSheet.create({
  heroWrap: { height: 200, margin: spacing.lg, borderRadius: radius.md, overflow: "hidden", justifyContent: "flex-end" },
  verifiedRow: { flexDirection: "row", gap: 6 },
  verifiedPill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#2E5C4E", paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  verifiedText: { color: "#fff", fontSize: 10, fontWeight: "500", letterSpacing: 0.3 },
  heroTitle: { color: "#fff", fontSize: 26, fontWeight: "500", letterSpacing: -0.5, marginTop: spacing.sm },
  heroSubtitle: { color: "#ffffffcc", fontSize: font.sm, marginTop: 2 },
  heroBtnPrimary: { backgroundColor: "#ffffff", paddingHorizontal: spacing.lg, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  heroBtnGhost: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#ffffff22", paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, paddingHorizontal: spacing.lg },
  kpi: { width: "47.5%", padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  kpiIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: font.lg, fontWeight: "500", paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md },
  quickRow: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.md, justifyContent: "space-between" },
  quick: { flex: 1, alignItems: "center", gap: spacing.sm },
  quickIcon: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  section: { marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 60 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  exitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    height: 44, borderRadius: radius.pill, borderWidth: 1, marginTop: spacing.md,
  },
});
