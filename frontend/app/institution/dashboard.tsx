import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import { api, clearSession } from "@/src/lib/api";
import {
  getCoverUrl,
  getInstitutionSubtitle,
  getLogoUrl,
  getPalette,
  statusLabel,
} from "@/src/lib/institution";

type InstitutionDashboardProps = {
  embedded?: boolean;
};

export default function InstitutionDashboard({ embedded = false }: InstitutionDashboardProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [coverFailed, setCoverFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const next = await api.institutions.dashboard();
      setDashboard(next);
      setCoverFailed(false);
      setLogoFailed(false);
    } catch {
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  const institution = dashboard?.institution;
  const counts = dashboard?.counts || {};
  const palette = getPalette(institution);
  const logoUrl = getLogoUrl(institution);
  const coverUrl = getCoverUrl(institution);

  const kpis = [
    { label: "Members", value: counts.members || 0, icon: "people" as const, color: palette.primary },
    { label: "Groups", value: counts.groups || 0, icon: "people-circle" as const, color: palette.secondary },
    { label: "Posts", value: counts.posts || 0, icon: "megaphone" as const, color: "#4A788C" },
    { label: "Requests", value: counts.verificationRequests || 0, icon: "clipboard" as const, color: "#D9983A" },
  ];

  const confirmLogout = () => {
    if (loggingOut) return;
    Alert.alert("Log out?", "You can sign in again at any time.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => void logout(),
      },
    ]);
  };

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await api.auth.logout().catch(() => undefined);
    } finally {
      await clearSession(false);
      setLoggingOut(false);
      router.replace("/(auth)/login" as any);
    }
  };

  const content = (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, embedded && styles.embeddedScrollContent]}
      refreshControl={undefined}
    >
      <View style={[styles.heroCard, { backgroundColor: palette.primary }]}>
        <View style={styles.coverArea}>
          {coverUrl && !coverFailed ? (
            <Image
              source={{ uri: coverUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={160}
              onError={() => setCoverFailed(true)}
            />
          ) : (
            <LinearGradient
              colors={[palette.primary, palette.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.04)", "rgba(0,0,0,0.34)"]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View style={styles.identityArea}>
          <View style={[styles.institutionLogo, { backgroundColor: colors.surfaceSecondary, borderColor: "#ffffff66" }]}>
            {logoUrl && !logoFailed ? (
              <Image
                source={{ uri: logoUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={120}
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <Ionicons name="school" size={28} color={palette.primary} />
            )}
          </View>

          <View style={styles.identityText}>
            <View style={styles.verifiedRow}>
              <View style={styles.verifiedPill}>
                <Ionicons name="business" size={11} color="#fff" />
                <Text style={styles.verifiedText}>{statusLabel(institution)}</Text>
              </View>
              {!!institution?.institution_type && (
                <View style={[styles.verifiedPill, styles.typePill]}>
                  <Text style={styles.verifiedText}>{String(institution.institution_type).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {institution?.name || (loading ? "Loading institution" : "Institution pending setup")}
            </Text>
            <Text style={styles.heroSubtitle} numberOfLines={2}>
              {getInstitutionSubtitle(institution)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.kpiGrid}>
        {kpis.map((k) => (
          <View key={k.label} style={[styles.kpi, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={[styles.kpiIcon, { backgroundColor: k.color + "22" }]}>
              <Ionicons name={k.icon} size={17} color={k.color} />
            </View>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: spacing.sm }}>{k.label}</Text>
            <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "600", marginTop: 2 }}>
              {Number(k.value).toLocaleString()}
            </Text>
          </View>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Quick actions</Text>
      <View style={styles.quickRow}>
        <Quick icon="add-circle" label="Announcement" color={palette.primary} onPress={() => router.push("/create-post")} />
        <Quick icon="people-circle" label="New group" color={palette.secondary} onPress={() => router.push("/create-group")} />
        <Quick icon="stats-chart" label="Analytics" color="#D9983A" onPress={() => router.push("/institution/analytics")} />
        <Quick icon="people" label="Admins" color="#4A788C" onPress={() => router.push("/institution/admins")} />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Manage</Text>
      <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <Row icon="megaphone" title="Announcements" subtitle={`${counts.posts || 0} posts`} color={palette.primary} onPress={() => router.push("/(tabs)/feed")} />
        <Divider />
        <Row icon="people" title="Official groups" subtitle={`${counts.groups || 0} groups · ${counts.members || 0} members`} color={palette.secondary} onPress={() => router.push("/(tabs)/groups")} />
        <Divider />
        <Row icon="shield-checkmark" title="Verification" subtitle={institution?.verified_at ? "Institution verified" : "Review verification status"} color="#347D5B" onPress={() => router.push("/institution/verification")} />
        <Divider />
        <Row icon="color-palette" title="Branding" subtitle="Logo, cover and brand colors" color="#B85E9F" onPress={() => router.push("/institution/branding")} />
        <Divider />
        <Row icon="settings" title="Institution settings" subtitle="Profile, controls and security" color="#727777" onPress={() => router.push("/institution/settings")} />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Recent posts</Text>
      {(dashboard?.recentPosts || []).length === 0 ? (
        <EmptyState icon="document-text-outline" title="No institution posts yet" message="Published institution posts will appear here." />
      ) : (
        <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          {dashboard.recentPosts.map((post: any, index: number) => (
            <View key={post.id}>
              {index > 0 && <Divider />}
              <Row
                icon="document-text"
                title={post.type || "Post"}
                subtitle={`${post.status || "published"} · ${post.created_at || ""}`}
                color={palette.primary}
                onPress={() => router.push(`/post/${post.id}`)}
              />
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Account</Text>
      <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <Row
          icon="log-out-outline"
          title={loggingOut ? "Logging out…" : "Log out"}
          subtitle="Sign out of this institution account"
          color={colors.error}
          onPress={confirmLogout}
        />
      </View>
    </ScrollView>
  );

  if (embedded) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.surface }}
        edges={["top"]}
        testID="institution-dashboard-screen"
      >
        {content}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="institution-dashboard-screen">
      <Header title="Institution dashboard" onBack={() => router.back()} />
      {content}
    </SafeAreaView>
  );
}

function Quick({ icon, label, color, onPress }: { icon: any; label: string; color: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.quick}>
      <View style={[styles.quickIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={21} color="#fff" />
      </View>
      <Text numberOfLines={2} style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500", textAlign: "center" }}>
        {label}
      </Text>
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
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{title}</Text>
        <Text numberOfLines={2} style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{subtitle}</Text>
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
  scrollContent: { paddingBottom: 92 },
  embeddedScrollContent: { paddingTop: spacing.sm, paddingBottom: 112 },
  heroCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: 20,
    overflow: "hidden",
  },
  coverArea: { height: 118, position: "relative" },
  identityArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 98,
  },
  institutionLogo: {
    width: 58,
    height: 58,
    borderRadius: 16,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  identityText: { flex: 1, minWidth: 0 },
  verifiedRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.22)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  typePill: { backgroundColor: "rgba(255,255,255,0.17)" },
  verifiedText: { color: "#fff", fontSize: 10, fontWeight: "600", letterSpacing: 0.3 },
  heroTitle: { color: "#fff", fontSize: 21, lineHeight: 25, fontWeight: "600", marginTop: 6 },
  heroSubtitle: { color: "#ffffffd6", fontSize: font.sm, marginTop: 3, lineHeight: 18 },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  kpi: { flexGrow: 1, flexBasis: "45%", padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  kpiIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: font.lg, fontWeight: "600", paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md },
  quickRow: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm, justifyContent: "space-between" },
  quick: { flex: 1, minWidth: 0, alignItems: "center", gap: spacing.sm },
  quickIcon: { width: 52, height: 52, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  section: { marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 62 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
});
