import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
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
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { campusApi } from "@/src/lib/campusApi";
import { API_BASE_URL, getAccessToken } from "@/src/lib/api";
import { useTheme } from "@/src/theme/ThemeProvider";
import CampusLoader from "@/src/components/CampusLoader";

export type InstitutionProfileV2Props = { institutionId: string };
type Tab = "Home" | "Groups" | "Events" | "Campus" | "About";
const TABS: Tab[] = ["Home", "Groups", "Events", "Campus", "About"];

async function engagement(path: string, method: "GET" | "POST" | "DELETE" = "GET") {
  const token = await getAccessToken();
  if (!token) throw new Error("Please sign in again.");
  const response = await fetch(`${API_BASE_URL}${path}`, { method, headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.detail || "Could not complete this action.");
  return data;
}

export default function InstitutionProfileV2({ institutionId }: InstitutionProfileV2Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const [bundle, setBundle] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("Home");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!institutionId) return;
    if (!quiet) setLoading(true);
    setError("");
    try {
      const [profile, state] = await Promise.all([
        campusApi.student.institutionProfile(institutionId),
        engagement(`/campus/directory/institutions/${encodeURIComponent(institutionId)}/engagement`).catch(() => ({})),
      ]);
      setBundle(profile);
      setBookmarked(Boolean(state?.bookmarked));
      void engagement(`/campus/directory/institutions/${encodeURIComponent(institutionId)}/view?source=discover`, "POST").catch(() => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this campus.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [institutionId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}><CampusLoader fullScreen label="Opening campus…" /></SafeAreaView>;
  if (!bundle?.institution || error) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}><View style={styles.error}><Ionicons name="cloud-offline-outline" size={40} color={colors.brandPrimary} /><Text style={[styles.errorTitle, { color: colors.onSurface }]}>Campus could not open</Text><Text style={[styles.errorBody, { color: colors.onSurfaceTertiary }]}>{error || "Please try again."}</Text><Pressable style={[styles.primaryButton, { backgroundColor: colors.brandPrimary }]} onPress={() => void load()}><Text style={styles.primaryText}>Try again</Text></Pressable><Pressable onPress={() => router.back()} style={{ marginTop: 14 }}><Text style={{ color: colors.brandPrimary, fontWeight: "800" }}>Go back</Text></Pressable></View></SafeAreaView>;

  const institution = bundle.institution;
  const toggleFollow = async () => {
    if (busy) return;
    const next = !institution.isFollowing;
    setBusy(true);
    setBundle((value: any) => ({ ...value, institution: { ...value.institution, isFollowing: next, followersCount: Math.max(0, Number(value.institution.followersCount || 0) + (next ? 1 : -1)) } }));
    try {
      if (next) await campusApi.student.followInstitution(institutionId);
      else await campusApi.student.unfollowInstitution(institutionId);
    } catch (e) {
      setBundle((value: any) => ({ ...value, institution: { ...value.institution, isFollowing: !next, followersCount: Math.max(0, Number(value.institution.followersCount || 0) + (next ? -1 : 1)) } }));
      Alert.alert("Follow", e instanceof Error ? e.message : "Could not update follow status.");
    } finally { setBusy(false); }
  };

  const toggleBookmark = async () => {
    if (busy) return;
    const next = !bookmarked;
    setBusy(true);
    setBookmarked(next);
    try { await engagement(`/campus/directory/institutions/${encodeURIComponent(institutionId)}/bookmark`, next ? "POST" : "DELETE"); }
    catch (e) { setBookmarked(!next); Alert.alert("Save", e instanceof Error ? e.message : "Could not update saved status."); }
    finally { setBusy(false); }
  };

  const share = () => Share.share({ message: `${institution.name}\n${institution.shortDescription || institution.tagline || "Explore this campus on OnCampus."}\noncampus://institution/${institutionId}` });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfaceSecondary }} edges={["top"]} testID="institution-profile-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[2]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={colors.brandPrimary} />}
        contentContainerStyle={{ paddingBottom: 112 }}
      >
        <Hero institution={institution} onBack={() => router.back()} onShare={() => void share()} />
        <Identity institution={institution} bookmarked={bookmarked} onFollow={() => void toggleFollow()} onShare={() => void share()} onBookmark={() => void toggleBookmark()} />
        <TabBar tab={tab} setTab={setTab} />
        {tab === "Home" ? <HomeTab bundle={bundle} setTab={setTab} /> : null}
        {tab === "Groups" ? <GroupsTab groups={bundle.groups || []} /> : null}
        {tab === "Events" ? <EventsTab events={bundle.events || []} opportunities={bundle.opportunities || []} onRefresh={() => void load(true)} /> : null}
        {tab === "Campus" ? <CampusTab bundle={bundle} /> : null}
        {tab === "About" ? <AboutTab bundle={bundle} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Hero({ institution, onBack, onShare }: { institution: any; onBack: () => void; onShare: () => void }) {
  return <View style={styles.hero}>
    {institution.coverUrl ? <Image source={{ uri: institution.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: "#DCE9FF" }]} />}
    <View style={styles.heroShade} />
    <Pressable onPress={onBack} style={[styles.heroAction, { left: 16 }]}><Ionicons name="chevron-back" size={25} color="#0B1947" /></Pressable>
    <Pressable onPress={onShare} style={[styles.heroAction, { right: 68 }]}><Ionicons name="share-outline" size={23} color="#0B1947" /></Pressable>
    <View style={[styles.heroAction, { right: 16 }]}><Ionicons name="ellipsis-horizontal" size={23} color="#0B1947" /></View>
  </View>;
}

function Identity({ institution, bookmarked, onFollow, onShare, onBookmark }: any) {
  const { colors } = useTheme();
  return <View style={[styles.identity, { backgroundColor: colors.surfaceSecondary }]}>
    <View style={styles.logoFloat}><CampusLogo institution={institution} size={82} /></View>
    <View style={styles.identityTop}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <View style={styles.nameLine}><Text style={[styles.name, { color: colors.onSurface }]}>{institution.name}</Text>{institution.verified ? <Ionicons name="checkmark-circle" size={19} color={colors.brandPrimary} /> : null}</View>
        <View style={[styles.kindPill, { backgroundColor: colors.brandTertiary }]}><Text style={{ color: colors.brandPrimary, fontWeight: "800", fontSize: 10 }}>{institution.type || "Institution"}</Text></View>
      </View>
      <Pressable onPress={onFollow} style={[styles.followButton, { backgroundColor: institution.isFollowing ? colors.surfaceSecondary : colors.brandPrimary, borderColor: colors.brandPrimary }]}><Text style={{ color: institution.isFollowing ? colors.brandPrimary : "#FFFFFF", fontWeight: "800", fontSize: 13 }}>{institution.isFollowing ? "Following" : "Follow"}</Text></Pressable>
    </View>
    <Text style={[styles.location, { color: colors.onSurfaceTertiary }]}><Ionicons name="location-outline" size={12} /> {[institution.city, institution.state, institution.country].filter(Boolean).join(", ") || "Campus"}</Text>
    {institution.tagline || institution.shortDescription ? <Text style={[styles.description, { color: colors.onSurfaceTertiary }]}>{institution.tagline || institution.shortDescription}</Text> : null}
    <View style={styles.followerRow}><Text style={{ color: colors.onSurface, fontWeight: "900" }}>{formatCount(institution.followersCount)}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12 }}> Followers</Text><View style={styles.dotSep} /><Text style={{ color: colors.onSurface, fontWeight: "900" }}>{formatCount(institution.followingCount || 0)}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12 }}> Following</Text></View>
    <View style={styles.actionRow}><SmallAction icon="share-outline" label="Share" onPress={onShare} /><SmallAction icon={bookmarked ? "bookmark" : "bookmark-outline"} label={bookmarked ? "Saved" : "Save"} onPress={onBookmark} />{institution.website ? <SmallAction icon="globe-outline" label="Website" onPress={() => void Linking.openURL(institution.website)} /> : null}</View>
  </View>;
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (value: Tab) => void }) {
  const { colors } = useTheme();
  const icons: Record<Tab, any> = { Home: "home-outline", Groups: "people-outline", Events: "calendar-outline", Campus: "business-outline", About: "information-circle-outline" };
  return <View style={[styles.tabShell, { backgroundColor: colors.surfaceSecondary, borderBottomColor: colors.border, borderTopColor: colors.border }]}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{TABS.map((item) => { const active = item === tab; return <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, active && { borderBottomColor: colors.brandPrimary }]}><Ionicons name={icons[item]} size={18} color={active ? colors.brandPrimary : colors.onSurfaceTertiary} /><Text style={{ color: active ? colors.brandPrimary : colors.onSurfaceTertiary, fontSize: 11, fontWeight: active ? "900" : "700" }}>{item}</Text></Pressable>; })}</ScrollView></View>;
}

function HomeTab({ bundle, setTab }: { bundle: any; setTab: (value: Tab) => void }) {
  const { colors } = useTheme();
  const institution = bundle.institution || {};
  const story = bundle.story || [];
  const gallery = bundle.gallery || [];
  const events = bundle.events || [];
  const groups = bundle.groups || [];
  const opportunities = bundle.opportunities || [];
  const announcements = bundle.announcements || [];
  const metrics = [
    ["ribbon-outline", institution.foundedYear || institution.founded_year || story.find((x: any) => x.year)?.year || "—", "Founded"],
    ["school-outline", formatCount(institution.studentsCount || institution.studentCount || institution.students_count), "Students"],
    ["people-outline", formatCount(institution.facultyCount || institution.faculty_count), "Faculty"],
    ["globe-outline", formatCount(institution.countriesCount || institution.countries_count), "Countries"],
  ];
  return <View>
    <Section title="Our Campus Story" subtitle={institution.storySubtitle || "Built on tradition. Driven by innovation. United in purpose."}>
      <View style={styles.metricGrid}>{metrics.map(([icon, value, label]) => <View key={String(label)} style={[styles.metricCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}><View style={[styles.metricIcon, { backgroundColor: colors.brandTertiary }]}><Ionicons name={icon as any} size={20} color={colors.brandPrimary} /></View><Text style={[styles.metricValue, { color: colors.onSurface }]}>{value}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 11 }}>{label}</Text></View>)}</View>
    </Section>
    <Section title="Campus Gallery" action={gallery.length ? "See All" : undefined}>
      {gallery.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>{gallery.slice(0, 12).map((item: any) => <Gallery key={item.id || item.url} item={item} />)}</ScrollView> : <Empty text="Campus photos and videos from Studio will appear here." />}
    </Section>
    <Section title="Campus Pulse" subtitle="What's happening on campus right now">
      <View style={styles.pulseGrid}><Pulse icon="calendar-outline" title="Upcoming Events" value={`${events.length} events`} onPress={() => setTab("Events")} /><Pulse icon="megaphone-outline" title="Official Announcements" value={`${announcements.length} updates`} /><Pulse icon="people-outline" title="Active Groups" value={`${groups.length} groups active`} onPress={() => setTab("Groups")} /><Pulse icon="briefcase-outline" title="Opportunities" value={`${opportunities.length} opportunities`} onPress={() => setTab("Events")} /></View>
    </Section>
    {announcements.length ? <Section title="Official Updates"><View style={{ gap: 10 }}>{announcements.slice(0, 4).map((item: any) => <View key={item.id} style={[styles.noticeCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}><View style={[styles.noticeIcon, { backgroundColor: colors.brandTertiary }]}><Ionicons name="megaphone" size={18} color={colors.brandPrimary} /></View><View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontWeight: "900" }}>{item.title}</Text><Text numberOfLines={3} style={{ color: colors.onSurfaceTertiary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>{item.body || item.content}</Text></View></View>)}</View></Section> : null}
  </View>;
}

function GroupsTab({ groups }: { groups: any[] }) {
  const { colors } = useTheme();
  const router = useRouter();
  const [category, setCategory] = useState("All");
  const categories = useMemo(() => ["All", ...Array.from(new Set(groups.map((g) => String(g.studio_category || g.category || "Other"))))].slice(0, 8), [groups]);
  const visible = category === "All" ? groups : groups.filter((g) => String(g.studio_category || g.category || "Other") === category);
  const featured = visible.filter((g) => g.featured || g.official || g.verified).slice(0, 4);
  const rest = visible.filter((g) => !featured.some((f) => f.id === g.id));
  return <View><Section title="Explore Campus Communities" subtitle="Discover and join groups that match your interests.">
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>{categories.map((item) => { const active = item === category; return <Pressable key={item} onPress={() => setCategory(item)} style={[styles.categoryChip, { borderColor: active ? colors.brandPrimary : colors.border, backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary }]}><Text style={{ color: active ? "#FFFFFF" : colors.onSurface, fontSize: 10, fontWeight: "800" }}>{item}</Text></Pressable>; })}</ScrollView>
  </Section>
  {featured.length ? <Section title="Featured Groups" action="See All"><View style={styles.groupGrid}>{featured.map((group) => <GroupCard key={group.id} group={group} onPress={() => router.push(`/group/info/${group.id}` as any)} />)}</View></Section> : null}
  <Section title="Department Communities" action={rest.length ? "See All" : undefined}>{rest.length ? <View style={styles.groupGrid}>{rest.slice(0, 12).map((group) => <GroupCard key={group.id} group={group} onPress={() => router.push(`/group/info/${group.id}` as any)} />)}</View> : featured.length ? null : <Empty text="Campus communities created in Institution Studio will appear here." />}</Section>
  </View>;
}

function GroupCard({ group, onPress }: { group: any; onPress: () => void }) {
  const { colors } = useTheme();
  return <View style={[styles.groupCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
    <View style={styles.groupCover}>{group.cover_url || group.coverUrl ? <Image source={{ uri: group.cover_url || group.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.brandTertiary }]} />}</View>
    <View style={styles.groupAvatarFloat}>{group.avatar_url || group.image ? <Image source={{ uri: group.avatar_url || group.image }} style={styles.groupAvatar} contentFit="cover" /> : <View style={[styles.groupAvatar, { backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }]}><Ionicons name="people" size={22} color="#FFFFFF" /></View>}</View>
    <View style={styles.groupBody}><View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Text numberOfLines={1} style={{ color: colors.onSurface, fontSize: 13, fontWeight: "900", flex: 1 }}>{group.name}</Text>{group.verified || group.official ? <Ionicons name="checkmark-circle" size={13} color={colors.brandPrimary} /> : null}</View><Text style={{ color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 3 }}>{formatCount(group.members_count || group.members)} members</Text><Text numberOfLines={2} style={{ color: colors.onSurfaceTertiary, fontSize: 10, lineHeight: 14, marginTop: 6 }}>{group.description || "Official campus community"}</Text><View style={styles.groupButtons}><Pressable onPress={onPress} style={[styles.outlineMini, { borderColor: `${colors.brandPrimary}70` }]}><Text style={{ color: colors.brandPrimary, fontSize: 10, fontWeight: "800" }}>View Group</Text></Pressable><Pressable onPress={onPress} style={[styles.fillMini, { backgroundColor: colors.brandPrimary }]}><Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "800" }}>Join</Text></Pressable></View></View>
  </View>;
}

function EventsTab({ events, opportunities, onRefresh }: { events: any[]; opportunities: any[]; onRefresh: () => void }) {
  const { colors } = useTheme();
  return <View><Section title="Upcoming Events" action={events.length ? "See All" : undefined}>{events.length ? <View style={{ gap: 10 }}>{events.slice(0, 12).map((event) => <EventCard key={event.id} event={event} onRefresh={onRefresh} />)}</View> : <Empty text="Upcoming Studio events will appear here." />}</Section><Section title="Opportunities" action={opportunities.length ? "See All" : undefined}>{opportunities.length ? <View style={styles.opportunityGrid}>{opportunities.slice(0, 10).map((item) => <Opportunity key={item.id} item={item} />)}</View> : <Empty text="Internships, placements, workshops and scholarships will appear here." />}</Section></View>;
}

function EventCard({ event, onRefresh }: { event: any; onRefresh: () => void }) {
  const { colors } = useTheme();
  const start = new Date(event.start_at || event.startAt || event.starts_at || event.date || Date.now());
  const [busy, setBusy] = useState(false);
  const rsvp = async () => { if (busy) return; setBusy(true); try { await campusApi.student.rsvp(event.id, "going"); onRefresh(); } catch (e) { Alert.alert("RSVP", e instanceof Error ? e.message : "Could not RSVP."); } finally { setBusy(false); } };
  return <View style={[styles.eventCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}><View style={[styles.dateTile, { borderColor: colors.border }]}><Text style={{ color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "900" }}>{start.toLocaleString(undefined, { month: "short" }).toUpperCase()}</Text><Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "900", marginTop: 1 }}>{String(start.getDate()).padStart(2, "0")}</Text><Text style={{ color: colors.onSurface, fontSize: 9, fontWeight: "800" }}>{start.toLocaleString(undefined, { weekday: "short" }).toUpperCase()}</Text></View>{event.cover_url || event.image_url || event.image ? <Image source={{ uri: event.cover_url || event.image_url || event.image }} style={styles.eventImage} contentFit="cover" /> : <View style={[styles.eventImage, { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }]}><Ionicons name="calendar" size={26} color={colors.brandPrimary} /></View>}<View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: colors.onSurface, fontSize: 14, fontWeight: "900" }}>{event.title}</Text>{event.subtitle || event.description ? <Text numberOfLines={1} style={{ color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 3 }}>{event.subtitle || event.description}</Text> : null}<Text style={[styles.eventMeta, { color: colors.onSurfaceTertiary }]}><Ionicons name="time-outline" size={11} /> {start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{event.end_at || event.endAt ? ` - ${new Date(event.end_at || event.endAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</Text><Text numberOfLines={1} style={[styles.eventMeta, { color: colors.onSurfaceTertiary }]}><Ionicons name="location-outline" size={11} /> {event.venue || event.location || "Campus"}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 7 }}>{formatCount(event.attendees_count || event.attendees || 0)} attending</Text></View><Pressable disabled={busy} onPress={() => void rsvp()} style={[styles.rsvp, { backgroundColor: colors.brandPrimary }]}><Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>{busy ? "…" : "RSVP"}</Text></Pressable></View>;
}

function Opportunity({ item }: { item: any }) {
  const { colors } = useTheme();
  const label = String(item.type || item.category || "Opportunity");
  const icon: any = /intern/i.test(label) ? "briefcase-outline" : /placement|career|job/i.test(label) ? "person-outline" : /workshop/i.test(label) ? "bulb-outline" : /scholar/i.test(label) ? "school-outline" : /competition/i.test(label) ? "trophy-outline" : "sparkles-outline";
  return <View style={[styles.opportunity, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}><View style={[styles.oppIcon, { backgroundColor: colors.brandTertiary }]}><Ionicons name={icon} size={19} color={colors.brandPrimary} /></View><Text numberOfLines={1} style={{ color: colors.onSurface, fontSize: 12, fontWeight: "900", marginTop: 10 }}>{item.title || label}</Text><Text numberOfLines={2} style={{ color: colors.onSurfaceTertiary, fontSize: 10, lineHeight: 14, marginTop: 4 }}>{item.subtitle || item.description || item.company || "New campus opportunity"}</Text></View>;
}

function CampusTab({ bundle }: { bundle: any }) {
  const { colors } = useTheme();
  const departments = bundle.departments || [];
  const programs = bundle.programs || [];
  const achievements = bundle.achievements || [];
  const places = bundle.places || bundle.campusPlaces || [];
  return <View><Section title="Campus Life" subtitle="Everything published by your institution, in one place.">{departments.length ? <InfoList title="Departments" icon="business-outline" items={departments} /> : null}{programs.length ? <InfoList title="Programs & Courses" icon="book-outline" items={programs} /> : null}{places.length ? <InfoList title="Campus Places" icon="location-outline" items={places} /> : null}{!departments.length && !programs.length && !places.length ? <Empty text="Campus departments, programs and places from Studio will appear here." /> : null}</Section>{achievements.length ? <Section title="Highlights & Achievements"><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achievementRow}>{achievements.map((item: any) => <View key={item.id} style={[styles.achievement, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>{item.image_url || item.imageUrl ? <Image source={{ uri: item.image_url || item.imageUrl }} style={styles.achievementImage} contentFit="cover" /> : <View style={[styles.achievementImage, { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }]}><Ionicons name="trophy" size={25} color={colors.brandPrimary} /></View>}<Text numberOfLines={2} style={{ color: colors.onSurface, fontWeight: "900", fontSize: 12, marginTop: 9 }}>{item.title}</Text><Text numberOfLines={2} style={{ color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 4 }}>{item.description}</Text></View>)}</ScrollView></Section> : null}</View>;
}

function AboutTab({ bundle }: { bundle: any }) {
  const { colors } = useTheme();
  const i = bundle.institution || {};
  const sections = bundle.sections || {};
  return <View><Section title="About"><View style={[styles.aboutCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}><Text style={{ color: colors.onSurfaceTertiary, fontSize: 13, lineHeight: 21 }}>{i.description || i.longDescription || i.shortDescription || "Institution information will appear here."}</Text></View></Section>{Object.entries(sections).map(([key, value]: any) => value ? <Section key={key} title={titleCase(key)}><View style={[styles.aboutCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}><Text style={{ color: colors.onSurfaceTertiary, fontSize: 13, lineHeight: 21 }}>{typeof value === "string" ? value : value?.body || value?.description || JSON.stringify(value)}</Text></View></Section> : null)}{i.website || i.email || i.phone ? <Section title="Contact"><View style={[styles.aboutCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>{i.website ? <Contact icon="globe-outline" text={i.website} onPress={() => void Linking.openURL(i.website)} /> : null}{i.email ? <Contact icon="mail-outline" text={i.email} onPress={() => void Linking.openURL(`mailto:${i.email}`)} /> : null}{i.phone ? <Contact icon="call-outline" text={i.phone} onPress={() => void Linking.openURL(`tel:${i.phone}`)} /> : null}</View></Section> : null}</View>;
}

function Section({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={styles.section}><View style={styles.sectionHeading}><View style={{ flex: 1 }}><Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{title}</Text>{subtitle ? <Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, lineHeight: 16, marginTop: 2 }}>{subtitle}</Text> : null}</View>{action ? <Text style={{ color: colors.brandPrimary, fontSize: 11, fontWeight: "900" }}>{action}</Text> : null}</View>{children}</View>;
}

function CampusLogo({ institution, size }: { institution: any; size: number }) {
  const { colors } = useTheme();
  if (institution.logoUrl) return <Image source={{ uri: institution.logoUrl }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#FFFFFF" }} contentFit="cover" />;
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}><Ionicons name="school" size={size * .45} color="#FFFFFF" /></View>;
}

function Gallery({ item }: { item: any }) {
  const { colors } = useTheme();
  const url = item.url || item.image_url || item.imageUrl;
  return <View style={[styles.galleryCard, { backgroundColor: colors.brandTertiary }]}>{url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} /> : <Ionicons name={item.kind === "video" ? "play-circle" : "image-outline"} size={30} color={colors.brandPrimary} />}{item.caption ? <View style={styles.galleryCaption}><Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "800" }}>{item.caption}</Text></View> : null}</View>;
}

function Pulse({ icon, title, value, onPress }: { icon: any; title: string; value: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return <Pressable onPress={onPress} style={[styles.pulse, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}><View style={[styles.pulseIcon, { backgroundColor: colors.brandTertiary }]}><Ionicons name={icon} size={20} color={colors.brandPrimary} /></View><View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: colors.onSurface, fontSize: 11, fontWeight: "900" }}>{title}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 9, marginTop: 3 }}>{value}</Text></View><Ionicons name="chevron-forward" size={13} color={colors.onSurfaceTertiary} /></Pressable>;
}

function InfoList({ title, icon, items }: { title: string; icon: any; items: any[] }) {
  const { colors } = useTheme();
  return <View style={{ marginBottom: 16 }}><Text style={{ color: colors.onSurface, fontWeight: "900", marginBottom: 8 }}>{title}</Text><View style={{ gap: 8 }}>{items.slice(0, 12).map((item, idx) => <View key={item.id || idx} style={[styles.infoRow, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}><View style={[styles.infoIcon, { backgroundColor: colors.brandTertiary }]}><Ionicons name={icon} size={18} color={colors.brandPrimary} /></View><View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontWeight: "800", fontSize: 12 }}>{item.name || item.title}</Text>{item.description ? <Text numberOfLines={2} style={{ color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 3 }}>{item.description}</Text> : null}</View></View>)}</View></View>;
}

function SmallAction({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable onPress={onPress} style={[styles.smallAction, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}><Ionicons name={icon} size={16} color={colors.brandPrimary} /><Text style={{ color: colors.onSurface, fontSize: 10, fontWeight: "800" }}>{label}</Text></Pressable>;
}
function Contact({ icon, text, onPress }: { icon: any; text: string; onPress: () => void }) { const { colors } = useTheme(); return <Pressable onPress={onPress} style={styles.contact}><Ionicons name={icon} size={18} color={colors.brandPrimary} /><Text style={{ color: colors.onSurface, fontSize: 12, flex: 1 }}>{text}</Text></Pressable>; }
function Empty({ text }: { text: string }) { const { colors } = useTheme(); return <View style={[styles.empty, { borderColor: colors.border }]}><Ionicons name="sparkles-outline" size={23} color={colors.brandPrimary} /><Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, textAlign: "center", marginTop: 7 }}>{text}</Text></View>; }
function titleCase(value: string) { return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (x) => x.toUpperCase()); }
function formatCount(value: any) { const n = Number(value || 0); if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M+`; if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K+`; return String(n); }

const styles = StyleSheet.create({
  hero: { height: 248, overflow: "hidden" },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(7,20,54,0.10)" },
  heroAction: { position: "absolute", top: 16, width: 45, height: 45, borderRadius: 23, backgroundColor: "rgba(255,255,255,0.94)", alignItems: "center", justifyContent: "center" },
  identity: { paddingHorizontal: 18, paddingTop: 42, paddingBottom: 16 },
  logoFloat: { position: "absolute", top: -44, left: 18, width: 94, height: 94, borderRadius: 47, padding: 6, backgroundColor: "#FFFFFF", shadowColor: "#0B1947", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  identityTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 5 },
  name: { fontSize: 23, lineHeight: 28, fontWeight: "900", letterSpacing: -0.5, flexShrink: 1 },
  kindPill: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  followButton: { minWidth: 88, height: 42, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  location: { fontSize: 11, marginTop: 8 },
  description: { fontSize: 12, lineHeight: 18, marginTop: 9 },
  followerRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  dotSep: { width: 3, height: 3, borderRadius: 2, backgroundColor: "#C7CFDE", marginHorizontal: 10 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 13 },
  smallAction: { minWidth: 70, height: 36, paddingHorizontal: 10, borderWidth: 1, borderRadius: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  tabShell: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  tabs: { minWidth: "100%", paddingHorizontal: 10 },
  tab: { flexGrow: 1, minWidth: 70, height: 66, borderBottomWidth: 2, borderBottomColor: "transparent", alignItems: "center", justifyContent: "center", gap: 5 },
  section: { paddingHorizontal: 18, paddingTop: 24 },
  sectionHeading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "900", letterSpacing: -0.25 },
  metricGrid: { flexDirection: "row", gap: 8 },
  metricCard: { flex: 1, minHeight: 102, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", padding: 8 },
  metricIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  metricValue: { fontSize: 16, fontWeight: "900", marginTop: 7 },
  galleryRow: { gap: 8 },
  galleryCard: { width: 145, height: 94, borderRadius: 13, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  galleryCaption: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: "rgba(5,17,48,0.55)" },
  pulseGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  pulse: { width: "48.5%", minHeight: 72, borderWidth: 1, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 8, padding: 10 },
  pulseIcon: { width: 35, height: 35, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  noticeCard: { borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: "row", gap: 10 },
  noticeIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  categoryRow: { gap: 7, paddingRight: 10 },
  categoryChip: { paddingHorizontal: 11, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  groupGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  groupCard: { width: "48.5%", borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  groupCover: { height: 74 },
  groupAvatarFloat: { position: "absolute", top: 53, left: 10, borderRadius: 23, padding: 2, backgroundColor: "#FFFFFF" },
  groupAvatar: { width: 42, height: 42, borderRadius: 21 },
  groupBody: { padding: 10, paddingTop: 25 },
  groupButtons: { flexDirection: "row", gap: 6, marginTop: 9 },
  outlineMini: { flex: 1, height: 30, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  fillMini: { flex: 1, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  eventCard: { borderWidth: 1, borderRadius: 14, padding: 10, flexDirection: "row", gap: 10, alignItems: "center" },
  dateTile: { width: 51, height: 76, borderWidth: 1, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  eventImage: { width: 84, height: 76, borderRadius: 10 },
  eventMeta: { fontSize: 9.5, marginTop: 5 },
  rsvp: { alignSelf: "flex-end", minWidth: 54, height: 31, paddingHorizontal: 9, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  opportunityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  opportunity: { width: "31.7%", minHeight: 126, borderWidth: 1, borderRadius: 14, padding: 11 },
  oppIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  infoRow: { minHeight: 64, borderWidth: 1, borderRadius: 13, padding: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  infoIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  achievementRow: { gap: 9 },
  achievement: { width: 155, borderWidth: 1, borderRadius: 14, padding: 10 },
  achievementImage: { width: "100%", height: 78, borderRadius: 10 },
  aboutCard: { borderWidth: 1, borderRadius: 14, padding: 14 },
  contact: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10 },
  empty: { minHeight: 100, borderWidth: 1, borderStyle: "dashed", borderRadius: 14, alignItems: "center", justifyContent: "center", padding: 16 },
  error: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  errorTitle: { fontSize: 20, fontWeight: "900", marginTop: 13 },
  errorBody: { fontSize: 12, textAlign: "center", lineHeight: 18, marginTop: 6 },
  primaryButton: { marginTop: 20, minWidth: 130, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
});
