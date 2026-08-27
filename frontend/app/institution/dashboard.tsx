import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import { api, clearSession } from "@/src/lib/api";
import { campusApi } from "@/src/lib/campusApi";

type Props = { embedded?: boolean };

export default function InstitutionDashboard({ embedded = false }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<any>(null);
  const [studio, setStudio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextDashboard, nextStudio] = await Promise.all([
        api.institutions.dashboard(),
        campusApi.institution.studio().catch(() => null),
      ]);
      setDashboard(nextDashboard);
      setStudio(nextStudio);
    } catch {
      setDashboard(null);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const institution = studio?.institution || dashboard?.institution || {};
  const counts = dashboard?.counts || {};
  const pendingStudents = dashboard?.verificationRequests?.length || 0;
  const actions = [
    { icon: "business-outline", title: "Public profile", subtitle: "Logo, cover and essential public details", route: "/institution/branding", color: colors.brandPrimary },
    { icon: "newspaper-outline", title: "Content", subtitle: "Create and manage official campus content", route: "/institution/content", color: "#7C5CE7" },
    { icon: "people-outline", title: "Student approvals", subtitle: pendingStudents ? `${pendingStudents} items need review` : "Review student access", route: "/institution/campus-platform", color: "#2D8E70" },
    { icon: "calendar-outline", title: "Events", subtitle: "Create and update campus events", route: "/institution/campus-platform", color: "#E47B32" },
    { icon: "stats-chart-outline", title: "Analytics", subtitle: "View engagement and campus activity", route: "/institution/analytics", color: "#4367C7" },
    { icon: "shield-checkmark-outline", title: "Governance", subtitle: "Roles, audit and access settings", route: "/institution/governance", color: "#637083" },
  ];

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try { await api.auth.logout().catch(() => undefined); }
    finally { await clearSession(false); setLoggingOut(false); router.replace("/(auth)/login" as any); }
  };

  const content = <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}>
    <View style={[styles.identity, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
      {institution.logoUrl || institution.logo_url ? <Image source={{ uri: institution.logoUrl || institution.logo_url }} style={styles.logo} contentFit="cover" /> : <View style={[styles.logo, { backgroundColor: colors.brandPrimary + "16", alignItems: "center", justifyContent: "center" }]}><Ionicons name="school" size={27} color={colors.brandPrimary} /></View>}
      <View style={{ flex: 1 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Text numberOfLines={2} style={{ color: colors.onSurface, fontSize: 20, fontWeight: "900", flexShrink: 1 }}>{institution.name || (loading ? "Loading…" : "Institution")}</Text>{institution.verified || institution.verified_at ? <Ionicons name="checkmark-circle" size={17} color={colors.brandPrimary} /> : null}</View><Text style={{ color: colors.onSurfaceTertiary, marginTop: 5 }}>{[institution.type || institution.institution_type, institution.city].filter(Boolean).join(" · ")}</Text></View>
    </View>

    <View style={styles.stats}>
      <Metric value={counts.members || 0} label="Students" />
      <Metric value={counts.groups || studio?.groups?.length || 0} label="Groups" />
      <Metric value={studio?.events?.length || 0} label="Events" />
      <Metric value={institution.followersCount || 0} label="Followers" />
    </View>

    <View style={[styles.webStudio, { borderColor: colors.brandPrimary + "45", backgroundColor: colors.brandPrimary + "0D" }]}>
      <View style={[styles.webIcon, { backgroundColor: colors.brandPrimary }]}><Ionicons name="desktop-outline" size={23} color="#fff" /></View>
      <View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "900" }}>Full Institution Studio is on Web</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>Use web for campus story, gallery, departments, programs, student/faculty management, moderation, storage, backups and integrations.</Text></View>
    </View>

    <Text style={[styles.heading, { color: colors.onSurface }]}>Quick management</Text>
    <View style={{ gap: 10 }}>{actions.map((action) => <Pressable key={action.title} onPress={() => router.push(action.route as any)} style={[styles.action, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
      <View style={[styles.actionIcon, { backgroundColor: action.color + "15" }]}><Ionicons name={action.icon as any} size={22} color={action.color} /></View>
      <View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "800" }}>{action.title}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 3 }}>{action.subtitle}</Text></View>
      <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
    </Pressable>)}</View>

    <Text style={[styles.heading, { color: colors.onSurface }]}>Account</Text>
    <Pressable onPress={() => Alert.alert("Log out?", "You can sign in again at any time.", [{ text: "Cancel", style: "cancel" }, { text: "Log out", style: "destructive", onPress: () => void logout() }])} style={[styles.action, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}><View style={[styles.actionIcon, { backgroundColor: colors.error + "12" }]}><Ionicons name="log-out-outline" size={22} color={colors.error} /></View><View style={{ flex: 1 }}><Text style={{ color: colors.error, fontWeight: "800" }}>{loggingOut ? "Logging out…" : "Log out"}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 3 }}>Sign out of this institution account</Text></View></Pressable>
  </ScrollView>;

  if (embedded) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="institution-dashboard-screen">{content}</SafeAreaView>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="institution-dashboard-screen"><Header title="Institution" onBack={() => router.back()} />{content}</SafeAreaView>;
}

function Metric({ value, label }: { value: number; label: string }) { const { colors } = useTheme(); return <View style={[styles.metric, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}><Text style={{ color: colors.onSurface, fontSize: 19, fontWeight: "900" }}>{Number(value || 0).toLocaleString()}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 3 }}>{label}</Text></View>; }

const styles = StyleSheet.create({
  identity: { borderWidth: 1, borderRadius: radius.lg, padding: 14, flexDirection: "row", gap: 12, alignItems: "center" },
  logo: { width: 62, height: 62, borderRadius: 18 },
  stats: { flexDirection: "row", gap: 8, marginTop: 12 },
  metric: { flex: 1, minHeight: 66, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  webStudio: { marginTop: 18, borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  webIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  heading: { fontSize: 18, fontWeight: "900", marginTop: 24, marginBottom: 11 },
  action: { minHeight: 72, borderWidth: 1, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  actionIcon: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },
});
