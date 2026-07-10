import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import { useRole } from "@/src/context/RoleProvider";
import { api } from "@/src/lib/api";

export default function InstitutionDashboard() {
  const { colors } = useTheme();
  const router = useRouter();
  const { setRole } = useRole();
  const [dashboard, setDashboard] = useState<any>(null);

  useEffect(() => {
    api.institutions.dashboard().then(setDashboard).catch(() => setDashboard(null));
  }, []);

  const institution = dashboard?.institution;
  const counts = dashboard?.counts || {};
  const kpis = [
    { label: "Members", value: counts.members || 0, icon: "people" as const, color: "#2E5C4E" },
    { label: "Groups", value: counts.groups || 0, icon: "chatbubbles" as const, color: "#E87A5D" },
    { label: "Posts", value: counts.posts || 0, icon: "megaphone" as const, color: "#4A788C" },
    { label: "Requests", value: counts.verificationRequests || 0, icon: "clipboard" as const, color: "#D9983A" },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="institution-dashboard-screen">
      <Header title="Institution dashboard" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={[styles.heroWrap, { backgroundColor: colors.brandPrimary }]}>
          <View style={{ padding: spacing.lg }}>
            <View style={styles.verifiedRow}>
              <View style={styles.verifiedPill}>
                <Ionicons name="business" size={11} color="#fff" />
                <Text style={styles.verifiedText}>{institution?.status ? String(institution.status).toUpperCase() : "PENDING"}</Text>
              </View>
              {!!institution?.institution_type && (
                <View style={[styles.verifiedPill, { backgroundColor: "#ffffff33" }]}>
                  <Text style={styles.verifiedText}>{String(institution.institution_type).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <Text style={styles.heroTitle}>{institution?.name || "Institution pending setup"}</Text>
            <Text style={styles.heroSubtitle}>
              {[institution?.city, institution?.state, institution?.country].filter(Boolean).join(" - ") || "Complete institution details"}
            </Text>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          {kpis.map((k) => (
            <View key={k.label} style={[styles.kpi, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <View style={[styles.kpiIcon, { backgroundColor: k.color + "22" }]}>
                <Ionicons name={k.icon} size={16} color={k.color} />
              </View>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: spacing.sm }}>{k.label}</Text>
              <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "500", letterSpacing: -0.5, marginTop: 2 }}>{Number(k.value).toLocaleString()}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Quick actions</Text>
        <View style={styles.quickRow}>
          <Quick icon="add-circle" label="Announcement" color="#2E5C4E" onPress={() => router.push("/create-post")} />
          <Quick icon="people-circle" label="New group" color="#E87A5D" onPress={() => router.push("/create-group")} />
          <Quick icon="stats-chart" label="Analytics" color="#D9983A" onPress={() => router.push("/institution/analytics")} />
          <Quick icon="people" label="Admins" color="#4A788C" onPress={() => router.push("/institution/admins")} />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Manage</Text>
        <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Row icon="megaphone" title="Announcements" subtitle={`${counts.posts || 0} real posts`} color="#2E5C4E" onPress={() => router.push("/(tabs)/feed")} />
          <Divider />
          <Row icon="people" title="Official groups" subtitle={`${counts.groups || 0} real groups - ${counts.members || 0} members`} color="#E87A5D" onPress={() => router.push("/(tabs)/groups")} />
          <Divider />
          <Row icon="shield-checkmark" title="Verification" subtitle={institution?.verified_at ? `Verified ${institution.verified_at}` : "Pending or not verified"} color="#347D5B" onPress={() => router.push("/institution/verification")} />
          <Divider />
          <Row icon="color-palette" title="Branding" subtitle="Logo, cover, and institution profile" color="#B85E9F" onPress={() => router.push("/institution/branding")} />
          <Divider />
          <Row icon="settings" title="Institution settings" subtitle="Controls and preferences" color="#8A8D8B" onPress={() => router.push("/institution/settings")} />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Recent posts</Text>
        {(dashboard?.recentPosts || []).length === 0 ? (
          <EmptyState icon="document-text-outline" title="No institution posts yet" message="Real published and scheduled posts will appear here." />
        ) : (
          <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginBottom: spacing.lg }]}>
            {dashboard.recentPosts.map((post: any, index: number) => (
              <View key={post.id}>
                {index > 0 && <Divider />}
                <Row icon="document-text" title={post.type || "Post"} subtitle={`${post.status} - ${post.created_at}`} color={colors.brandPrimary} onPress={() => router.push(`/post/${post.id}`)} />
              </View>
            ))}
          </View>
        )}

        <View style={{ paddingHorizontal: spacing.lg }}>
          <Pressable onPress={() => { setRole("normal_user"); router.replace("/(tabs)/feed"); }} style={[styles.exitBtn, { borderColor: colors.borderStrong }]} testID="exit-institution-mode">
            <Ionicons name="log-out-outline" size={16} color={colors.onSurface} />
            <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>Exit institution mode</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Quick({ icon, label, color, onPress }: { icon: any; label: string; color: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.quick}>
      <View style={[styles.quickIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={22} color="#fff" />
      </View>
      <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

function Row({ icon, title, subtitle, color, onPress }: { icon: any; title: string; subtitle: string; color: string; onPress: () => void }) {
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
      <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
    </Pressable>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 64 }} />;
}

const styles = StyleSheet.create({
  heroWrap: { minHeight: 170, margin: spacing.lg, borderRadius: radius.md, overflow: "hidden", justifyContent: "flex-end" },
  verifiedRow: { flexDirection: "row", gap: 6 },
  verifiedPill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#2E5C4E", paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  verifiedText: { color: "#fff", fontSize: 10, fontWeight: "500", letterSpacing: 0.3 },
  heroTitle: { color: "#fff", fontSize: 26, fontWeight: "500", letterSpacing: -0.5, marginTop: spacing.sm },
  heroSubtitle: { color: "#ffffffcc", fontSize: font.sm, marginTop: 2 },
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
  exitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 44, borderRadius: radius.pill, borderWidth: 1, marginTop: spacing.md },
});
