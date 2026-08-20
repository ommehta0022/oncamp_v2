import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import BottomSheet from "@/src/components/BottomSheet";
import RichPostText from "@/src/components/RichPostText";
import { useToast } from "@/src/components/Toast";
import { api } from "@/src/lib/api";
import {
  institutionContentApi,
  InstitutionContentRequest,
  InstitutionContentStatus,
  PublishDestination,
} from "@/src/lib/institutionContentApi";

export default function InstitutionContentRequestDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showToast } = useToast();
  const [item, setItem] = useState<InstitutionContentRequest | null>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<"message" | "changes" | "reject" | "approve" | "revise" | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [revisionTitle, setRevisionTitle] = useState("");
  const [revisionContent, setRevisionContent] = useState("");
  const [publishSheet, setPublishSheet] = useState(false);
  const [destinations, setDestinations] = useState<PublishDestination[]>([{ type: "feed" }]);

  const load = useCallback(async (refresh = false) => {
    if (!id) return;
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const [request, dashboard] = await Promise.all([
        institutionContentApi.request(id),
        api.institutions.dashboard().catch(() => ({ groups: [] })),
      ]);
      setItem(request);
      setGroups(Array.isArray((dashboard as any)?.groups) ? (dashboard as any).groups : []);
      setRevisionTitle(request.title || "");
      setRevisionContent(request.content || "");
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : "Could not load request.", variant: "error" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, showToast]);

  useEffect(() => { void load(); }, [load]);

  const isTarget = item?.side === "target";
  const isSource = item?.side === "source";
  const canReview = isTarget && ["pending", "revised"].includes(item?.status || "");
  const canRevise = isSource && item?.status === "changes_requested";
  const canPublish = isTarget && ["approved", "partially_published", "published"].includes(item?.status || "");
  const canWithdraw = isSource && ["pending", "changes_requested", "revised"].includes(item?.status || "");

  const peer = isTarget ? item?.sourceInstitution : item?.targetInstitution;

  const runAction = async () => {
    if (!item || !action || busy) return;
    const message = actionMessage.trim();
    if (["message", "changes", "reject", "revise"].includes(action) && !message) {
      showToast({ message: "Add a message first.", variant: "warning" });
      return;
    }
    setBusy(true);
    try {
      if (action === "message") await institutionContentApi.message(item.id, message);
      if (action === "changes") await institutionContentApi.requestChanges(item.id, message);
      if (action === "reject") await institutionContentApi.reject(item.id, message);
      if (action === "approve") await institutionContentApi.approve(item.id, message || "Approved");
      if (action === "revise") await institutionContentApi.revise(item.id, { title: revisionTitle.trim() || item.title, content: revisionContent.trim(), message });
      showToast({
        message: action === "changes" ? "Changes requested" : action === "reject" ? "Request rejected" : action === "approve" ? "Request approved" : action === "revise" ? "Revision sent" : "Message sent",
        variant: "success",
      });
      setAction(null);
      setActionMessage("");
      await load();
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : "Action failed.", variant: "error" });
    } finally { setBusy(false); }
  };

  const withdraw = () => {
    if (!item || busy) return;
    Alert.alert("Withdraw request?", "The receiving institution will no longer be able to approve it.", [
      { text: "Cancel", style: "cancel" },
      { text: "Withdraw", style: "destructive", onPress: async () => {
        setBusy(true);
        try {
          await institutionContentApi.withdraw(item.id);
          showToast({ message: "Request withdrawn", variant: "success" });
          await load();
        } catch (e) { showToast({ message: e instanceof Error ? e.message : "Could not withdraw request.", variant: "error" }); }
        finally { setBusy(false); }
      } },
    ]);
  };

  const toggleFeed = () => setDestinations((current) => current.some((d) => d.type === "feed") ? current.filter((d) => d.type !== "feed") : [{ type: "feed" }, ...current]);
  const toggleGroup = (groupId: string) => setDestinations((current) => current.some((d) => d.type === "group" && d.groupId === groupId) ? current.filter((d) => !(d.type === "group" && d.groupId === groupId)) : [...current, { type: "group", groupId }]);

  const publish = async () => {
    if (!item || busy || destinations.length === 0) return;
    setBusy(true);
    try {
      const response: any = await institutionContentApi.publish(item.id, destinations, undefined, true);
      const publishedCount = Array.isArray(response?.results) ? response.results.filter((result: any) => !result.duplicate).length : destinations.length;
      showToast({ message: publishedCount ? `Published to ${publishedCount} destination${publishedCount === 1 ? "" : "s"}` : "Already published to selected destinations", variant: "success" });
      setPublishSheet(false);
      await load();
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : "Could not publish this request.", variant: "error" });
    } finally { setBusy(false); }
  };

  if (loading && !item) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }} edges={["top"]}><ActivityIndicator color={colors.brandPrimary} /><Text style={{ color: colors.onSurfaceTertiary, marginTop: spacing.md }}>Loading request…</Text></SafeAreaView>;
  }

  if (!item) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}><Header title="Post request" onBack={() => router.back()} /><View style={{ padding: spacing.xl }}><Text style={{ color: colors.onSurface }}>This request is unavailable.</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Post request" subtitle={isTarget ? `From ${peer?.name || "institution"}` : `To ${peer?.name || "institution"}`} onBack={() => router.back()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.brandPrimary} />}
      >
        <View style={[styles.statusHero, { backgroundColor: statusColor(item.status, colors) + "18", borderColor: statusColor(item.status, colors) + "55" }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: statusColor(item.status, colors), fontSize: font.sm, fontWeight: "800", letterSpacing: .5 }}>{statusLabel(item.status)}</Text>
            <Text style={{ color: colors.onSurface, fontSize: font.xl, fontWeight: "700", marginTop: 6 }}>{statusMessage(item)}</Text>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 4 }}>Revision {item.revision || 1} · Updated {formatTime(item.updated_at)}</Text>
          </View>
          <Ionicons name={statusIcon(item.status)} size={30} color={statusColor(item.status, colors)} />
        </View>

        <View style={[styles.peerCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
          <View style={[styles.peerIcon, { backgroundColor: colors.brandTertiary }]}><Ionicons name="business" size={21} color={colors.brandPrimary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{isTarget ? "Requesting institution" : "Receiving institution"}</Text>
            <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "700", marginTop: 2 }}>{peer?.name || "Institution"}</Text>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{[peer?.city, peer?.state].filter(Boolean).join(", ")}</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Post preview</Text>
        <View style={[styles.postCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={[styles.typeBadge, { backgroundColor: colors.brandTertiary }]}><Text style={{ color: colors.brandPrimary, fontSize: 10, fontWeight: "700" }}>{String(item.post_type || "general").toUpperCase()}</Text></View>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{item.category || "general"}</Text>
          </View>
          <Text style={{ color: colors.onSurface, fontSize: 22, lineHeight: 28, fontWeight: "700", marginTop: spacing.md }}>{item.title}</Text>
          <View style={{ marginTop: spacing.md }}><RichPostText content={item.content} /></View>
          {!!item.media_url && item.media_type === "image" && <Image source={{ uri: item.media_url }} style={styles.media} contentFit="cover" cachePolicy="memory-disk" />}
          {!!item.media_url && item.media_type === "document" && <View style={[styles.document, { borderColor: colors.border }]}><Ionicons name="document-text-outline" size={21} color={colors.brandPrimary} /><Text style={{ flex: 1, color: colors.onSurface }}>Attached document</Text></View>}
          <View style={styles.metaRow}>
            <Meta icon="chatbubble-outline" label={item.comments_enabled === false ? "Comments off" : "Comments on"} />
            <Meta icon="heart-outline" label={item.reactions_enabled === false ? "Reactions off" : "Reactions on"} />
            {item.pin_requested && <Meta icon="pin-outline" label="Pin requested" />}
          </View>
        </View>

        {!!item.latest_message && (
          <View style={[styles.notice, { backgroundColor: colors.surfaceTertiary }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}><Text style={{ color: colors.onSurfaceTertiary, fontSize: 11 }}>LATEST MESSAGE</Text><Text style={{ color: colors.onSurface, fontSize: font.base, lineHeight: 20, marginTop: 3 }}>{item.latest_message}</Text></View>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Request timeline</Text>
        <View style={[styles.timeline, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
          {(item.events || []).map((event, index) => (
            <View key={event.id} style={styles.timelineRow}>
              <View style={{ alignItems: "center", width: 26 }}>
                <View style={[styles.timelineDot, { backgroundColor: colors.brandPrimary }]} />
                {index < (item.events || []).length - 1 && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
              </View>
              <View style={{ flex: 1, paddingBottom: spacing.lg }}>
                <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "600" }}>{eventLabel(event.event_type)}</Text>
                {!!event.message && <Text style={{ color: colors.onSurfaceSecondary, fontSize: font.sm, lineHeight: 19, marginTop: 3 }}>{event.message}</Text>}
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{formatTime(event.created_at)}</Text>
              </View>
            </View>
          ))}
        </View>

        {(item.publications || []).length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Published destinations</Text>
            <View style={[styles.timeline, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
              {(item.publications || []).map((publication) => {
                const group = groups.find((g) => g.id === publication.group_id);
                return <Pressable key={publication.id} onPress={() => router.push(`/post/${publication.post_id}` as any)} style={styles.publicationRow}><Ionicons name={publication.destination_type === "feed" ? "newspaper-outline" : "people-outline"} size={19} color={colors.success} /><View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontWeight: "600" }}>{publication.destination_type === "feed" ? "Institution feed" : group?.name || "Institution group"}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{formatTime(publication.created_at)}</Text></View><Ionicons name="open-outline" size={17} color={colors.onSurfaceTertiary} /></Pressable>;
              })}
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.actionBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Pressable onPress={() => { setAction("message"); setActionMessage(""); }} style={[styles.iconAction, { borderColor: colors.borderStrong }]}><Ionicons name="chatbubble-outline" size={19} color={colors.onSurface} /></Pressable>
        {canReview && <><Pressable onPress={() => { setAction("changes"); setActionMessage(""); }} style={[styles.secondaryAction, { borderColor: colors.borderStrong }]}><Text style={{ color: colors.onSurface, fontWeight: "600" }}>Request changes</Text></Pressable><Pressable onPress={() => { setAction("approve"); setActionMessage(""); }} style={[styles.primaryAction, { backgroundColor: colors.success }]}><Ionicons name="checkmark" size={18} color="#fff" /><Text style={{ color: "#fff", fontWeight: "700" }}>Approve</Text></Pressable></>}
        {canRevise && <Pressable onPress={() => { setAction("revise"); setActionMessage(""); }} style={[styles.primaryAction, { backgroundColor: colors.brandPrimary }]}><Ionicons name="create-outline" size={18} color="#fff" /><Text style={{ color: "#fff", fontWeight: "700" }}>Submit revision</Text></Pressable>}
        {canPublish && <Pressable onPress={() => setPublishSheet(true)} style={[styles.primaryAction, { backgroundColor: colors.brandPrimary }]}><Ionicons name="send" size={18} color="#fff" /><Text style={{ color: "#fff", fontWeight: "700" }}>{item.status === "published" ? "Publish more" : "Publish"}</Text></Pressable>}
        {canWithdraw && !canRevise && <Pressable onPress={withdraw} style={[styles.secondaryAction, { borderColor: colors.error }]}><Text style={{ color: colors.error, fontWeight: "600" }}>Withdraw</Text></Pressable>}
      </View>

      <BottomSheet visible={!!action} onClose={() => setAction(null)} snapPoints={[action === "revise" ? "82%" : "58%"]} header={<Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "700" }}>{actionTitle(action)}</Text>}>
        <ScrollView keyboardShouldPersistTaps="handled">
          {action === "revise" && <><TextInput value={revisionTitle} onChangeText={setRevisionTitle} maxLength={180} placeholder="Title" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.onSurface, borderColor: colors.border }]} /><TextInput value={revisionContent} onChangeText={setRevisionContent} multiline maxLength={12000} placeholder="Revised post content" placeholderTextColor={colors.muted} style={[styles.revisionInput, { color: colors.onSurface, borderColor: colors.border }]} /></>}
          <TextInput value={actionMessage} onChangeText={setActionMessage} multiline maxLength={2000} placeholder={actionPlaceholder(action)} placeholderTextColor={colors.muted} style={[styles.messageInput, { color: colors.onSurface, borderColor: colors.border }]} />
          {action === "reject" ? null : action === "approve" ? <Pressable onPress={() => { setAction("reject"); setActionMessage(""); }} style={{ alignSelf: "flex-start", marginTop: spacing.md }}><Text style={{ color: colors.error, fontWeight: "600" }}>Reject instead</Text></Pressable> : null}
          <Pressable onPress={() => void runAction()} disabled={busy || (["message", "changes", "reject", "revise"].includes(action || "") && !actionMessage.trim())} style={[styles.sheetPrimary, { backgroundColor: busy ? colors.borderStrong : action === "reject" ? colors.error : colors.brandPrimary }]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>{action === "approve" ? "Approve request" : action === "reject" ? "Reject request" : action === "changes" ? "Send change request" : action === "revise" ? "Send revision" : "Send message"}</Text>}</Pressable>
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={publishSheet} onClose={() => setPublishSheet(false)} snapPoints={["74%"]} header={<Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "700" }}>Publish approved post</Text>}>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginBottom: spacing.md }}>Choose one or more destinations owned by your institution. Publishing is idempotent, so a destination cannot receive duplicates.</Text>
        <ScrollView>
          <CheckRow label="Institution feed" selected={destinations.some((d) => d.type === "feed")} onPress={toggleFeed} already={(item.publications || []).some((p) => p.destination_key === "feed")} />
          {groups.map((group) => <CheckRow key={group.id} label={group.name || "Group"} selected={destinations.some((d) => d.type === "group" && d.groupId === group.id)} onPress={() => toggleGroup(group.id)} already={(item.publications || []).some((p) => p.destination_key === `group:${group.id}`)} />)}
        </ScrollView>
        <Pressable onPress={() => void publish()} disabled={busy || destinations.length === 0} style={[styles.sheetPrimary, { backgroundColor: busy || !destinations.length ? colors.borderStrong : colors.brandPrimary }]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Publish selected destinations</Text>}</Pressable>
      </BottomSheet>
    </SafeAreaView>
  );
}

function Meta({ icon, label }: { icon: any; label: string }) { const { colors } = useTheme(); return <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Ionicons name={icon} size={14} color={colors.onSurfaceTertiary} /><Text style={{ color: colors.onSurfaceTertiary, fontSize: 11 }}>{label}</Text></View>; }
function CheckRow({ label, selected, onPress, already }: { label: string; selected: boolean; onPress: () => void; already?: boolean }) { const { colors } = useTheme(); return <Pressable onPress={onPress} style={styles.checkRow}><Ionicons name={selected ? "checkbox" : "square-outline"} size={22} color={selected ? colors.brandPrimary : colors.onSurfaceTertiary} /><View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontSize: font.base }}>{label}</Text>{already && <Text style={{ color: colors.success, fontSize: 11, marginTop: 2 }}>Already published here</Text>}</View></Pressable>; }
function statusLabel(status: InstitutionContentStatus) { return ({ pending: "PENDING REVIEW", changes_requested: "CHANGES REQUESTED", revised: "REVISION SENT", approved: "APPROVED", rejected: "REJECTED", withdrawn: "WITHDRAWN", partially_published: "PARTIALLY PUBLISHED", published: "PUBLISHED", expired: "EXPIRED", draft: "DRAFT" } as any)[status] || String(status).toUpperCase(); }
function statusIcon(status: InstitutionContentStatus): any { return ({ pending: "time-outline", changes_requested: "create-outline", revised: "refresh-outline", approved: "checkmark-circle-outline", rejected: "close-circle-outline", withdrawn: "arrow-undo-outline", partially_published: "send-outline", published: "checkmark-done-circle-outline", expired: "hourglass-outline", draft: "document-outline" } as any)[status] || "information-circle-outline"; }
function statusColor(status: InstitutionContentStatus, colors: any) { if (["approved", "published"].includes(status)) return colors.success; if (status === "rejected") return colors.error; if (["changes_requested", "revised", "partially_published"].includes(status)) return colors.info; if (status === "pending") return colors.warning; return colors.muted; }
function statusMessage(item: InstitutionContentRequest) { if (item.status === "approved") return item.side === "target" ? "Approved — choose where to publish it" : "Approved by the receiving institution"; if (item.status === "changes_requested") return item.side === "source" ? "The recipient needs a revision" : "Waiting for the sender to revise"; if (item.status === "revised") return item.side === "target" ? "A revised version is ready for review" : "Revision sent for another review"; if (item.status === "published") return "The approved post has been published"; if (item.status === "rejected") return "The request was declined"; if (item.status === "pending") return item.side === "target" ? "Review this post before approving" : "Waiting for recipient review"; return "Request status updated"; }
function eventLabel(event: string) { return ({ created: "Request sent", message: "Message", changes_requested: "Changes requested", revised: "Revision submitted", approved: "Approved", rejected: "Rejected", withdrawn: "Withdrawn", published: "Published", expired: "Expired" } as any)[event] || event.replace(/_/g, " "); }
function actionTitle(action: string | null) { return action === "changes" ? "Request modifications" : action === "reject" ? "Reject request" : action === "approve" ? "Approve request" : action === "revise" ? "Submit revised post" : "Send message"; }
function actionPlaceholder(action: string | null) { return action === "changes" ? "Describe exactly what needs to change…" : action === "reject" ? "Explain why this request is rejected…" : action === "approve" ? "Optional approval note…" : action === "revise" ? "Explain what you changed…" : "Write a message to the other institution…"; }
function formatTime(value?: string) { if (!value) return ""; const date = new Date(value); if (Number.isNaN(date.getTime())) return ""; return date.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); }

const styles = StyleSheet.create({
  statusHero: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, flexDirection: "row", gap: spacing.md, alignItems: "center" },
  peerCard: { marginTop: spacing.md, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md },
  peerIcon: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: font.lg, fontWeight: "700", marginTop: spacing.xl, marginBottom: spacing.sm },
  postCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  typeBadge: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  media: { width: "100%", aspectRatio: 16 / 10, borderRadius: radius.md, marginTop: spacing.md },
  document: { borderWidth: 1, borderRadius: radius.md, marginTop: spacing.md, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.md },
  notice: { marginTop: spacing.md, borderRadius: radius.md, padding: spacing.md, flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  timeline: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  timelineRow: { flexDirection: "row", gap: spacing.sm },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  timelineLine: { width: 2, flex: 1, minHeight: 38, marginTop: 3 },
  publicationRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: spacing.md },
  actionBar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 18, borderTopWidth: StyleSheet.hairlineWidth },
  iconAction: { width: 48, height: 48, borderWidth: 1, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  secondaryAction: { flex: 1, height: 48, borderWidth: 1, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md },
  primaryAction: { flex: 1.2, height: 48, borderRadius: radius.pill, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md },
  input: { height: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md },
  revisionInput: { minHeight: 170, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, textAlignVertical: "top", marginTop: spacing.sm },
  messageInput: { minHeight: 110, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, textAlignVertical: "top", marginTop: spacing.sm },
  sheetPrimary: { height: 48, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  checkRow: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: spacing.md },
});
