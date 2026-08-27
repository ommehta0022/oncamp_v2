import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { campusApi } from "@/src/lib/campusApi";
import { useRole } from "@/src/context/RoleProvider";
import { useTheme } from "@/src/theme/ThemeProvider";
import CampusLoader from "@/src/components/CampusLoader";
import { radius, spacing } from "@/src/theme/colors";

const TYPES = ["University", "College", "School", "Academy"];
const RECENTS_KEY = "oncampus.discover.recent.v2";

type Campus = Record<string, any>;

export default function DiscoverScreen() {
  const { colors } = useTheme();
  const { canManageInstitution } = useRole();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("University");
  const [verified, setVerified] = useState(false);
  const [nearOnly, setNearOnly] = useState(false);
  const [items, setItems] = useState<Campus[]>([]);
  const [recent, setRecent] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadRecents = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(RECENTS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setRecent(Array.isArray(parsed) ? parsed.slice(0, 8) : []);
    } catch { setRecent([]); }
  }, []);

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
        type: type || undefined,
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

  useEffect(() => { void loadRecents(); }, [loadRecents]);
  useFocusEffect(useCallback(() => { void load(); void loadRecents(); }, [load, loadRecents]));

  if (canManageInstitution) return <InstitutionMobileConsole />;

  const nearbyCity = items.find((item) => item.city)?.city;
  const visible = nearOnly && nearbyCity ? items.filter((item) => item.city === nearbyCity) : items;
  const featured = visible.slice(0, 6);
  const trending = useMemo(() => [...visible].sort((a, b) => Number(b.discoveryScore || b.followersCount || 0) - Number(a.discoveryScore || a.followersCount || 0)).slice(0, 10), [visible]);
  const nearby = visible.filter((item) => item.city).slice(0, 10);

  const openInstitution = async (item: Campus) => {
    const snapshot = { id: item.id, name: item.name, logoUrl: item.logoUrl, type: item.type, city: item.city, state: item.state, verified: item.verified };
    const next = [snapshot, ...recent.filter((entry) => entry.id !== item.id)].slice(0, 8);
    setRecent(next);
    void AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)).catch(() => undefined);
    router.push(`/institution-profile/${encodeURIComponent(item.id)}` as any);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfaceSecondary }} edges={["top"]} testID="institution-discover-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={colors.brandPrimary} />}
        contentContainerStyle={styles.page}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.onSurface }]}>Discover</Text>
          <View style={[styles.magic, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Ionicons name="sparkles" size={22} color={colors.brandPrimary} /></View>
        </View>

        <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
          <Ionicons name="search-outline" size={21} color={colors.onSurfaceTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void load()}
            returnKeyType="search"
            placeholder="Search universities, colleges, schools..."
            placeholderTextColor={colors.muted}
            style={[styles.searchInput, { color: colors.onSurface }]}
          />
          {query ? <Pressable onPress={() => { setQuery(""); setTimeout(() => void load(), 0); }}><Ionicons name="close-circle" size={20} color={colors.muted} /></Pressable> : <Ionicons name="options-outline" size={21} color={colors.onSurfaceTertiary} />}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {TYPES.map((item) => <Chip key={item} label={item} active={type === item} onPress={() => setType(item)} />)}
          <Chip label="Verified" icon="checkmark-circle" active={verified} onPress={() => setVerified((v) => !v)} />
          <Chip label="Near You" icon="location" active={nearOnly} onPress={() => setNearOnly((v) => !v)} />
        </ScrollView>

        {loading ? <CampusLoader label="Finding campuses for you…" /> : null}
        {!loading && error ? <StateCard icon="cloud-offline-outline" title="Discover is temporarily unavailable" body={error} action="Try again" onPress={() => void load()} /> : null}
        {!loading && !error && visible.length === 0 ? <StateCard icon="school-outline" title="No campuses found" body="Try another name, location, or institution type." action="Reset filters" onPress={() => { setQuery(""); setVerified(false); setNearOnly(false); setType("University"); }} /> : null}

        {!loading && !error && visible.length > 0 ? <>
          <SectionHeader title="Featured Institutions" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
            {featured.map((item) => <FeaturedCard key={item.id} item={item} onPress={() => void openInstitution(item)} />)}
          </ScrollView>

          <SectionHeader title="Trending Campuses" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingRow}>
            {trending.map((item) => <TrendingCard key={item.id} item={item} onPress={() => void openInstitution(item)} />)}
          </ScrollView>

          {nearby.length ? <>
            <SectionHeader title="Popular Near You" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearRow}>
              {nearby.map((item) => <NearCard key={item.id} item={item} onPress={() => void openInstitution(item)} />)}
            </ScrollView>
          </> : null}
        </> : null}

        {recent.length ? <>
          <SectionHeader title="Recently Viewed" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
            {recent.map((item) => <RecentCard key={item.id} item={item} onPress={() => void openInstitution(item)} />)}
          </ScrollView>
        </> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon?: any }) {
  const { colors } = useTheme();
  return <Pressable onPress={onPress} style={[styles.chip, { borderColor: active ? colors.brandPrimary : colors.border, backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary }]}>
    {icon ? <Ionicons name={icon} size={15} color={active ? "#FFFFFF" : colors.brandPrimary} /> : null}
    <Text style={{ color: active ? "#FFFFFF" : colors.onSurface, fontSize: 12, fontWeight: "700" }}>{label}</Text>
  </Pressable>;
}

function SectionHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  return <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{title}</Text><Text style={{ color: colors.brandPrimary, fontSize: 12, fontWeight: "800" }}>See All</Text></View>;
}

function Cover({ item, style }: { item: Campus; style: any }) {
  const { colors } = useTheme();
  if (item.coverUrl) return <Image source={{ uri: item.coverUrl }} style={style} contentFit="cover" transition={120} />;
  return <View style={[style, { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }]}><Ionicons name="business" size={28} color={colors.brandPrimary} /></View>;
}

function Logo({ item, size = 48 }: { item: Campus; size?: number }) {
  const { colors } = useTheme();
  if (item.logoUrl) return <Image source={{ uri: item.logoUrl }} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: "#FFFFFF", backgroundColor: "#FFFFFF" }} contentFit="cover" />;
  return <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: "#FFFFFF", backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}><Ionicons name="school" size={size * .42} color="#FFFFFF" /></View>;
}

function Name({ item, small = false }: { item: Campus; small?: boolean }) {
  const { colors } = useTheme();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Text numberOfLines={2} style={{ color: colors.onSurface, fontSize: small ? 13 : 15, lineHeight: small ? 16 : 19, fontWeight: "800", flexShrink: 1 }}>{item.name}</Text>{item.verified ? <Ionicons name="checkmark-circle" size={small ? 13 : 15} color={colors.brandPrimary} /> : null}</View>;
}

function FeaturedCard({ item, onPress }: { item: Campus; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable onPress={onPress} style={[styles.featuredCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
    <Cover item={item} style={styles.featuredCover} />
    <View style={styles.featuredLogo}><Logo item={item} size={50} /></View>
    <View style={styles.featuredBody}>
      <Name item={item} />
      <Text style={[styles.meta, { color: colors.onSurfaceTertiary }]}><Ionicons name="location-outline" size={11} /> {[item.city, item.state].filter(Boolean).join(", ") || item.country || "Campus"}</Text>
      <View style={[styles.typePill, { backgroundColor: colors.brandTertiary }]}><Text style={{ color: colors.brandPrimary, fontSize: 10, fontWeight: "800" }}>{item.type || "Institution"}</Text></View>
      <Text style={[styles.followers, { color: colors.onSurfaceTertiary }]}>{formatCount(item.followersCount)} followers</Text>
      <View style={[styles.viewButton, { borderColor: `${colors.brandPrimary}60` }]}><Text style={{ color: colors.brandPrimary, fontSize: 12, fontWeight: "800" }}>View Campus</Text></View>
    </View>
  </Pressable>;
}

function TrendingCard({ item, onPress }: { item: Campus; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable onPress={onPress} style={[styles.trendingCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
    <Cover item={item} style={styles.trendingCover} />
    <View style={styles.trendingLogo}><Logo item={item} size={38} /></View>
    <View style={{ padding: 9, paddingTop: 20 }}><Name item={item} small /><Text style={{ color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 4 }}>{item.city || item.state || item.type}</Text><View style={[styles.miniType, { backgroundColor: colors.brandTertiary }]}><Text style={{ color: colors.brandPrimary, fontSize: 9, fontWeight: "800" }}>{item.type || "Campus"}</Text></View><Text style={{ color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 5 }}>{formatCount(item.followersCount)} followers</Text></View>
  </Pressable>;
}

function NearCard({ item, onPress }: { item: Campus; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable onPress={onPress} style={[styles.nearCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}><Logo item={item} size={40} /><View style={{ flex: 1 }}><Name item={item} small /><Text numberOfLines={1} style={{ color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 3 }}>{item.city || item.state || item.country}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 5 }}>{formatCount(item.followersCount)} followers</Text></View></Pressable>;
}

function RecentCard({ item, onPress }: { item: Campus; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable onPress={onPress} style={[styles.recentCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}><Logo item={item} size={32} /><Text numberOfLines={2} style={{ color: colors.onSurface, fontSize: 11, lineHeight: 14, fontWeight: "800", flex: 1 }}>{item.name}</Text><Ionicons name="chevron-forward" size={14} color={colors.onSurfaceTertiary} /></Pressable>;
}

function StateCard({ icon, title, body, action, onPress }: { icon: any; title: string; body: string; action: string; onPress: () => void }) {
  const { colors } = useTheme();
  return <View style={styles.state}><View style={[styles.stateIcon, { backgroundColor: colors.brandTertiary }]}><Ionicons name={icon} size={28} color={colors.brandPrimary} /></View><Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "800", marginTop: 12 }}>{title}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 5 }}>{body}</Text><Pressable onPress={onPress} style={[styles.retry, { backgroundColor: colors.brandPrimary }]}><Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 12 }}>{action}</Text></Pressable></View>;
}

function InstitutionMobileConsole() {
  const { colors } = useTheme();
  const router = useRouter();
  const actions = [
    ["speedometer-outline", "Dashboard", "Campus summary and actions", "/institution/dashboard"],
    ["business-outline", "Public profile", "Edit the campus profile shown to students", "/institution/branding"],
    ["newspaper-outline", "Content Studio", "Announcements, media and publishing", "/institution/content"],
    ["people-outline", "Students & Groups", "Approvals and campus communities", "/institution/campus-platform"],
    ["calendar-outline", "Events & Opportunities", "Manage campus activity", "/institution/campus-platform"],
  ];
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}><ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}><Text style={[styles.title, { color: colors.onSurface }]}>Institution</Text><Text style={{ color: colors.onSurfaceTertiary, marginTop: 4, lineHeight: 20 }}>Mobile controls stay synchronized with Institution Studio.</Text><View style={{ gap: 10, marginTop: 22 }}>{actions.map(([icon, title, subtitle, route]) => <Pressable key={title} onPress={() => router.push(route as any)} style={[styles.consoleCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}><View style={[styles.consoleIcon, { backgroundColor: colors.brandTertiary }]}><Ionicons name={icon as any} size={22} color={colors.brandPrimary} /></View><View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontWeight: "800", fontSize: 15 }}>{title}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 3 }}>{subtitle}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} /></Pressable>)}</View></ScrollView></SafeAreaView>;
}

function formatCount(value: any) {
  const n = Number(value || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

const styles = StyleSheet.create({
  page: { paddingBottom: 118 },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 31, fontWeight: "900", letterSpacing: -0.9 },
  magic: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", shadowColor: "#181A19", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  search: { marginHorizontal: 18, height: 54, borderRadius: 15, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 },
  searchInput: { flex: 1, fontSize: 14 },
  filters: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4, gap: 8 },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center" },
  sectionHeader: { paddingHorizontal: 18, marginTop: 26, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 18, fontWeight: "900", letterSpacing: -0.25 },
  featuredRow: { paddingHorizontal: 18, gap: 10 },
  featuredCard: { width: 202, borderRadius: 15, borderWidth: 1, overflow: "hidden", shadowColor: "#181A19", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  featuredCover: { width: "100%", height: 92 },
  featuredLogo: { position: "absolute", top: 68, left: 13 },
  featuredBody: { padding: 13, paddingTop: 30 },
  meta: { fontSize: 10, marginTop: 5 },
  typePill: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4, marginTop: 8 },
  followers: { fontSize: 10, marginTop: 7 },
  viewButton: { height: 36, borderRadius: 18, borderWidth: 1, marginTop: 10, alignItems: "center", justifyContent: "center" },
  trendingRow: { paddingHorizontal: 18, gap: 10 },
  trendingCard: { width: 146, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  trendingCover: { width: "100%", height: 70 },
  trendingLogo: { position: "absolute", top: 51, left: 9 },
  miniType: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5 },
  nearRow: { paddingHorizontal: 18, gap: 9 },
  nearCard: { width: 178, minHeight: 88, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 9, padding: 11 },
  recentRow: { paddingHorizontal: 18, gap: 9 },
  recentCard: { width: 164, minHeight: 58, borderRadius: 13, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8, padding: 9 },
  state: { alignItems: "center", paddingHorizontal: 28, paddingVertical: 46 },
  stateIcon: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  retry: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12 },
  consoleCard: { minHeight: 78, borderWidth: 1, borderRadius: radius.md, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  consoleIcon: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },
});
