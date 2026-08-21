import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import { useRole } from "@/src/context/RoleProvider";
import { campusApi } from "@/src/lib/campusApi";

type ComposeKind = "feedback" | "lost" | "found" | "marketplace" | "join" | null;

export default function CampusHub() {
  const { colors } = useTheme();
  const router = useRouter();
  const { canManageInstitution } = useRole();
  const [hub, setHub] = useState<any>(null);
  const [trending, setTrending] = useState<any>({ hashtags: [], posts: [], events: [] });
  const [history, setHistory] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [compose, setCompose] = useState<ComposeKind>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (canManageInstitution) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!quiet) setLoading(true);
    try {
      const [nextHub, nextTrending, nextHistory] = await Promise.all([
        campusApi.student.hub(),
        campusApi.student.trending().catch(() => ({ hashtags: [], posts: [], events: [] })),
        campusApi.student.searchHistory().catch(() => []),
      ]);
      setHub(nextHub);
      setTrending(nextTrending);
      setHistory(nextHistory);
    } catch (error) {
      setHub(null);
      if (!quiet) Alert.alert("Campus", error instanceof Error ? error.message : "Could not load your campus workspace.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canManageInstitution]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const search = async () => {
    const value = query.trim();
    if (value.length < 2) return;
    setSearching(true);
    try {
      const next = await campusApi.student.search(value);
      setResults(next);
      setHistory(await campusApi.student.searchHistory().catch(() => history));
    } catch (error) {
      Alert.alert("Search", error instanceof Error ? error.message : "Search failed.");
    } finally { setSearching(false); }
  };

  const openCompose = (kind: ComposeKind) => {
    const defaults: Record<string, Record<string, string>> = {
      feedback: { subject: "", message: "", rating: "5" },
      lost: { title: "", description: "", location: "" },
      found: { title: "", description: "", location: "" },
      marketplace: { title: "", description: "", category: "other", price: "0" },
      join: { code: "" },
    };
    setForm(defaults[kind || "feedback"] || {});
    setCompose(kind);
  };

  const submitCompose = async () => {
    if (!compose || submitting) return;
    setSubmitting(true);
    try {
      if (compose === "feedback") {
        await campusApi.student.feedback({ subject: form.subject, message: form.message, rating: Number(form.rating || 5) });
        Alert.alert("Thank you", "Your feedback was submitted to OnCampus.");
      } else if (compose === "lost" || compose === "found") {
        await campusApi.student.createLostFound({ kind: compose, title: form.title, description: form.description || "", location: form.location || null });
        Alert.alert("Posted", `${compose === "lost" ? "Lost" : "Found"} item added to your campus board.`);
      } else if (compose === "marketplace") {
        await campusApi.student.createMarketplace({ title: form.title, description: form.description || "", category: form.category || "other", price: Number(form.price || 0), currency: "INR", imageUrls: [] });
        Alert.alert("Listed", "Your marketplace item is live for your campus.");
      } else if (compose === "join") {
        const code = form.code.trim();
        const invite = await campusApi.student.invite(code);
        Alert.alert("Join campus", `${invite.institution?.name || "Institution"}\n${invite.inviteType || "institution"} invite`, [
          { text: "Cancel", style: "cancel" },
          { text: "Accept", onPress: async () => { try { await campusApi.student.acceptInvite(code); Alert.alert("Joined", "The invite was accepted successfully."); await load(true); } catch (error) { Alert.alert("Could not join", error instanceof Error ? error.message : "Please try again."); } } },
        ]);
      }
      setCompose(null);
      await load(true);
    } catch (error) {
      Alert.alert("Could not complete", error instanceof Error ? error.message : "Please check the information and try again.");
    } finally { setSubmitting(false); }
  };

  if (canManageInstitution) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
          <Text style={{ color: colors.onSurface, fontSize: 28, fontWeight: "800" }}>Campus</Text>
          <Text style={{ color: colors.onSurfaceTertiary, marginTop: 5, lineHeight: 20 }}>Institution accounts use the operations workspace to manage students, people, content, events and campus services.</Text>
          <Pressable onPress={() => router.push("/institution/campus-platform" as any)} style={[styles.adminCard, { backgroundColor: colors.brandPrimary }]}>
            <View style={{ flex: 1 }}><Text style={{ color: "#fff", fontSize: 20, fontWeight: "800" }}>Open Campus Platform</Text><Text style={{ color: "#ffffffd5", marginTop: 5, lineHeight: 20 }}>Approvals · staff · events · broadcasts · moderation · analytics · integrations</Text></View><Ionicons name="arrow-forward-circle" size={36} color="#fff" />
          </Pressable>
          <Pressable onPress={() => router.push("/institution/content" as any)} style={[styles.adminSecondary, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Ionicons name="create-outline" size={22} color={colors.brandPrimary} /><View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontWeight: "700" }}>Content Studio</Text><Text style={{ color: colors.onSurfaceTertiary, marginTop: 3 }}>Advanced posts and cross-institution requests</Text></View><Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} /></Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const institution = hub?.institution;
  const emergency = hub?.emergency || [];
  const events = hub?.events || [];
  const opportunities = hub?.opportunities || [];
  const lostFound = hub?.lostFound || [];
  const marketplace = hub?.marketplace || [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="campus-hub-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={colors.brandPrimary} />}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}><Text style={[styles.title, { color: colors.onSurface }]}>Campus</Text><Text style={{ color: colors.onSurfaceTertiary, marginTop: 2 }}>{institution?.name || "Your institution"}</Text></View>
          {institution?.logo_url ? <Image source={{ uri: institution.logo_url }} style={styles.logo} contentFit="cover" /> : <View style={[styles.logo, { backgroundColor: colors.brandPrimary + "18", alignItems: "center", justifyContent: "center" }]}><Ionicons name="school" size={22} color={colors.brandPrimary} /></View>}
        </View>

        <View style={{ paddingHorizontal: spacing.lg }}>
          <View style={[styles.search, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Ionicons name="search" size={19} color={colors.onSurfaceTertiary} />
            <TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => void search()} returnKeyType="search" placeholder="Search campus, groups, events, jobs, posts…" placeholderTextColor={colors.muted} style={{ flex: 1, color: colors.onSurface, fontSize: font.base }} />
            {searching ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : query.length > 0 ? <Pressable onPress={() => { setQuery(""); setResults(null); }}><Ionicons name="close-circle" size={19} color={colors.onSurfaceTertiary} /></Pressable> : null}
          </View>
        </View>

        {history.length > 0 && !results && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.history}>{history.slice(0, 8).map((item) => <Pressable key={item.id} onPress={() => { setQuery(item.query); setTimeout(() => void campusApi.student.search(item.query).then(setResults), 0); }} style={[styles.historyChip, { borderColor: colors.border }]}><Ionicons name="time-outline" size={13} color={colors.onSurfaceTertiary} /><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12 }}>{item.query}</Text></Pressable>)}</ScrollView>}

        {results && <SearchResults results={results} onOpenPost={(id) => router.push(`/post/${id}`)} onOpenGroup={(id) => router.push(`/group/info/${id}`)} />}

        {!results && (
          <>
            {emergency.map((alert: any) => <View key={alert.id} style={[styles.emergency, { borderColor: colors.error + "55", backgroundColor: colors.error + "10" }]}><Ionicons name="warning" size={22} color={colors.error} /><View style={{ flex: 1 }}><Text style={{ color: colors.error, fontWeight: "800" }}>{alert.title}</Text><Text style={{ color: colors.onSurface, marginTop: 3, lineHeight: 19 }}>{alert.body}</Text></View></View>)}

            <View style={styles.quickGrid}>
              <Quick icon="calendar" label="Events" onPress={() => scrollHint("Events", events.length)} />
              <Quick icon="card" label="Digital ID" onPress={async () => { try { const id = await campusApi.student.digitalId(); Alert.alert("Digital Campus ID", `${id.public_id}\nStatus: ${id.status}`); } catch (error) { Alert.alert("Digital ID", error instanceof Error ? error.message : "Not issued yet."); } }} />
              <Quick icon="briefcase" label="Placements" onPress={() => scrollHint("Opportunities", opportunities.length)} />
              <Quick icon="search-circle" label="Lost & Found" onPress={() => openCompose("lost")} />
              <Quick icon="storefront" label="Marketplace" onPress={() => openCompose("marketplace")} />
              <Quick icon="map" label="Campus Map" onPress={async () => { try { const places = await campusApi.student.places(); Alert.alert("Campus places", places.slice(0, 12).map((p) => `• ${p.name}${p.floor ? ` (${p.floor})` : ""}`).join("\n") || "No places have been added yet."); } catch (error) { Alert.alert("Campus Map", error instanceof Error ? error.message : "Unavailable"); } }} />
              <Quick icon="qr-code" label="Join by QR/code" onPress={() => openCompose("join")} />
              <Quick icon="chatbox-ellipses" label="Feedback" onPress={() => openCompose("feedback")} />
            </View>

            {trending?.hashtags?.length > 0 && <Section title="Trending on campus"><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{trending.hashtags.slice(0, 12).map((tag: any) => <Pressable key={tag.tag} onPress={() => { setQuery(`#${tag.tag}`); }} style={[styles.tag, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>#{tag.tag}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 11 }}>{tag.count}</Text></Pressable>)}</ScrollView></Section>}

            <Section title="Upcoming events">
              {loading ? <ActivityIndicator color={colors.brandPrimary} /> : events.length === 0 ? <Empty text="No upcoming campus events." /> : events.slice(0, 6).map((event: any) => <View key={event.id} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><View style={[styles.dateBox, { backgroundColor: colors.brandPrimary + "14" }]}><Text style={{ color: colors.brandPrimary, fontWeight: "800", fontSize: 18 }}>{new Date(event.start_at).getDate()}</Text><Text style={{ color: colors.brandPrimary, fontSize: 10, fontWeight: "700" }}>{new Date(event.start_at).toLocaleString(undefined, { month: "short" }).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontWeight: "700" }}>{event.title}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 3 }}>{event.location || new Date(event.start_at).toLocaleString()}</Text></View><Pressable onPress={async () => { try { await campusApi.student.rsvp(event.id, "going"); Alert.alert("RSVP saved", "You’re going to this event."); await load(true); } catch (error) { Alert.alert("RSVP", error instanceof Error ? error.message : "Could not save RSVP"); } }} style={[styles.rsvp, { borderColor: colors.brandPrimary + "66" }]}><Text style={{ color: colors.brandPrimary, fontSize: 12, fontWeight: "700" }}>{event.myRsvp?.status === "going" ? "Going" : "RSVP"}</Text></Pressable></View>)}
            </Section>

            <Section title="Opportunities">
              {opportunities.length === 0 ? <Empty text="No placements or internships published yet." /> : opportunities.slice(0, 6).map((item: any) => <View key={item.id} style={[styles.lineItem, { borderBottomColor: colors.border }]}><View style={[styles.lineIcon, { backgroundColor: colors.brandPrimary + "14" }]}><Ionicons name="briefcase-outline" size={19} color={colors.brandPrimary} /></View><View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontWeight: "700" }}>{item.title}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 3 }}>{[item.kind, item.organization, item.location].filter(Boolean).join(" · ")}</Text></View></View>)}
            </Section>

            <Section title="Lost & Found" action="Post item" onAction={() => openCompose("lost")}>
              {lostFound.length === 0 ? <Empty text="No open lost or found items." /> : lostFound.slice(0, 5).map((item: any) => <View key={item.id} style={[styles.lineItem, { borderBottomColor: colors.border }]}><Ionicons name={item.kind === "lost" ? "search-outline" : "checkmark-circle-outline"} size={20} color={item.kind === "lost" ? "#D9983A" : colors.success} /><View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontWeight: "700" }}>{item.title}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 }}>{item.kind.toUpperCase()}{item.location ? ` · ${item.location}` : ""}</Text></View></View>)}
            </Section>

            <Section title="Campus marketplace" action="List item" onAction={() => openCompose("marketplace")}>
              {marketplace.length === 0 ? <Empty text="No active campus listings." /> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>{marketplace.slice(0, 8).map((item: any) => <View key={item.id} style={[styles.marketCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><View style={[styles.marketImage, { backgroundColor: colors.surfaceTertiary }]}>{item.image_urls?.[0] ? <Image source={{ uri: item.image_urls[0] }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="storefront-outline" size={28} color={colors.onSurfaceTertiary} />}</View><Text numberOfLines={1} style={{ color: colors.onSurface, fontWeight: "700", marginTop: 9 }}>{item.title}</Text><Text style={{ color: colors.brandPrimary, fontWeight: "800", marginTop: 3 }}>₹{Number(item.price || 0).toLocaleString()}</Text></View>)}</ScrollView>}
            </Section>
          </>
        )}
      </ScrollView>
      <ComposeModal kind={compose} values={form} setValues={setForm} submitting={submitting} onClose={() => setCompose(null)} onSubmit={() => void submitCompose()} />
    </SafeAreaView>
  );
}

function SearchResults({ results, onOpenPost, onOpenGroup }: { results: any; onOpenPost: (id: string) => void; onOpenGroup: (id: string) => void }) {
  const { colors } = useTheme();
  const categories: Array<[string, any[], any]> = [["Groups", results.groups || [], onOpenGroup], ["Posts", results.posts || [], onOpenPost], ["Events", results.events || [], undefined], ["Opportunities", results.opportunities || [], undefined], ["Marketplace", results.marketplace || [], undefined], ["Lost & Found", results.lostFound || [], undefined]];
  return <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}><Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: "800" }}>{results.resultCount || 0} results</Text><Text style={{ color: colors.onSurfaceTertiary, marginTop: 3, fontSize: 12 }}>Smart campus search · {results.ranking || "ranked results"}</Text>{categories.map(([label, items, opener]) => items.length > 0 ? <View key={label} style={{ marginTop: spacing.xl }}><Text style={{ color: colors.onSurface, fontWeight: "800", marginBottom: 8 }}>{label}</Text>{items.slice(0, 8).map((item: any) => <Pressable key={item.id} disabled={!opener} onPress={() => opener?.(item.id)} style={[styles.searchResult, { borderBottomColor: colors.border }]}><Ionicons name="search-outline" size={18} color={colors.brandPrimary} /><View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontWeight: "700" }}>{item.name || item.title || item.question || "Result"}</Text><Text numberOfLines={2} style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 }}>{item.description || item.content || item.organization || item.location || ""}</Text></View>{opener && <Ionicons name="chevron-forward" size={17} color={colors.onSurfaceTertiary} />}</Pressable>)}</View> : null)}</View>;
}

function Quick({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) { const { colors } = useTheme(); return <Pressable onPress={onPress} style={styles.quick}><View style={[styles.quickIcon, { backgroundColor: colors.brandPrimary + "14" }]}><Ionicons name={icon} size={21} color={colors.brandPrimary} /></View><Text style={{ color: colors.onSurface, fontSize: 11, fontWeight: "600", textAlign: "center" }}>{label}</Text></Pressable>; }
function Section({ title, children, action, onAction }: { title: string; children: React.ReactNode; action?: string; onAction?: () => void }) { const { colors } = useTheme(); return <View style={{ marginTop: spacing.xl, paddingHorizontal: spacing.lg }}><View style={styles.sectionHeader}><Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "800" }}>{title}</Text>{action && onAction && <Pressable onPress={onAction}><Text style={{ color: colors.brandPrimary, fontWeight: "700", fontSize: 13 }}>{action}</Text></Pressable>}</View>{children}</View>; }
function Empty({ text }: { text: string }) { const { colors } = useTheme(); return <View style={{ paddingVertical: spacing.xl, alignItems: "center" }}><Ionicons name="sparkles-outline" size={24} color={colors.onSurfaceTertiary} /><Text style={{ color: colors.onSurfaceTertiary, marginTop: 8 }}>{text}</Text></View>; }
function scrollHint(name: string, count: number) { Alert.alert(name, count ? `${count} item${count === 1 ? "" : "s"} available below.` : `No ${name.toLowerCase()} available yet.`); }

function ComposeModal({ kind, values, setValues, submitting, onClose, onSubmit }: { kind: ComposeKind; values: Record<string, string>; setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>; submitting: boolean; onClose: () => void; onSubmit: () => void }) {
  const { colors } = useTheme();
  if (!kind) return null;
  const map: Record<string, Array<[string, string, boolean?]>> = {
    feedback: [["subject", "Subject"], ["message", "Your feedback", true], ["rating", "Rating 1–5"]],
    lost: [["title", "What did you lose?"], ["description", "Description", true], ["location", "Last seen location"]],
    found: [["title", "What did you find?"], ["description", "Description", true], ["location", "Found at"]],
    marketplace: [["title", "Item name"], ["description", "Description", true], ["category", "Category"], ["price", "Price (₹)"]],
    join: [["code", "Invite code"]],
  };
  const title = kind === "join" ? "Join campus" : kind === "marketplace" ? "List marketplace item" : kind === "feedback" ? "Send feedback" : kind === "lost" ? "Report lost item" : "Report found item";
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalOverlay}><View style={[styles.modal, { backgroundColor: colors.surface }]}><View style={styles.modalHeader}><Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: "800" }}>{title}</Text><Pressable onPress={onClose}><Ionicons name="close" size={24} color={colors.onSurface} /></Pressable></View><ScrollView keyboardShouldPersistTaps="handled">{map[kind].map(([key, label, multiline]) => <View key={key} style={{ marginTop: spacing.md }}><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>{label}</Text><TextInput value={values[key] || ""} onChangeText={(value) => setValues((previous) => ({ ...previous, [key]: value }))} multiline={multiline} placeholder={label} placeholderTextColor={colors.muted} style={[styles.input, multiline && { minHeight: 96, textAlignVertical: "top" }, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} /></View>)}<Pressable disabled={submitting} onPress={onSubmit} style={[styles.submit, { backgroundColor: colors.brandPrimary, opacity: submitting ? .65 : 1 }]}>{submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "800" }}>Continue</Text>}</Pressable></ScrollView></View></View></Modal>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md },
  title: { fontSize: 28, fontWeight: "800" }, logo: { width: 46, height: 46, borderRadius: 13, overflow: "hidden" },
  search: { minHeight: 48, borderRadius: radius.lg, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 13 },
  history: { paddingHorizontal: spacing.lg, gap: 7, marginTop: 9 }, historyChip: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 16, paddingHorizontal: 9, paddingVertical: 6 },
  emergency: { marginHorizontal: spacing.lg, marginTop: spacing.lg, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: "row", gap: spacing.md },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, marginTop: spacing.xl, rowGap: spacing.lg },
  quick: { width: "25%", alignItems: "center", paddingHorizontal: 4, gap: 6 }, quickIcon: { width: 48, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  tag: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: 8 },
  dateBox: { width: 46, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" }, rsvp: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7 },
  lineItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth }, lineIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  marketCard: { width: 145, borderWidth: 1, borderRadius: radius.lg, padding: 10 }, marketImage: { height: 86, borderRadius: 10, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  searchResult: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  adminCard: { marginTop: spacing.xl, borderRadius: 22, padding: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md }, adminSecondary: { marginTop: spacing.md, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,.45)", justifyContent: "flex-end" }, modal: { maxHeight: "85%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg }, modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11, minHeight: 46 }, submit: { minHeight: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.xl, marginBottom: 18 },
});
