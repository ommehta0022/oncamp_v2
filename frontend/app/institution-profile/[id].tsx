import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { campusApi } from "@/src/lib/campusApi";
import { API_BASE_URL, getAccessToken } from "@/src/lib/api";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/colors";

type Tab = "Home" | "Groups" | "Events" | "Campus" | "About";
const TABS: Tab[] = ["Home", "Groups", "Events", "Campus", "About"];

async function engagementRequest(path: string, method: "GET" | "POST" | "DELETE" = "GET") {
  const token = await getAccessToken();
  if (!token) throw new Error("Please sign in again.");
  const response = await fetch(`${API_BASE_URL}${path}`, { method, headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.detail || "Could not complete this action.");
  return data;
}

export default function InstitutionProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = String(params.id || "");
  const [bundle, setBundle] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("Home");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!id) return;
    if (!quiet) setLoading(true);
    try {
      const [profile, engagement] = await Promise.all([
        campusApi.student.institutionProfile(id),
        engagementRequest(`/campus/directory/institutions/${encodeURIComponent(id)}/engagement`).catch(() => ({})),
      ]);
      setBundle(profile);
      setBookmarked(Boolean(engagement?.bookmarked));
      void engagementRequest(`/campus/directory/institutions/${encodeURIComponent(id)}/view?source=discover`, "POST").catch(() => undefined);
    } catch (error) {
      Alert.alert("Institution", error instanceof Error ? error.message : "Could not load this institution.", [{ text: "Back", onPress: () => router.back() }]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, router]);

  useEffect(() => { void load(); }, [load]);

  const institution = bundle?.institution;
  const follow = async () => {
    if (!institution || busy) return;
    setBusy(true);
    const next = !institution.isFollowing;
    setBundle((current: any) => ({ ...current, institution: { ...current.institution, isFollowing: next, followersCount: Math.max(0, (current.institution.followersCount || 0) + (next ? 1 : -1)) } }));
    try {
      if (next) await campusApi.student.followInstitution(id); else await campusApi.student.unfollowInstitution(id);
    } catch (error) {
      setBundle((current: any) => ({ ...current, institution: { ...current.institution, isFollowing: !next, followersCount: Math.max(0, (current.institution.followersCount || 0) + (next ? -1 : 1)) } }));
      Alert.alert("Follow", error instanceof Error ? error.message : "Could not update follow status.");
    } finally { setBusy(false); }
  };

  const toggleBookmark = async () => {
    if (busy) return;
    setBusy(true);
    const next = !bookmarked;
    setBookmarked(next);
    try {
      await engagementRequest(`/campus/directory/institutions/${encodeURIComponent(id)}/bookmark`, next ? "POST" : "DELETE");
    } catch (error) {
      setBookmarked(!next);
      Alert.alert("Save", error instanceof Error ? error.message : "Could not update saved status.");
    } finally { setBusy(false); }
  };

  if (loading || !institution) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}><Stack.Screen options={{ headerShown: false }} /><ActivityIndicator size="large" color={colors.brandPrimary} /></SafeAreaView>;
  }

  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="institution-profile-screen">
    <Stack.Screen options={{ headerShown: false }} />
    <ScrollView
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[2]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={colors.brandPrimary} />}
      contentContainerStyle={{ paddingBottom: 80 }}
    >
      <Hero institution={institution} onBack={() => router.back()} />
      <ProfileHeader institution={institution} bookmarked={bookmarked} onFollow={() => void follow()} onBookmark={() => void toggleBookmark()} onShare={() => void Share.share({ message: `${institution.name}\n${institution.shortDescription || institution.tagline || "Explore this campus on OnCampus."}\noncampus://institution/${id}` })} />
      <View style={{ backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{TABS.map((name) => <Pressable key={name} onPress={() => setTab(name)} style={[styles.tab, tab === name && { borderBottomColor: colors.brandPrimary }]}><Text style={{ color: tab === name ? colors.brandPrimary : colors.onSurfaceTertiary, fontWeight: tab === name ? "900" : "700" }}>{name}</Text></Pressable>)}</ScrollView>
      </View>
      {tab === "Home" ? <HomeTab bundle={bundle} onTab={setTab} /> : null}
      {tab === "Groups" ? <GroupsTab groups={bundle.groups || []} /> : null}
      {tab === "Events" ? <EventsTab events={bundle.events || []} opportunities={bundle.opportunities || []} onRefresh={() => void load(true)} /> : null}
      {tab === "Campus" ? <CampusTab bundle={bundle} /> : null}
      {tab === "About" ? <AboutTab bundle={bundle} /> : null}
    </ScrollView>
  </SafeAreaView>;
}

function Hero({ institution, onBack }: { institution: any; onBack: () => void }) {
  const { colors } = useTheme();
  return <View style={styles.hero}>
    {institution.coverUrl ? <Image source={{ uri: institution.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.brandPrimary + "25" }]} />}
    <View style={styles.heroShade} />
    <Pressable onPress={onBack} style={styles.heroButton} accessibilityLabel="Go back"><Ionicons name="chevron-back" size={24} color="#111827" /></Pressable>
    <Pressable onPress={() => void Share.share({ message: `${institution.name} on OnCampus` })} style={[styles.heroButton, { right: 16, left: undefined }]} accessibilityLabel="Share institution"><Ionicons name="share-outline" size={22} color="#111827" /></Pressable>
  </View>;
}

function ProfileHeader({ institution, bookmarked, onFollow, onBookmark, onShare }: { institution: any; bookmarked: boolean; onFollow: () => void; onBookmark: () => void; onShare: () => void }) {
  const { colors } = useTheme();
  return <View style={{ paddingHorizontal: spacing.lg, paddingBottom: 18 }}>
    <View style={styles.logoWrap}>{institution.logoUrl ? <Image source={{ uri: institution.logoUrl }} style={styles.logo} contentFit="cover" /> : <View style={[styles.logo, { backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }]}><Ionicons name="school" size={34} color="#fff" /></View>}</View>
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "900", flexShrink: 1 }}>{institution.name}</Text>{institution.verified ? <Ionicons name="checkmark-circle" size={20} color={colors.brandPrimary} /> : null}</View>
        <Text style={{ color: colors.brandPrimary, fontSize: 12, fontWeight: "800", marginTop: 6 }}>{institution.type}</Text>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: 13, marginTop: 7 }}><Ionicons name="location-outline" size={13} /> {[institution.city, institution.state, institution.country].filter(Boolean).join(", ")}</Text>
      </View>
      <Pressable onPress={onFollow} style={[styles.follow, { backgroundColor: institution.isFollowing ? colors.surfaceSecondary : colors.brandPrimary, borderColor: colors.brandPrimary }]}><Text style={{ color: institution.isFollowing ? colors.brandPrimary : "#fff", fontWeight: "900" }}>{institution.isFollowing ? "Following" : "Follow"}</Text></Pressable>
    </View>
    {institution.tagline || institution.shortDescription ? <Text style={{ color: colors.onSurfaceTertiary, lineHeight: 20, marginTop: 12 }}>{institution.tagline || institution.shortDescription}</Text> : null}
    <View style={styles.stats}><Stat value={institution.followersCount || 0} label="Followers" /><Stat value={institution.groupsCount || 0} label="Groups" /><Stat value={institution.eventsCount || 0} label="Events" /></View>
    <View style={styles.actions}><Action icon="share-outline" label="Share" onPress={onShare} /><Action icon={bookmarked ? "bookmark" : "bookmark-outline"} label={bookmarked ? "Saved" : "Save"} onPress={onBookmark} />{institution.website ? <Action icon="globe-outline" label="Website" onPress={() => void Linking.openURL(institution.website)} /> : null}</View>
  </View>;
}

function Stat({ value, label }: { value: number | string; label: string }) { const { colors } = useTheme(); return <View><Text style={{ color: colors.onSurface, fontWeight: "900", fontSize: 16 }}>{value}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 }}>{label}</Text></View>; }
function Action({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) { const { colors } = useTheme(); return <Pressable onPress={onPress} style={[styles.action, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}><Ionicons name={icon} size={18} color={colors.brandPrimary} /><Text style={{ color: colors.onSurface, fontWeight: "800", fontSize: 12 }}>{label}</Text></Pressable>; }

function HomeTab({ bundle, onTab }: { bundle: any; onTab: (tab: Tab) => void }) {
  const { colors } = useTheme();
  const story = bundle.story || []; const gallery = bundle.gallery || []; const events = bundle.events || []; const groups = bundle.groups || []; const opportunities = bundle.opportunities || []; const announcements = bundle.announcements || []; const achievements = bundle.achievements || [];
  return <View>
    <Section title="Our Campus Story" subtitle="Built through people, learning and milestones.">
      {story.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>{story.map((item: any) => <View key={item.id} style={[styles.storyCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}><View style={[styles.storyIcon, { backgroundColor: colors.brandPrimary + "14" }]}><Ionicons name={(item.icon || "ribbon-outline") as any} size={20} color={colors.brandPrimary} /></View>{item.year ? <Text style={{ color: colors.brandPrimary, fontWeight: "900", marginTop: 12 }}>{item.year}</Text> : null}<Text style={{ color: colors.onSurface, fontWeight: "900", marginTop: 4 }}>{item.title}</Text><Text numberOfLines={3} style={{ color: colors.onSurfaceTertiary, fontSize: 12, lineHeight: 17, marginTop: 5 }}>{item.description}</Text></View>)}</ScrollView> : <Empty text="Campus history will appear here." />}
    </Section>
    {gallery.length ? <Section title="Campus Gallery"><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>{gallery.slice(0, 12).map((item: any) => item.kind === "image" ? <View key={item.id} style={styles.galleryCard}><Image source={{ uri: item.url }} style={StyleSheet.absoluteFill} contentFit="cover" /><View style={styles.galleryShade} />{item.caption ? <Text numberOfLines={2} style={styles.galleryCaption}>{item.caption}</Text> : null}</View> : <View key={item.id} style={[styles.galleryCard, { backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }]}><Ionicons name="play-circle" size={42} color={colors.brandPrimary} /><Text style={{ color: colors.onSurface, marginTop: 6, fontWeight: "800" }}>Campus video</Text></View>)}</ScrollView></Section> : null}
    <Section title="Campus Pulse" subtitle="What’s happening right now">
      <View style={styles.pulseGrid}><Pulse icon="calendar-outline" title="Upcoming Events" value={`${events.length} events`} onPress={() => onTab("Events")} /><Pulse icon="megaphone-outline" title="Announcements" value={`${announcements.length} updates`} /><Pulse icon="people-outline" title="Active Groups" value={`${groups.length} communities`} onPress={() => onTab("Groups")} /><Pulse icon="briefcase-outline" title="Opportunities" value={`${opportunities.length} open`} onPress={() => onTab("Events")} /></View>
    </Section>
    {achievements.length ? <Section title="Highlights & Achievements"><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>{achievements.slice(0, 8).map((item: any) => <View key={item.id} style={[styles.highlight, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>{item.image_url ? <Image source={{ uri: item.image_url }} style={styles.highlightImage} contentFit="cover" /> : <Ionicons name="trophy-outline" size={24} color={colors.brandPrimary} />}<Text style={{ color: colors.onSurface, fontWeight: "900", marginTop: 9 }}>{item.title}</Text><Text numberOfLines={2} style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 5 }}>{item.description}</Text></View>)}</ScrollView></Section> : null}
  </View>;
}

function GroupsTab({ groups }: { groups: any[] }) {
  const { colors } = useTheme(); const router = useRouter();
  const categories = useMemo(() => Array.from(new Set(groups.map((g) => g.studio_category || g.category).filter(Boolean))).slice(0, 10), [groups]);
  return <View><Section title="Explore Campus Communities" subtitle="Official groups, departments, clubs and societies.">
    {categories.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.horizontal, { paddingTop: 0 }]}>{categories.map((category) => <View key={String(category)} style={[styles.categoryChip, { borderColor: colors.border }]}><Text style={{ color: colors.onSurface, fontWeight: "700", fontSize: 12 }}>{String(category)}</Text></View>)}</ScrollView> : null}
    <View style={{ gap: 10 }}>{groups.length ? groups.map((group) => <Pressable key={group.id} onPress={() => router.push(`/group/info/${group.id}` as any)} style={[styles.groupRow, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>{group.avatar_url ? <Image source={{ uri: group.avatar_url }} style={styles.groupAvatar} /> : <View style={[styles.groupAvatar, { backgroundColor: colors.brandPrimary + "15", alignItems: "center", justifyContent: "center" }]}><Ionicons name="people" size={22} color={colors.brandPrimary} /></View>}<View style={{ flex: 1 }}><View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}><Text style={{ color: colors.onSurface, fontWeight: "900", flexShrink: 1 }}>{group.name}</Text>{group.verified ? <Ionicons name="checkmark-circle" size={14} color={colors.brandPrimary} /> : null}</View><Text numberOfLines={2} style={{ color: colors.onSurfaceTertiary, fontSize: 12, lineHeight: 17, marginTop: 4 }}>{group.description || "Campus community"}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 5 }}>{group.memberCount || 0} members · {group.studio_category || group.category || "Community"}</Text></View><View style={[styles.join, { backgroundColor: colors.brandPrimary }]}><Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>View</Text></View></Pressable>) : <Empty text="No public campus communities yet." />}</View>
  </Section></View>;
}

function EventsTab({ events, opportunities, onRefresh }: { events: any[]; opportunities: any[]; onRefresh: () => void }) {
  const { colors } = useTheme();
  const rsvp = async (id: string) => { try { await campusApi.student.rsvp(id, "going"); Alert.alert("RSVP saved", "You’re going to this event."); onRefresh(); } catch (error) { Alert.alert("RSVP", error instanceof Error ? error.message : "Could not save RSVP."); } };
  return <View><Section title="Upcoming Events">{events.length ? <View style={{ gap: 10 }}>{events.map((event) => <View key={event.id} style={[styles.eventCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>{event.image_url ? <Image source={{ uri: event.image_url }} style={styles.eventImage} contentFit="cover" /> : <View style={[styles.eventImage, { backgroundColor: colors.brandPrimary + "12", alignItems: "center", justifyContent: "center" }]}><Ionicons name="calendar" size={28} color={colors.brandPrimary} /></View>}<View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontWeight: "900" }}>{event.title}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 5 }}>{new Date(event.start_at).toLocaleString()}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 3 }}>{event.location || "Campus"}</Text></View>{event.rsvp_enabled !== false ? <Pressable onPress={() => void rsvp(event.id)} style={[styles.join, { backgroundColor: colors.brandPrimary }]}><Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>RSVP</Text></Pressable> : null}</View>)}</View> : <Empty text="No upcoming events." />}</Section>
    <Section title="Opportunities" subtitle="Internships, placements, scholarships, workshops and more.">{opportunities.length ? <View style={{ gap: 9 }}>{opportunities.map((item) => <Pressable key={item.id} onPress={() => item.apply_url ? void Linking.openURL(item.apply_url) : undefined} style={[styles.opportunity, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}><View style={[styles.storyIcon, { backgroundColor: colors.brandPrimary + "12" }]}><Ionicons name="briefcase-outline" size={20} color={colors.brandPrimary} /></View><View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontWeight: "900" }}>{item.title}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 3 }}>{[item.kind, item.organization, item.location].filter(Boolean).join(" · ")}</Text>{item.deadline ? <Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 4 }}>Deadline {new Date(item.deadline).toLocaleDateString()}</Text> : null}</View><Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} /></Pressable>)}</View> : <Empty text="No active opportunities." />}</Section>
  </View>;
}

function CampusTab({ bundle }: { bundle: any }) {
  const { colors } = useTheme(); const departments = bundle.departments || []; const places = bundle.places || []; const programs = bundle.programs || [];
  return <View><Section title="Departments">{departments.length ? <View style={styles.twoCol}>{departments.map((item: any) => <View key={item.id} style={[styles.department, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>{item.logo_url ? <Image source={{ uri: item.logo_url }} style={styles.departmentLogo} /> : <Ionicons name="library-outline" size={24} color={colors.brandPrimary} />}<Text style={{ color: colors.onSurface, fontWeight: "900", marginTop: 9 }}>{item.name}</Text><Text numberOfLines={2} style={{ color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 4 }}>{item.description || item.code}</Text></View>)}</View> : <Empty text="Departments will appear here." />}</Section>
    <Section title="Campus Places & Facilities">{places.length ? <View style={{ gap: 8 }}>{places.map((place: any) => <View key={place.id} style={[styles.place, { borderBottomColor: colors.border }]}><Ionicons name="location-outline" size={20} color={colors.brandPrimary} /><View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontWeight: "800" }}>{place.name}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 3 }}>{[place.category, place.building, place.floor].filter(Boolean).join(" · ")}</Text></View></View>)}</View> : <Empty text="Campus map locations have not been published." />}</Section>
    {programs.length ? <Section title="Programs"><View style={{ gap: 8 }}>{programs.map((program: any) => <View key={program.id} style={[styles.opportunity, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}><Ionicons name="school-outline" size={23} color={colors.brandPrimary} /><View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontWeight: "900" }}>{program.name}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 3 }}>{[program.degree_type, program.duration].filter(Boolean).join(" · ")}</Text></View></View>)}</View></Section> : null}
  </View>;
}

function AboutTab({ bundle }: { bundle: any }) {
  const { colors } = useTheme(); const institution = bundle.institution; const staff = bundle.staffHighlights || [];
  return <View><Section title="About"><Text style={{ color: colors.onSurface, lineHeight: 23 }}>{institution.description || institution.shortDescription || "This institution has not published a full description yet."}</Text>{institution.establishedYear ? <Info icon="time-outline" label="Established" value={String(institution.establishedYear)} /> : null}<Info icon="location-outline" label="Location" value={[institution.city, institution.state, institution.country].filter(Boolean).join(", ")} />{institution.website ? <Info icon="globe-outline" label="Website" value={institution.website} /> : null}</Section>
    {institution.accreditation?.length ? <Section title="Accreditation"><View style={styles.tags}>{institution.accreditation.map((item: any, index: number) => <View key={index} style={[styles.categoryChip, { borderColor: colors.border }]}><Text style={{ color: colors.onSurface, fontSize: 12, fontWeight: "700" }}>{typeof item === "string" ? item : item.name || item.title || "Accredited"}</Text></View>)}</View></Section> : null}
    {institution.rankings?.length ? <Section title="Rankings"><View style={{ gap: 8 }}>{institution.rankings.map((item: any, index: number) => <View key={index} style={[styles.opportunity, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}><Ionicons name="ribbon-outline" size={22} color={colors.brandPrimary} /><View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontWeight: "900" }}>{typeof item === "string" ? item : item.title || item.name || `Ranking ${index + 1}`}</Text>{typeof item === "object" ? <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 3 }}>{[item.rank, item.body, item.year].filter(Boolean).join(" · ")}</Text> : null}</View></View>)}</View></Section> : null}
    {staff.length ? <Section title="Faculty & Staff Highlights"><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>{staff.slice(0, 12).map((person: any) => <View key={person.id} style={[styles.person, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}><View style={[styles.personAvatar, { backgroundColor: colors.brandPrimary + "14" }]}><Ionicons name="person" size={22} color={colors.brandPrimary} /></View><Text numberOfLines={2} style={{ color: colors.onSurface, fontWeight: "900", marginTop: 8 }}>{person.name}</Text><Text numberOfLines={2} style={{ color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 4 }}>{person.title}</Text></View>)}</ScrollView></Section> : null}
  </View>;
}

function Info({ icon, label, value }: { icon: any; label: string; value: string }) { const { colors } = useTheme(); if (!value) return null; return <View style={styles.info}><Ionicons name={icon} size={19} color={colors.brandPrimary} /><View><Text style={{ color: colors.onSurfaceTertiary, fontSize: 11 }}>{label}</Text><Text style={{ color: colors.onSurface, fontWeight: "700", marginTop: 2 }}>{value}</Text></View></View>; }
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) { const { colors } = useTheme(); return <View style={styles.section}><Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: "900" }}>{title}</Text>{subtitle ? <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 3 }}>{subtitle}</Text> : null}<View style={{ marginTop: 14 }}>{children}</View></View>; }
function Empty({ text }: { text: string }) { const { colors } = useTheme(); return <View style={{ paddingVertical: 22, alignItems: "center" }}><Ionicons name="sparkles-outline" size={26} color={colors.onSurfaceTertiary} /><Text style={{ color: colors.onSurfaceTertiary, marginTop: 7 }}>{text}</Text></View>; }
function Pulse({ icon, title, value, onPress }: { icon: any; title: string; value: string; onPress?: () => void }) { const { colors } = useTheme(); return <Pressable onPress={onPress} style={[styles.pulse, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}><View style={[styles.storyIcon, { backgroundColor: colors.brandPrimary + "12" }]}><Ionicons name={icon} size={20} color={colors.brandPrimary} /></View><Text style={{ color: colors.onSurface, fontWeight: "900", marginTop: 9 }}>{title}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 4 }}>{value}</Text></Pressable>; }

const styles = StyleSheet.create({
  hero: { height: 230, overflow: "hidden" },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,.12)" },
  heroButton: { position: "absolute", top: 14, left: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,.92)", alignItems: "center", justifyContent: "center" },
  logoWrap: { marginTop: -42, marginBottom: 8 }, logo: { width: 86, height: 86, borderRadius: 43, borderWidth: 4, borderColor: "#fff" },
  follow: { minWidth: 94, height: 42, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  stats: { flexDirection: "row", gap: 28, marginTop: 14 }, actions: { flexDirection: "row", gap: 8, marginTop: 15 }, action: { height: 38, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12 },
  tabs: { paddingHorizontal: spacing.lg }, tab: { minWidth: 76, height: 50, borderBottomWidth: 2, borderBottomColor: "transparent", alignItems: "center", justifyContent: "center", paddingHorizontal: 9 },
  section: { paddingHorizontal: spacing.lg, paddingTop: 22 }, horizontal: { gap: 10, paddingRight: spacing.lg },
  storyCard: { width: 170, minHeight: 155, borderWidth: 1, borderRadius: radius.lg, padding: 13 }, storyIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  galleryCard: { width: 245, height: 155, borderRadius: 18, overflow: "hidden" }, galleryShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,.16)" }, galleryCaption: { position: "absolute", bottom: 10, left: 12, right: 12, color: "#fff", fontWeight: "800" },
  pulseGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, pulse: { width: "48%", minHeight: 130, borderWidth: 1, borderRadius: 16, padding: 13 },
  highlight: { width: 190, minHeight: 150, borderWidth: 1, borderRadius: 16, padding: 12 }, highlightImage: { width: "100%", height: 82, borderRadius: 12 },
  categoryChip: { height: 34, borderRadius: 17, borderWidth: 1, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  groupRow: { minHeight: 94, borderWidth: 1, borderRadius: 16, padding: 11, flexDirection: "row", gap: 10, alignItems: "center" }, groupAvatar: { width: 54, height: 54, borderRadius: 16 }, join: { minWidth: 58, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  eventCard: { minHeight: 105, borderWidth: 1, borderRadius: 17, padding: 10, flexDirection: "row", gap: 10, alignItems: "center" }, eventImage: { width: 75, height: 75, borderRadius: 13 },
  opportunity: { minHeight: 68, borderWidth: 1, borderRadius: 15, padding: 11, flexDirection: "row", alignItems: "center", gap: 11 },
  twoCol: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, department: { width: "48%", minHeight: 130, borderWidth: 1, borderRadius: 16, padding: 12 }, departmentLogo: { width: 42, height: 42, borderRadius: 12 },
  place: { minHeight: 58, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 10, alignItems: "center" }, tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  info: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 14 }, person: { width: 130, minHeight: 135, borderWidth: 1, borderRadius: 16, padding: 11, alignItems: "center" }, personAvatar: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
});
