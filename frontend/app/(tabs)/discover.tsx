import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { campusApi } from "@/src/lib/campusApi";
import { useRole } from "@/src/context/RoleProvider";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/colors";

const TYPES = ["All", "University", "College", "School", "Academy"];

export default function DiscoverScreen() {
  const { colors } = useTheme();
  const { canManageInstitution } = useRole();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");
  const [verified, setVerified] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (canManageInstitution) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!quiet) setLoading(true);
    setError("");
    try {
      const result = await campusApi.student.institutions({
        q: query.trim() || undefined,
        type: type === "All" ? undefined : type,
        verified: verified || undefined,
        limit: 60,
      });
      setItems(Array.isArray(result?.items) ? result.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load institutions.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canManageInstitution, query, type, verified]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (canManageInstitution) {
    return <InstitutionMobileConsole />;
  }

  const featured = useMemo(() => items.slice(0, 6), [items]);
  const trending = useMemo(() => [...items].sort((a, b) => (b.discoveryScore || 0) - (a.discoveryScore || 0)).slice(0, 8), [items]);
  const nearby = useMemo(() => items.filter((item) => item.city).slice(0, 8), [items]);

  const openInstitution = (id: string) => router.push(`/institution-profile/${encodeURIComponent(id)}` as any);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="institution-discover-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={colors.brandPrimary} />}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.onSurface }]}>Discover</Text>
            <Text style={{ color: colors.onSurfaceTertiary, marginTop: 3 }}>Explore verified campus communities</Text>
          </View>
          <View style={[styles.sparkle, { backgroundColor: colors.brandPrimary + "14" }]}><Ionicons name="sparkles" size={20} color={colors.brandPrimary} /></View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg }}>
          <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="search" size={20} color={colors.onSurfaceTertiary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void load()}
              returnKeyType="search"
              placeholder="Search universities, colleges, schools…"
              placeholderTextColor={colors.muted}
              style={{ flex: 1, color: colors.onSurface, fontSize: 15 }}
              accessibilityLabel="Search institutions"
            />
            {query ? <Pressable onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel="Clear search"><Ionicons name="close-circle" size={20} color={colors.onSurfaceTertiary} /></Pressable> : null}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {TYPES.map((item) => {
            const active = type === item;
            return <Pressable key={item} onPress={() => setType(item)} style={[styles.chip, { borderColor: active ? colors.brandPrimary : colors.border, backgroundColor: active ? colors.brandPrimary : colors.surface }]}><Text style={{ color: active ? "#fff" : colors.onSurface, fontWeight: "700", fontSize: 12 }}>{item}</Text></Pressable>;
          })}
          <Pressable onPress={() => setVerified((value) => !value)} style={[styles.chip, { borderColor: verified ? colors.brandPrimary : colors.border, backgroundColor: verified ? colors.brandPrimary + "14" : colors.surface }]}>
            <Ionicons name="checkmark-circle" size={14} color={verified ? colors.brandPrimary : colors.onSurfaceTertiary} />
            <Text style={{ color: verified ? colors.brandPrimary : colors.onSurface, fontWeight: "700", fontSize: 12 }}>Verified</Text>
          </Pressable>
        </ScrollView>

        {loading ? <View style={styles.loading}><ActivityIndicator size="large" color={colors.brandPrimary} /><Text style={{ color: colors.onSurfaceTertiary, marginTop: 12 }}>Finding campuses…</Text></View> : null}
        {!loading && error ? <View style={styles.loading}><Ionicons name="cloud-offline-outline" size={34} color={colors.onSurfaceTertiary} /><Text style={{ color: colors.onSurface, fontWeight: "700", marginTop: 10 }}>Discover is temporarily unavailable</Text><Text style={{ color: colors.onSurfaceTertiary, marginTop: 5, textAlign: "center" }}>{error}</Text><Pressable onPress={() => void load()} style={[styles.retry, { backgroundColor: colors.brandPrimary }]}><Text style={{ color: "#fff", fontWeight: "800" }}>Try again</Text></Pressable></View> : null}

        {!loading && !error && items.length === 0 ? <View style={styles.loading}><Ionicons name="school-outline" size={38} color={colors.onSurfaceTertiary} /><Text style={{ color: colors.onSurface, fontWeight: "800", marginTop: 12 }}>No institutions found</Text><Text style={{ color: colors.onSurfaceTertiary, marginTop: 4 }}>Try another name, city or institution type.</Text></View> : null}

        {!loading && !error && items.length > 0 ? <>
          <SectionTitle title="Featured Institutions" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCards}>
            {featured.map((item) => <LargeInstitutionCard key={item.id} item={item} onPress={() => openInstitution(item.id)} />)}
          </ScrollView>

          <SectionTitle title="Trending Campuses" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCards}>
            {trending.map((item) => <CompactInstitutionCard key={item.id} item={item} onPress={() => openInstitution(item.id)} />)}
          </ScrollView>

          {nearby.length > 0 ? <>
            <SectionTitle title="Explore by Campus" />
            <View style={{ paddingHorizontal: spacing.lg, gap: 10 }}>
              {nearby.map((item) => <InstitutionRow key={item.id} item={item} onPress={() => openInstitution(item.id)} />)}
            </View>
          </> : null}
        </> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function InstitutionMobileConsole() {
  const { colors } = useTheme();
  const router = useRouter();
  const actions = [
    { icon: "speedometer-outline", title: "Dashboard", subtitle: "Campus summary and actions", route: "/institution/dashboard" },
    { icon: "business-outline", title: "Public profile", subtitle: "Edit essential campus identity", route: "/institution/branding" },
    { icon: "newspaper-outline", title: "Content", subtitle: "Announcements and publishing", route: "/institution/content" },
    { icon: "people-outline", title: "Students", subtitle: "Review student approvals", route: "/institution/campus-platform" },
    { icon: "calendar-outline", title: "Events", subtitle: "Manage campus events", route: "/institution/campus-platform" },
  ];
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
      <Text style={[styles.title, { color: colors.onSurface }]}>Institution</Text>
      <Text style={{ color: colors.onSurfaceTertiary, marginTop: 4, lineHeight: 20 }}>Quick mobile controls. Full Institution Studio is available on the web dashboard.</Text>
      <View style={{ gap: 10, marginTop: 22 }}>
        {actions.map((action) => <Pressable key={action.title} onPress={() => router.push(action.route as any)} style={[styles.consoleCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
          <View style={[styles.consoleIcon, { backgroundColor: colors.brandPrimary + "12" }]}><Ionicons name={action.icon as any} size={22} color={colors.brandPrimary} /></View>
          <View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontWeight: "800", fontSize: 15 }}>{action.title}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 3 }}>{action.subtitle}</Text></View>
          <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
        </Pressable>)}
      </View>
      <View style={[styles.webNotice, { borderColor: colors.brandPrimary + "35", backgroundColor: colors.brandPrimary + "0C" }]}>
        <Ionicons name="desktop-outline" size={26} color={colors.brandPrimary} />
        <View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontWeight: "800" }}>Full Institution Studio</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 4, lineHeight: 18 }}>Story, gallery, departments, programs, analytics, moderation, governance, storage, backup and integrations stay on web for a better admin workflow.</Text></View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function SectionTitle({ title }: { title: string }) {
  const { colors } = useTheme();
  return <View style={styles.sectionTitle}><Text style={{ color: colors.onSurface, fontSize: 19, fontWeight: "900" }}>{title}</Text></View>;
}

function CampusImage({ item, style }: { item: any; style: any }) {
  const { colors } = useTheme();
  if (item.coverUrl) return <Image source={{ uri: item.coverUrl }} style={style} contentFit="cover" transition={180} />;
  return <View style={[style, { backgroundColor: colors.brandPrimary + "12", alignItems: "center", justifyContent: "center" }]}><Ionicons name="school" size={32} color={colors.brandPrimary} /></View>;
}

function Logo({ item, size = 52 }: { item: any; size?: number }) {
  const { colors } = useTheme();
  if (item.logoUrl) return <Image source={{ uri: item.logoUrl }} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: colors.surface }} contentFit="cover" />;
  return <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: colors.surface, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}><Ionicons name="school" size={size * .45} color="#fff" /></View>;
}

function VerifiedName({ item, compact = false }: { item: any; compact?: boolean }) {
  const { colors } = useTheme();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Text numberOfLines={2} style={{ color: colors.onSurface, fontSize: compact ? 14 : 16, fontWeight: "900", flexShrink: 1 }}>{item.name}</Text>{item.verified ? <Ionicons name="checkmark-circle" size={compact ? 14 : 16} color={colors.brandPrimary} /> : null}</View>;
}

function LargeInstitutionCard({ item, onPress }: { item: any; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable onPress={onPress} style={[styles.largeCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]} accessibilityRole="button" accessibilityLabel={`View ${item.name}`}>
    <CampusImage item={item} style={styles.largeCover} />
    <View style={styles.largeLogo}><Logo item={item} /></View>
    <View style={{ padding: 12, paddingTop: 30 }}>
      <VerifiedName item={item} />
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 5 }}>{[item.city, item.state].filter(Boolean).join(", ")}</Text>
      <View style={{ flexDirection: "row", gap: 7, marginTop: 9, alignItems: "center" }}><View style={[styles.typePill, { backgroundColor: colors.brandPrimary + "12" }]}><Text style={{ color: colors.brandPrimary, fontSize: 10, fontWeight: "800" }}>{item.type}</Text></View><Text style={{ color: colors.onSurfaceTertiary, fontSize: 11 }}>{item.followersCount || 0} followers</Text></View>
      <View style={[styles.viewCampus, { borderColor: colors.brandPrimary + "65" }]}><Text style={{ color: colors.brandPrimary, fontWeight: "800", fontSize: 12 }}>View Campus</Text></View>
    </View>
  </Pressable>;
}

function CompactInstitutionCard({ item, onPress }: { item: any; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable onPress={onPress} style={[styles.compactCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
    <CampusImage item={item} style={styles.compactCover} />
    <View style={{ position: "absolute", top: 55, left: 10 }}><Logo item={item} size={40} /></View>
    <View style={{ padding: 10, paddingTop: 22 }}><VerifiedName item={item} compact /><Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 4 }}>{item.city || item.country || item.type}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 5 }}>{item.groupsCount || 0} campus groups</Text></View>
  </Pressable>;
}

function InstitutionRow({ item, onPress }: { item: any; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable onPress={onPress} style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
    <Logo item={item} size={50} />
    <View style={{ flex: 1 }}><VerifiedName item={item} compact /><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 4 }}>{[item.type, item.city, item.state].filter(Boolean).join(" · ")}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 4 }}>{item.followersCount || 0} followers · {item.groupsCount || 0} groups · {item.eventsCount || 0} events</Text></View>
    <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
  </Pressable>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 30, fontWeight: "900", letterSpacing: -0.7 },
  sparkle: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  search: { height: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 15, flexDirection: "row", gap: 10, alignItems: "center" },
  filters: { paddingHorizontal: spacing.lg, paddingVertical: 15, gap: 8 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  loading: { minHeight: 260, paddingHorizontal: 30, alignItems: "center", justifyContent: "center" },
  retry: { marginTop: 16, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 20 },
  sectionTitle: { paddingHorizontal: spacing.lg, paddingTop: 14, paddingBottom: 12 },
  horizontalCards: { paddingHorizontal: spacing.lg, gap: 12, paddingBottom: 8 },
  largeCard: { width: 238, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1 },
  largeCover: { width: "100%", height: 112 },
  largeLogo: { position: "absolute", top: 86, left: 12 },
  typePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  viewCampus: { height: 36, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 12 },
  compactCard: { width: 170, minHeight: 168, borderRadius: 16, overflow: "hidden", borderWidth: 1 },
  compactCover: { width: "100%", height: 75 },
  row: { minHeight: 76, borderWidth: 1, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  consoleCard: { minHeight: 72, borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  consoleIcon: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  webNotice: { marginTop: 20, borderWidth: 1, borderRadius: 18, padding: 15, flexDirection: "row", gap: 12, alignItems: "flex-start" },
});
