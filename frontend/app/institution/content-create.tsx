import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import BottomSheet from "@/src/components/BottomSheet";
import RichPostText from "@/src/components/RichPostText";
import { useToast } from "@/src/components/Toast";
import { api } from "@/src/lib/api";
import { institutionContentApi, InstitutionDirectoryItem, PublishDestination } from "@/src/lib/institutionContentApi";
import { showImagePicker, uploadPostMedia } from "@/src/lib/imageUpload";

const POST_TYPES = ["general", "announcement", "event", "notice", "poster", "emergency"] as const;
type Mode = "publish" | "request";

type Draft = {
  id: string;
  title?: string;
  content?: string;
  category?: string;
  post_type?: string;
  media_url?: string;
  media_type?: string;
  tags?: string[];
  editor_state?: Record<string, any>;
};

export default function InstitutionContentCreate() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ drafts?: string }>();
  const { showToast } = useToast();
  const contentRef = useRef<TextInput>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [postType, setPostType] = useState<(typeof POST_TYPES)[number]>("general");
  const [tagsText, setTagsText] = useState("");
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | "document" | null>(null);
  const [mode, setMode] = useState<Mode>("publish");
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [reactionsEnabled, setReactionsEnabled] = useState(true);
  const [pinned, setPinned] = useState(false);
  const [destinations, setDestinations] = useState<PublishDestination[]>([{ type: "feed" }]);
  const [groups, setGroups] = useState<any[]>([]);
  const [target, setTarget] = useState<InstitutionDirectoryItem | null>(null);
  const [institutions, setInstitutions] = useState<InstitutionDirectoryItem[]>([]);
  const [directorySearch, setDirectorySearch] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [schedule, setSchedule] = useState<"now" | "hour" | "tomorrow">("now");
  const [expiry, setExpiry] = useState<"none" | "week" | "month">("none");
  const [preview, setPreview] = useState(false);
  const [destinationSheet, setDestinationSheet] = useState(false);
  const [institutionSheet, setInstitutionSheet] = useState(false);
  const [draftSheet, setDraftSheet] = useState(params.drafts === "1");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const tags = useMemo(() => tagsText.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 20), [tagsText]);
  const valid = content.trim().length > 0 && content.trim().length <= 12000 && title.length <= 180 && (mode === "publish" || !!target);

  const loadReferenceData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [dashboard, directory, savedDrafts] = await Promise.all([
        api.institutions.dashboard().catch(() => ({ groups: [] })),
        institutionContentApi.directory().catch(() => []),
        institutionContentApi.drafts().catch(() => []),
      ]);
      setGroups(Array.isArray((dashboard as any)?.groups) ? (dashboard as any).groups : []);
      setInstitutions(directory || []);
      setDrafts(savedDrafts || []);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => { void loadReferenceData(); }, [loadReferenceData]);

  useEffect(() => {
    if (!institutionSheet) return;
    const timer = setTimeout(() => {
      void institutionContentApi.directory(directorySearch).then(setInstitutions).catch(() => undefined);
    }, 280);
    return () => clearTimeout(timer);
  }, [directorySearch, institutionSheet]);

  const insertFormatting = (kind: "bold" | "italic" | "heading" | "bullet" | "quote" | "link") => {
    const additions = {
      bold: "**bold text**",
      italic: "_italic text_",
      heading: "# Heading",
      bullet: "- List item",
      quote: "> Quote",
      link: "https://",
    };
    const spacer = content && !content.endsWith("\n") ? "\n" : "";
    setContent((current) => `${current}${spacer}${additions[kind]}`);
    setTimeout(() => contentRef.current?.focus(), 50);
  };

  const addImage = async () => {
    const uri = await showImagePicker({ aspect: [16, 10], quality: 0.86 });
    if (uri) { setMediaUri(uri); setMediaUrl(null); setMediaType("image"); }
  };

  const addDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf"], copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const file = result.assets[0];
    if (file.size && file.size > 10 * 1024 * 1024) {
      showToast({ message: "Documents must be 10 MB or smaller.", variant: "warning" });
      return;
    }
    setMediaUri(file.uri); setMediaUrl(null); setMediaType("document");
  };

  const ensureUploadedMedia = async () => {
    if (mediaUrl || !mediaUri) return mediaUrl;
    const result = await uploadPostMedia(mediaUri);
    const nextType = (result.mediaType as any) || mediaType;
    setMediaType(nextType);
    setMediaUrl(result.url);
    return result.url;
  };

  const scheduledAt = useMemo(() => {
    if (schedule === "now") return undefined;
    const date = new Date();
    if (schedule === "hour") date.setHours(date.getHours() + 1);
    else { date.setDate(date.getDate() + 1); date.setHours(9, 0, 0, 0); }
    return date.toISOString();
  }, [schedule]);

  const expiresAt = useMemo(() => {
    if (expiry === "none") return undefined;
    const date = new Date();
    date.setDate(date.getDate() + (expiry === "week" ? 7 : 30));
    return date.toISOString();
  }, [expiry]);

  const saveDraft = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const uploaded = mediaUri ? await ensureUploadedMedia() : mediaUrl;
      const saved = await institutionContentApi.saveDraft({
        id: draftId || undefined,
        title,
        content,
        category,
        postType,
        mediaUrl: uploaded,
        mediaType,
        tags,
        editorState: { mode, commentsEnabled, reactionsEnabled, pinned, schedule, expiry, destinations, targetInstitutionId: target?.id, requestMessage },
      });
      setDraftId(saved.id);
      showToast({ message: "Draft saved", variant: "success" });
      await loadReferenceData();
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : "Could not save draft.", variant: "error" });
    } finally { setBusy(false); }
  };

  const publish = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const uploaded = mediaUri ? await ensureUploadedMedia() : mediaUrl;
      if (mode === "publish") {
        await institutionContentApi.createPost({
          title: title.trim() || undefined,
          content: content.trim(),
          postType,
          mediaUrl: uploaded || undefined,
          mediaType: uploaded ? mediaType : undefined,
          destinations,
          commentsEnabled,
          reactionsEnabled,
          pinned,
          scheduledAt,
          expiresAt,
        });
        if (draftId) await institutionContentApi.deleteDraft(draftId).catch(() => undefined);
        showToast({ message: scheduledAt ? "Post scheduled" : "Post published", variant: "success" });
      } else {
        if (!target) throw new Error("Choose the institution that should review this request.");
        await institutionContentApi.createRequest({
          targetInstitutionId: target.id,
          title: title.trim() || "Shared institution post",
          content: content.trim(),
          category,
          postType,
          mediaUrl: uploaded || undefined,
          mediaType: uploaded ? mediaType : undefined,
          tags,
          requestedDestination: "recipient_choice",
          requestedGroupIds: [],
          commentsEnabled,
          reactionsEnabled,
          pinRequested: pinned,
          requestedPublishAt: scheduledAt,
          expiresAt,
          message: requestMessage.trim() || undefined,
        });
        if (draftId) await institutionContentApi.deleteDraft(draftId).catch(() => undefined);
        showToast({ message: `Request sent to ${target.name}`, variant: "success" });
      }
      router.replace("/institution/content" as any);
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : "Could not complete publishing.", variant: "error" });
    } finally { setBusy(false); }
  };

  const loadDraft = (draft: Draft) => {
    const state = draft.editor_state || {};
    setDraftId(draft.id);
    setTitle(draft.title || "");
    setContent(draft.content || "");
    setCategory(draft.category || "general");
    setPostType((POST_TYPES.includes(draft.post_type as any) ? draft.post_type : "general") as any);
    setMediaUrl(draft.media_url || null);
    setMediaUri(null);
    setMediaType((draft.media_type as any) || null);
    setTagsText(Array.isArray(draft.tags) ? draft.tags.join(", ") : "");
    setMode(state.mode === "request" ? "request" : "publish");
    setCommentsEnabled(state.commentsEnabled !== false);
    setReactionsEnabled(state.reactionsEnabled !== false);
    setPinned(Boolean(state.pinned));
    setSchedule(state.schedule || "now");
    setExpiry(state.expiry || "none");
    setDestinations(Array.isArray(state.destinations) && state.destinations.length ? state.destinations : [{ type: "feed" }]);
    setRequestMessage(state.requestMessage || "");
    const nextTarget = institutions.find((institution) => institution.id === state.targetInstitutionId) || null;
    setTarget(nextTarget);
    setDraftSheet(false);
  };

  const toggleGroup = (groupId: string) => {
    setDestinations((current) => {
      const exists = current.some((item) => item.type === "group" && item.groupId === groupId);
      return exists ? current.filter((item) => !(item.type === "group" && item.groupId === groupId)) : [...current, { type: "group", groupId }];
    });
  };

  const toggleFeed = () => setDestinations((current) => current.some((item) => item.type === "feed") ? current.filter((item) => item.type !== "feed") : [{ type: "feed" }, ...current]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header
        title={draftId ? "Edit draft" : "Create institution post"}
        subtitle="Rich editor · publish or collaborate"
        onBack={() => router.back()}
        right={<Pressable onPress={() => void saveDraft()} disabled={busy}><Text style={{ color: colors.brandPrimary, fontWeight: "600" }}>Save</Text></Pressable>}
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }}>
          <View style={[styles.modeSelector, { backgroundColor: colors.surfaceTertiary }]}>
            <ModeButton label="Publish here" icon="megaphone-outline" active={mode === "publish"} onPress={() => setMode("publish")} />
            <ModeButton label="Request institution" icon="paper-plane-outline" active={mode === "request"} onPress={() => setMode("request")} />
          </View>

          {mode === "request" && (
            <Pressable onPress={() => setInstitutionSheet(true)} style={[styles.targetCard, { backgroundColor: colors.surfaceSecondary, borderColor: target ? colors.brandPrimary : colors.border }]}>
              <View style={[styles.smallIcon, { backgroundColor: colors.brandTertiary }]}><Ionicons name="business-outline" size={19} color={colors.brandPrimary} /></View>
              <View style={{ flex: 1 }}><Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>Send request to</Text><Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "600", marginTop: 2 }}>{target?.name || "Choose another institution"}</Text></View>
              <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
            </Pressable>
          )}

          <TextInput value={title} onChangeText={setTitle} maxLength={180} placeholder="Post title (optional)" placeholderTextColor={colors.muted} style={[styles.titleInput, { color: colors.onSurface }]} />

          <View style={[styles.formatBar, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
            <Format icon="text" label="H" onPress={() => insertFormatting("heading")} />
            <Format icon="text" label="B" onPress={() => insertFormatting("bold")} bold />
            <Format icon="text" label="I" onPress={() => insertFormatting("italic")} italic />
            <Format icon="list" onPress={() => insertFormatting("bullet")} />
            <Format icon="chatbox-ellipses-outline" onPress={() => insertFormatting("quote")} />
            <Format icon="link-outline" onPress={() => insertFormatting("link")} />
          </View>

          <TextInput
            ref={contentRef}
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={12000}
            placeholder="Write your institution post…"
            placeholderTextColor={colors.muted}
            style={[styles.contentInput, { color: colors.onSurface, borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
            textAlignVertical="top"
          />
          <Text style={{ color: colors.muted, fontSize: 11, textAlign: "right", marginTop: 4 }}>{content.length}/12000</Text>

          {!!(mediaUri || mediaUrl) && (
            <View style={{ marginTop: spacing.md }}>
              {mediaType === "image" ? <Image source={{ uri: mediaUri || mediaUrl! }} style={styles.mediaPreview} contentFit="cover" /> : <View style={[styles.attachment, { borderColor: colors.border }]}><Ionicons name="document-text-outline" size={22} color={colors.brandPrimary} /><Text style={{ flex: 1, color: colors.onSurface }}>Document attached</Text></View>}
              <Pressable onPress={() => { setMediaUri(null); setMediaUrl(null); setMediaType(null); }} style={{ alignSelf: "flex-end", marginTop: spacing.sm }}><Text style={{ color: colors.error }}>Remove attachment</Text></Pressable>
            </View>
          )}

          <View style={styles.mediaActions}>
            <MiniAction icon="image-outline" label="Photo" onPress={() => void addImage()} />
            <MiniAction icon="document-outline" label="PDF" onPress={() => void addDocument()} />
            <MiniAction icon="eye-outline" label={preview ? "Edit" : "Preview"} onPress={() => setPreview((value) => !value)} />
          </View>

          {preview && (
            <View style={[styles.previewCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginBottom: spacing.sm }}>LIVE PREVIEW</Text>
              {!!title && <Text style={{ color: colors.onSurface, fontSize: font.xl, fontWeight: "700", marginBottom: spacing.sm }}>{title}</Text>}
              <RichPostText content={content || "Your formatted post will appear here."} />
            </View>
          )}

          <Section title="Post details">
            <OptionPress label="Type" value={postType} onPress={() => setPostType(POST_TYPES[(POST_TYPES.indexOf(postType) + 1) % POST_TYPES.length])} />
            <InputRow label="Category" value={category} onChangeText={setCategory} placeholder="General, Placement, Event…" />
            <InputRow label="Tags" value={tagsText} onChangeText={setTagsText} placeholder="placement, ai, workshop" />
          </Section>

          <Section title="Audience & timing">
            {mode === "publish" && <OptionPress label="Destinations" value={destinationLabel(destinations, groups)} onPress={() => setDestinationSheet(true)} />}
            <ChoiceRow label="Schedule" choices={[{ k: "now", v: "Now" }, { k: "hour", v: "+1 hour" }, { k: "tomorrow", v: "Tomorrow 9 AM" }]} value={schedule} onChange={(v) => setSchedule(v as any)} />
            <ChoiceRow label="Expires" choices={[{ k: "none", v: "Never" }, { k: "week", v: "7 days" }, { k: "month", v: "30 days" }]} value={expiry} onChange={(v) => setExpiry(v as any)} />
          </Section>

          <Section title="Engagement controls">
            <ToggleRow label="Allow comments" value={commentsEnabled} onValueChange={setCommentsEnabled} />
            <ToggleRow label="Allow reactions" value={reactionsEnabled} onValueChange={setReactionsEnabled} />
            <ToggleRow label={mode === "request" ? "Request pinning" : "Pin post"} value={pinned} onValueChange={setPinned} />
          </Section>

          {mode === "request" && (
            <Section title="Message to reviewer">
              <TextInput value={requestMessage} onChangeText={setRequestMessage} maxLength={2000} multiline placeholder="Explain why this should be shared and any publishing instructions…" placeholderTextColor={colors.muted} style={[styles.messageInput, { color: colors.onSurface, borderColor: colors.border }]} />
            </Section>
          )}
        </ScrollView>

        <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Pressable onPress={() => void saveDraft()} disabled={busy} style={[styles.secondaryBtn, { borderColor: colors.borderStrong }]}><Text style={{ color: colors.onSurface, fontWeight: "600" }}>Save draft</Text></Pressable>
          <Pressable onPress={() => void publish()} disabled={!valid || busy || (mode === "publish" && destinations.length === 0)} style={[styles.primaryBtn, { backgroundColor: valid && !busy ? colors.brandPrimary : colors.borderStrong }]}>
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name={mode === "request" ? "paper-plane" : schedule === "now" ? "send" : "time"} size={17} color="#fff" /><Text style={{ color: "#fff", fontWeight: "700" }}>{mode === "request" ? "Send request" : schedule === "now" ? "Publish" : "Schedule"}</Text></>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <BottomSheet visible={destinationSheet} onClose={() => setDestinationSheet(false)} snapPoints={["70%"]} header={<Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "700" }}>Publish destinations</Text>}>
        <ScrollView>
          <CheckRow label="Institution feed" selected={destinations.some((item) => item.type === "feed")} onPress={toggleFeed} />
          {groups.map((group) => <CheckRow key={group.id} label={group.name || "Group"} selected={destinations.some((item) => item.type === "group" && item.groupId === group.id)} onPress={() => toggleGroup(group.id)} />)}
          {groups.length === 0 && <Text style={{ color: colors.onSurfaceTertiary, paddingVertical: spacing.xl, textAlign: "center" }}>No official groups available. You can still publish to the institution feed.</Text>}
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={institutionSheet} onClose={() => setInstitutionSheet(false)} snapPoints={["82%"]} header={<Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "700" }}>Choose institution</Text>}>
        <TextInput value={directorySearch} onChangeText={setDirectorySearch} placeholder="Search verified institutions" placeholderTextColor={colors.muted} style={[styles.searchInput, { borderColor: colors.border, color: colors.onSurface }]} />
        <ScrollView style={{ marginTop: spacing.md }} keyboardShouldPersistTaps="handled">
          {institutions.map((institution) => (
            <Pressable key={institution.id} onPress={() => { setTarget(institution); setInstitutionSheet(false); }} style={styles.institutionRow}>
              <View style={[styles.smallIcon, { backgroundColor: colors.brandTertiary }]}><Ionicons name="business" size={18} color={colors.brandPrimary} /></View>
              <View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "600" }}>{institution.name}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{[institution.city, institution.state].filter(Boolean).join(", ")}</Text></View>
              {target?.id === institution.id && <Ionicons name="checkmark-circle" size={20} color={colors.brandPrimary} />}
            </Pressable>
          ))}
          {!loadingData && institutions.length === 0 && <Text style={{ color: colors.onSurfaceTertiary, textAlign: "center", paddingVertical: 40 }}>No matching verified institutions.</Text>}
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={draftSheet} onClose={() => setDraftSheet(false)} snapPoints={["75%"]} header={<Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "700" }}>Saved drafts</Text>}>
        <ScrollView>
          {drafts.map((draft) => <Pressable key={draft.id} onPress={() => loadDraft(draft)} style={[styles.draftRow, { borderBottomColor: colors.border }]}><Ionicons name="document-text-outline" size={20} color={colors.brandPrimary} /><View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontWeight: "600" }} numberOfLines={1}>{draft.title || "Untitled draft"}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }} numberOfLines={1}>{draft.content || "Empty draft"}</Text></View><Ionicons name="chevron-forward" size={17} color={colors.muted} /></Pressable>)}
          {drafts.length === 0 && <Text style={{ color: colors.onSurfaceTertiary, textAlign: "center", paddingVertical: 40 }}>No saved drafts.</Text>}
        </ScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

function ModeButton({ label, icon, active, onPress }: { label: string; icon: any; active: boolean; onPress: () => void }) { const { colors } = useTheme(); return <Pressable onPress={onPress} style={[styles.modeBtn, { backgroundColor: active ? colors.surface : "transparent" }]}><Ionicons name={icon} size={17} color={active ? colors.brandPrimary : colors.onSurfaceTertiary} /><Text style={{ color: active ? colors.onSurface : colors.onSurfaceTertiary, fontWeight: "600", fontSize: font.sm }}>{label}</Text></Pressable>; }
function Format({ icon, label, onPress, bold, italic }: { icon: any; label?: string; onPress: () => void; bold?: boolean; italic?: boolean }) { const { colors } = useTheme(); return <Pressable onPress={onPress} style={styles.formatBtn}>{label ? <Text style={{ color: colors.onSurface, fontWeight: bold ? "800" : "600", fontStyle: italic ? "italic" : "normal" }}>{label}</Text> : <Ionicons name={icon} size={19} color={colors.onSurface} />}</Pressable>; }
function MiniAction({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) { const { colors } = useTheme(); return <Pressable onPress={onPress} style={[styles.miniAction, { borderColor: colors.border }]}><Ionicons name={icon} size={17} color={colors.brandPrimary} /><Text style={{ color: colors.onSurface, fontSize: font.sm }}>{label}</Text></Pressable>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { const { colors } = useTheme(); return <View style={{ marginTop: spacing.xl }}><Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "700", marginBottom: spacing.sm }}>{title}</Text><View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>{children}</View></View>; }
function OptionPress({ label, value, onPress }: { label: string; value: string; onPress: () => void }) { const { colors } = useTheme(); return <Pressable onPress={onPress} style={styles.optionRow}><Text style={{ flex: 1, color: colors.onSurface, fontSize: font.base }}>{label}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, maxWidth: "55%" }} numberOfLines={1}>{value}</Text><Ionicons name="chevron-forward" size={16} color={colors.muted} /></Pressable>; }
function InputRow({ label, value, onChangeText, placeholder }: { label: string; value: string; onChangeText: (v: string) => void; placeholder: string }) { const { colors } = useTheme(); return <View style={styles.optionRow}><Text style={{ color: colors.onSurface, fontSize: font.base, width: 82 }}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted} style={{ flex: 1, color: colors.onSurface, textAlign: "right" }} /></View>; }
function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) { const { colors } = useTheme(); return <View style={styles.optionRow}><Text style={{ flex: 1, color: colors.onSurface, fontSize: font.base }}>{label}</Text><Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.brandPrimary }} /></View>; }
function ChoiceRow({ label, choices, value, onChange }: { label: string; choices: { k: string; v: string }[]; value: string; onChange: (v: string) => void }) { const { colors } = useTheme(); return <View style={{ padding: spacing.md }}><Text style={{ color: colors.onSurface, fontSize: font.base, marginBottom: spacing.sm }}>{label}</Text><View style={{ flexDirection: "row", gap: spacing.sm }}>{choices.map((choice) => <Pressable key={choice.k} onPress={() => onChange(choice.k)} style={[styles.choice, { backgroundColor: value === choice.k ? colors.brandPrimary : colors.surfaceTertiary }]}><Text style={{ color: value === choice.k ? colors.onBrandPrimary : colors.onSurface, fontSize: font.sm, fontWeight: "600" }}>{choice.v}</Text></Pressable>)}</View></View>; }
function CheckRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { const { colors } = useTheme(); return <Pressable onPress={onPress} style={styles.checkRow}><Ionicons name={selected ? "checkbox" : "square-outline"} size={22} color={selected ? colors.brandPrimary : colors.onSurfaceTertiary} /><Text style={{ flex: 1, color: colors.onSurface, fontSize: font.base }}>{label}</Text></Pressable>; }
function destinationLabel(destinations: PublishDestination[], groups: any[]) { if (!destinations.length) return "Choose"; const values = destinations.map((item) => item.type === "feed" ? "Feed" : groups.find((g) => g.id === item.groupId)?.name || "Group"); return values.length <= 2 ? values.join(" + ") : `${values.length} destinations`; }

const styles = StyleSheet.create({
  modeSelector: { flexDirection: "row", padding: 4, borderRadius: radius.pill },
  modeBtn: { flex: 1, minHeight: 42, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  targetCard: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: spacing.md },
  smallIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  titleInput: { fontSize: 26, fontWeight: "700", paddingVertical: spacing.xl, paddingHorizontal: 0 },
  formatBar: { borderWidth: 1, borderRadius: radius.md, flexDirection: "row", padding: 4, marginBottom: spacing.sm },
  formatBtn: { flex: 1, height: 38, alignItems: "center", justifyContent: "center" },
  contentInput: { minHeight: 210, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, fontSize: font.base, lineHeight: 23 },
  mediaPreview: { width: "100%", aspectRatio: 16 / 10, borderRadius: radius.lg },
  attachment: { borderWidth: 1, borderRadius: radius.md, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
  mediaActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  miniAction: { flexDirection: "row", gap: 6, alignItems: "center", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, minHeight: 38 },
  previewCard: { marginTop: spacing.md, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  section: { borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" },
  optionRow: { minHeight: 54, paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(128,128,128,.18)", flexDirection: "row", alignItems: "center", gap: spacing.sm },
  choice: { flex: 1, minHeight: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  messageInput: { minHeight: 110, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, margin: spacing.md, textAlignVertical: "top" },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: Platform.OS === "ios" ? 28 : spacing.md, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: spacing.sm },
  secondaryBtn: { flex: 1, height: 48, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  primaryBtn: { flex: 1.35, height: 48, borderRadius: radius.pill, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
  checkRow: { flexDirection: "row", gap: spacing.md, minHeight: 52, alignItems: "center" },
  searchInput: { height: 46, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md },
  institutionRow: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: spacing.md },
  draftRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
});
