import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import { api } from "@/src/lib/api";
import {
  formatAgo,
  formatDate,
  formatNumber,
  getCoverUrl,
  getInstitutionName,
  getInstitutionSubtitle,
  getInstitutionType,
  getLogoUrl,
  getPalette,
  isVerified,
  statusLabel,
  type InstitutionAnalyticsData,
  type InstitutionDashboardData,
} from "@/src/lib/institution";
import { secureLogout } from "@/src/lib/auth";

const PENDING_BRANDING_KEY = "oncampus.pending_institution_branding";

const QUICK = [
  { icon: "add-circle" as const, label: "Announcement", route: "/create-post", color: "#2E5C4E" },
  { icon: "people-circle" as const, label: "New group", route: "/create-group", color: "#E87A5D" },
  { icon: "calendar" as const, label: "Event", route: "/create-post?type=event", color: "#4A788C" },
  { icon: "document-text" as const, label: "Notice", route: "/create-post?type=notice", color: "#D9983A" },
];

export default function InstitutionDashboard({ embedded = false }: { embedded?: boolean } = {}) {
  const { colors } = useTheme();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<InstitutionDashboardData | null>(null);
  const [analytics, setAnalytics] = useState<InstitutionAnalyticsData | null>(null);
  const [postRequests, setPostRequests] = useState<any[]>([]);
  const [pendingBranding, setPendingBranding] = useState<{ logoUrl?: string; coverUrl?: string; palette?: string }>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await api.institutions.dashboard()) as InstitutionDashboardData;
      setDashboard(data);
      AsyncStorage.getItem(PENDING_BRANDING_KEY)
        .then((value) => setPendingBranding(value ? JSON.parse(value) : {}))
        .catch(() => setPendingBranding({}));

      const [analyticsResult, requestsResult] = await Promise.allSettled([
        data.institution?.id ? api.institutions.analytics() as Promise<InstitutionAnalyticsData> : Promise.resolve(null),
        data.institution?.id ? api.institutions.postRequests(data.institution.id) : Promise.resolve([]),
      ]);
      setAnalytics(analyticsResult.status === "fulfilled" ? analyticsResult.value : null);
      setPostRequests(requestsResult.status === "fulfilled" && Array.isArray(requestsResult.value) ? requestsResult.value : []);
    } catch {
      setDashboard(null);
      setAnalytics(null);
      setPostRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const institution = dashboard?.institution || analytics?.institution || null;
  const counts = dashboard?.counts || {};
  const palette = getPalette(institution, pendingBranding.palette);
  const coverUrl = getCoverUrl(institution) || pendingBranding.coverUrl || "";
  const logoUrl = getLogoUrl(institution) || pendingBranding.logoUrl || dashboard?.verificationRequests?.[0]?.logo_url || "";
  const pendingRequests = postRequests.filter((request) => request.status === "pending" || request.status === "needs_changes").length;
  const pendingVerification = dashboard?.verificationRequests?.filter((request) => request.status === "pending" || request.status === "needs_changes").length || 0;
  const publishedPosts = dashboard?.recentPosts?.filter((post) => post.status === "published").length || counts.posts || 0;
  const scheduledPosts = dashboard?.recentPosts?.filter((post) => post.status === "scheduled").length || 0;
  const sevenDayPosts = useMemo(() => {
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return (dashboard?.recentPosts || []).filter((post) => new Date(post.created_at || post.createdAt || 0).getTime() >= since).length;
  }, [dashboard?.recentPosts]);

  const kpis = [
    { label: "Members", value: formatNumber(counts.members), detail: "live", icon: "people" as const, color: palette.primary },
    { label: "Groups", value: formatNumber(counts.groups), detail: "official", icon: "chatbubbles" as const, color: palette.secondary },
    { label: "Posts (7d)", value: formatNumber(sevenDayPosts), detail: `${formatNumber(counts.posts)} total`, icon: "megaphone" as const, color: "#4A788C" },
    { label: "Engagement", value: formatNumber(analytics?.counts?.engagements), detail: `${analytics?.counts?.approvalRate ?? 0}% approval`, icon: "trending-up" as const, color: "#D9983A" },
  ];

  const shareInstitution = () => {
    const name = getInstitutionName(institution, dashboard?.verificationRequests);
    Share.share({ message: `${name}${institution?.website ? ` - ${institution.website}` : ""}` }).catch(() => {});
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="institution-dashboard-screen">
      <Header title="Institution dashboard" onBack={() => router.back()} showBack={!embedded} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: embedded ? 120 : 60 }}>
        <View style={[styles.heroWrap, { backgroundColor: palette.primary }]}>
          {coverUrl ? <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.primary }]} />}
          <LinearGradient colors={["rgba(0,0,0,0.16)", "rgba(0,0,0,0.84)"]} style={StyleSheet.absoluteFill} />
          <View style={{ padding: spacing.lg }}>
            <View style={styles.verifiedRow}>
              <View style={[styles.verifiedPill, { backgroundColor: isVerified(institution) ? palette.primary : colors.warning }]}>
                <Ionicons name={isVerified(institution) ? "checkmark" : "time"} size={11} color="#fff" />
                <Text style={styles.verifiedText}>{statusLabel(institution)}</Text>
              </View>
              <View style={[styles.verifiedPill, { backgroundColor: "#ffffff33" }]}>
                <Text style={styles.verifiedText}>{String(getInstitutionType(institution)).toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.heroTitle} numberOfLines={1}>{getInstitutionName(institution, dashboard?.verificationRequests)}</Text>
            <Text style={styles.heroSubtitle} numberOfLines={1}>{getInstitutionSubtitle(institution)}</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
              <Pressable style={styles.heroBtnPrimary} onPress={() => router.push("/institution/branding")}>
                {logoUrl ? <Image source={{ uri: logoUrl }} style={styles.heroLogo} contentFit="cover" /> : null}
                <Text style={{ color: palette.primary, fontSize: font.sm, fontWeight: "500" }}>Manage page</Text>
              </Pressable>
              <Pressable style={styles.heroBtnGhost} onPress={shareInstitution}>
                <Ionicons name="share-outline" size={16} color="#fff" />
                <Text style={{ color: "#fff", fontSize: font.sm, fontWeight: "500" }}>Share</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          {kpis.map((k) => (
            <View key={k.label} style={[styles.kpi, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <View style={[styles.kpiIcon, { backgroundColor: k.color + "22" }]}>
                <Ionicons name={k.icon} size={16} color={k.color} />
              </View>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: spacing.sm }}>{k.label}</Text>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "500" }}>{k.value}</Text>
                <Text style={{ color: colors.success, fontSize: font.sm, fontWeight: "500" }}>{k.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Quick actions</Text>
        <View style={styles.quickRow}>
          {QUICK.map((q) => (
            <Pressable key={q.label} onPress={() => router.push(q.route as any)} style={styles.quick}>
              <View style={[styles.quickIcon, { backgroundColor: q.color }]}>
                <Ionicons name={q.icon} size={22} color="#fff" />
              </View>
              <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500", textAlign: "center" }}>{q.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Manage</Text>
        <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Row icon="megaphone" title="Announcements" subtitle={`${formatNumber(publishedPosts)} published - ${formatNumber(scheduledPosts)} scheduled`} color={palette.primary} onPress={() => router.push("/(tabs)/feed")} />
          <Divider />
          <Row icon="people" title="Official groups" subtitle={`${formatNumber(counts.groups)} groups - ${formatNumber(counts.members)} members`} color={palette.secondary} onPress={() => router.push("/(tabs)/groups")} />
          <Divider />
          <Row icon="clipboard" title="Post requests" subtitle={`${formatNumber(pendingRequests)} pending review`} color="#4A788C" onPress={() => router.push("/institution/post-requests" as any)} badge={pendingRequests ? String(pendingRequests) : undefined} />
          <Divider />
          <Row icon="shield-checkmark" title="Verification" subtitle={isVerified(institution) ? `Verified - Approved ${formatDate(institution?.verified_at || institution?.verifiedAt)}` : `${pendingVerification} verification request${pendingVerification === 1 ? "" : "s"}`} color="#347D5B" onPress={() => router.push("/institution/verification")} />
          <Divider />
          <Row icon="stats-chart" title="Analytics" subtitle="Reach, engagement, growth" color="#D9983A" onPress={() => router.push("/institution/analytics")} />
          <Divider />
          <Row icon="color-palette" title="Branding" subtitle="Logo, cover, brand colors" color="#B85E9F" onPress={() => router.push("/institution/branding")} />
          <Divider />
          <Row icon="people-circle" title="Institution admins" subtitle={`${dashboard?.role ? dashboard.role : "Admin"} access - manage roles`} color="#4A788C" onPress={() => router.push("/institution/admins")} />
          <Divider />
          <Row icon="settings" title="Institution settings" subtitle="Domain, controls, billing" color="#8A8D8B" onPress={() => router.push("/institution/settings")} />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Recent activity</Text>
        {loading ? (
          <Text style={{ color: colors.onSurfaceTertiary, paddingHorizontal: spacing.lg }}>Loading institution activity...</Text>
        ) : (dashboard?.recentPosts || []).length === 0 ? (
          <EmptyState icon="document-text-outline" title="No institution activity yet" message="Published posts, approvals, and group updates will appear here." />
        ) : (
          <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginBottom: spacing.lg }]}>
            {(dashboard?.recentPosts || []).slice(0, 4).map((post, index) => (
              <View key={post.id || index}>
                {index > 0 && <Divider />}
                <ActivityItem
                  icon={post.status === "scheduled" ? "time" : "megaphone"}
                  color={post.status === "scheduled" ? colors.warning : palette.primary}
                  title={`${post.status === "scheduled" ? "Scheduled" : "Published"}: ${post.title || post.type || "Institution post"}`}
                  time={formatAgo(post.created_at || post.createdAt)}
                  onPress={() => post.id && router.push(`/post/${post.id}`)}
                />
              </View>
            ))}
          </View>
        )}

        <View style={{ paddingHorizontal: spacing.lg }}>
          <Pressable
            onPress={() => secureLogout()}
            style={[styles.exitBtn, { borderColor: colors.borderStrong }]}
            testID="institution-logout-btn"
          >
            <Ionicons name="log-out-outline" size={16} color={colors.onSurface} />
            <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>Logout account</Text>
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

function ActivityItem({ icon, color, title, time, onPress }: { icon: any; color: string; title: string; time: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.onSurface, fontSize: font.base }} numberOfLines={2}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: font.sm, marginTop: 2 }}>{time}</Text>
      </View>
    </Pressable>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 64 }} />;
}

const styles = StyleSheet.create({
  heroWrap: { height: 200, margin: spacing.lg, borderRadius: radius.md, overflow: "hidden", justifyContent: "flex-end" },
  verifiedRow: { flexDirection: "row", gap: 6 },
  verifiedPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  verifiedText: { color: "#fff", fontSize: 10, fontWeight: "500", letterSpacing: 0.3 },
  heroTitle: { color: "#fff", fontSize: 26, fontWeight: "500", marginTop: spacing.sm },
  heroSubtitle: { color: "#ffffffcc", fontSize: font.sm, marginTop: 2 },
  heroBtnPrimary: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#ffffff", paddingHorizontal: spacing.lg, height: 36, borderRadius: radius.pill, justifyContent: "center" },
  heroLogo: { width: 18, height: 18, borderRadius: 9 },
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
  exitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 44, borderRadius: radius.pill, borderWidth: 1, marginTop: spacing.md },
});
