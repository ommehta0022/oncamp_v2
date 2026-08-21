import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import OptionsMenu from "@/src/components/OptionsMenu";
import ReportModal from "@/src/components/ReportModal";
import ReactionMenu, { REACTION_EMOJIS } from "@/src/components/ReactionMenu";
import RichPostText from "@/src/components/RichPostText";
import SkeletonLoader from "@/src/components/SkeletonLoader";
import { api, getUserErrorMessage } from "@/src/lib/api";
import { API_BASE_URL, getAccessToken } from "@/src/lib/api";
import { campusApi } from "@/src/lib/campusApi";
import { useRole } from "@/src/context/RoleProvider";

export default function PostDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useRole();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [post, setPost] = useState<any | null>(null);
  const [poll, setPoll] = useState<any | null>(null);
  const [semantics, setSemantics] = useState<any>({ hashtags: [], mentions: [] });
  const [linkPreview, setLinkPreview] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [reactionMenuVisible, setReactionMenuVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [voting, setVoting] = useState(false);

  const loadSemantics = useCallback(async (postId: string) => {
    try {
      const token = await getAccessToken();
      const response = await fetch(`${API_BASE_URL}/campus/posts/${postId}/semantics`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (response.ok) setSemantics(await response.json());
    } catch { /* semantics are supplemental */ }
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [data, reactions, pollData] = await Promise.all([
        api.posts.get(id),
        campusApi.student.reactions(id).catch(() => null),
        campusApi.student.poll(id).catch(() => null),
      ]);
      const next = {
        ...data,
        userReaction: reactions?.mine || data.userReaction || null,
        counts: { ...(data.counts || {}), reactions: reactions?.total ?? data.counts?.reactions ?? 0 },
        reactionCounts: reactions?.counts || {},
      };
      setPost(next);
      setPoll(pollData);
      void loadSemantics(id);

      const match = String(data.content || "").match(/https:\/\/[^\s)\]}]+/i);
      if (match) campusApi.student.linkPreview(match[0]).then(setLinkPreview).catch(() => setLinkPreview(null));
      else setLinkPreview(null);
    } catch {
      setPost(null);
    } finally { setLoading(false); }
  }, [id, loadSemantics]);

  useEffect(() => { void load(); }, [load]);

  const comments = post?.comments || [];
  const isMine = Boolean(post?.author?.id && post.author.id === user?.id);
  const isAdmin = Boolean(user?.roles?.some((role: string) => ["group_admin", "group_owner", "institution_admin", "platform_admin"].includes(role)));

  const submitComment = async () => {
    if (!id || !text.trim() || submittingComment) return;
    const content = text.trim();
    setText("");
    setSubmittingComment(true);
    try { await api.posts.comment(id, content); await load(); }
    catch (error) { setText(content); Alert.alert("Comment failed", getUserErrorMessage(error, "Could not add this comment.")); }
    finally { setSubmittingComment(false); }
  };

  const chooseReaction = async (reaction: string) => {
    if (!id || !post) return;
    const removing = post.userReaction === reaction;
    setReactionMenuVisible(false);
    try {
      const result = await campusApi.student.reaction(id, removing ? undefined : reaction);
      setPost((current: any) => ({ ...current, userReaction: result.reaction || null, reactionCounts: result.counts || {}, counts: { ...(current.counts || {}), reactions: result.total || 0 } }));
    } catch (error) { Alert.alert("Reaction failed", error instanceof Error ? error.message : "Could not update your reaction."); }
  };

  const vote = async (optionId: string) => {
    if (!poll || voting) return;
    const current: string[] = poll.myVotes || [];
    const next = poll.multiple_choice
      ? current.includes(optionId) ? current.filter((value) => value !== optionId) : [...current, optionId]
      : [optionId];
    if (next.length === 0) return;
    setVoting(true);
    try { await campusApi.student.votePoll(poll.id, next); setPoll(await campusApi.student.poll(post.id)); }
    catch (error) { Alert.alert("Vote failed", error instanceof Error ? error.message : "Could not save your vote."); }
    finally { setVoting(false); }
  };

  const shareExternally = async () => {
    if (!post) return;
    const preview = [post.title, post.content].filter(Boolean).join("\n\n");
    try { await Share.share({ title: post.title || "OnCampus post", message: `${preview}\n\nOpen in OnCampus: oncampus://post/${post.id}` }); }
    catch (error) { Alert.alert("Share", getUserErrorMessage(error, "Could not open the share sheet.")); }
  };

  const deletePost = () => {
    if (!id) return;
    Alert.alert("Delete post?", "This post will be removed from OnCampus.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { try { await api.posts.delete(id); router.back(); } catch (error) { Alert.alert("Delete failed", getUserErrorMessage(error)); } } },
    ]);
  };

  const pinPost = async () => {
    if (!id || !post) return;
    try { if (post.pinned) await api.posts.unpin(id); else await api.posts.pin(id); await load(); }
    catch (error) { Alert.alert("Pin failed", getUserErrorMessage(error)); }
  };

  const options = post ? [
    { label: "Share outside OnCampus", icon: "share-social-outline", onPress: shareExternally },
    { label: "Version history", icon: "time-outline", onPress: () => router.push(`/post/versions/${post.id}` as any) },
    ...((isMine || isAdmin) ? [{ label: post.pinned ? "Unpin" : "Pin", icon: "pin-outline", onPress: pinPost }] : []),
    ...((isMine || isAdmin) ? [{ label: "Delete", icon: "trash-outline", color: colors.error, onPress: deletePost }] : []),
    ...(!isMine ? [{ label: "Report", icon: "flag-outline", color: colors.warning, onPress: () => setReportVisible(true) }] : []),
  ] : [];

  const reactionEmoji = post?.userReaction ? REACTION_EMOJIS[post.userReaction] : null;

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}><Header title="Post" onBack={() => router.back()} /><View style={{ padding: spacing.xl }}><SkeletonLoader type="card" /></View></SafeAreaView>;
  if (!post) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}><Header title="Post" onBack={() => router.back()} /><EmptyState icon="document-text-outline" title="Post not found" message="This post is unavailable or has been removed." /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Post" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={styles.postCard}>
            <View style={styles.authorRow}>
              <Avatar uri={post.author?.avatarUrl} name={post.author?.name || "User"} size={48} verified={post.author?.verified} />
              <View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "700" }}>{post.author?.name || "Institution"}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{[post.author?.institution, post.group?.name, post.createdAt].filter(Boolean).join(" · ")}</Text></View>
              <Pressable onPress={() => setMenuVisible(true)} style={styles.iconButton}><Ionicons name="ellipsis-horizontal" size={22} color={colors.onSurfaceTertiary} /></Pressable>
            </View>

            {post.title ? <Text style={{ color: colors.onSurface, fontSize: 21, lineHeight: 27, fontWeight: "800", marginTop: spacing.lg }}>{post.title}</Text> : null}
            {post.content ? <View style={{ marginTop: spacing.md }}><RichPostText content={post.content} /></View> : null}
            {post.mediaUrl && post.mediaType !== "document" ? <Image source={{ uri: post.mediaUrl }} style={styles.image} contentFit="cover" transition={180} /> : null}
            {post.mediaUrl && post.mediaType === "document" ? <Pressable onPress={() => void Linking.openURL(post.mediaUrl)} style={[styles.document, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}><Ionicons name="document-text-outline" size={22} color={colors.brandPrimary} /><Text style={{ flex: 1, color: colors.onSurface, fontWeight: "600" }}>Open attached document</Text><Ionicons name="open-outline" size={18} color={colors.onSurfaceTertiary} /></Pressable> : null}

            {(semantics.hashtags || []).length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, marginTop: spacing.md }}>{semantics.hashtags.map((tag: string) => <Pressable key={tag} onPress={() => router.push("/(tabs)/discover" as any)} style={[styles.hashtag, { backgroundColor: colors.brandPrimary + "12", borderColor: colors.brandPrimary + "32" }]}><Text style={{ color: colors.brandPrimary, fontWeight: "700", fontSize: 12 }}>#{tag}</Text></Pressable>)}</ScrollView> : null}

            {linkPreview ? <Pressable onPress={() => void Linking.openURL(linkPreview.url)} style={[styles.linkCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>{linkPreview.image_url ? <Image source={{ uri: linkPreview.image_url }} style={styles.linkImage} contentFit="cover" /> : null}<View style={{ flex: 1, padding: spacing.md }}><Text numberOfLines={1} style={{ color: colors.onSurface, fontWeight: "700" }}>{linkPreview.title || linkPreview.site_name || "Open link"}</Text><Text numberOfLines={2} style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 3 }}>{linkPreview.description || linkPreview.url}</Text></View></Pressable> : null}

            {poll ? <PollCard poll={poll} voting={voting} onVote={(optionId) => void vote(optionId)} /> : null}

            <View style={[styles.actions, { borderTopColor: colors.border }]}>
              <Pressable onPress={() => setReactionMenuVisible(true)} style={styles.action}><Text style={{ fontSize: 19 }}>{reactionEmoji || "😊"}</Text><Text style={{ color: post.userReaction ? colors.brandPrimary : colors.onSurfaceTertiary, fontWeight: "700" }}>{post.counts?.reactions || 0}</Text></Pressable>
              <View style={styles.action}><Ionicons name="chatbubble-outline" size={19} color={colors.onSurfaceTertiary} /><Text style={{ color: colors.onSurfaceTertiary, fontWeight: "700" }}>{comments.length}</Text></View>
              <Pressable onPress={() => void shareExternally()} style={styles.action}><Ionicons name="share-social-outline" size={20} color={colors.onSurfaceTertiary} /></Pressable>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.surfaceSecondary }]} />
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <Text style={{ color: colors.onSurface, fontSize: 17, fontWeight: "800", marginBottom: spacing.md }}>Comments</Text>
            {comments.length === 0 ? <EmptyState icon="chatbubble-ellipses-outline" title="No comments yet" message="Start the conversation." /> : comments.map((comment: any) => <CommentRow key={comment.id} comment={comment} onDelete={async () => { try { await api.posts.deleteComment(comment.id); await load(); } catch (error) { Alert.alert("Delete failed", getUserErrorMessage(error)); } }} canDelete={comment.user?.id === user?.id || isAdmin} />)}
          </View>
        </ScrollView>

        <View style={[styles.composer, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <Avatar uri={user?.avatarUrl} name={user?.name || "You"} size={38} />
          <TextInput value={text} onChangeText={setText} placeholder="Add a comment…" placeholderTextColor={colors.muted} multiline style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary }]} />
          <Pressable disabled={!text.trim() || submittingComment} onPress={() => void submitComment()} style={[styles.send, { backgroundColor: colors.brandPrimary, opacity: !text.trim() || submittingComment ? .45 : 1 }]}>{submittingComment ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="arrow-up" size={20} color="#fff" />}</Pressable>
        </View>
      </KeyboardAvoidingView>

      <OptionsMenu visible={menuVisible} onClose={() => setMenuVisible(false)} options={options} title="Post options" />
      <ReactionMenu visible={reactionMenuVisible} onClose={() => setReactionMenuVisible(false)} onSelect={(type) => void chooseReaction(type)} />
      <ReportModal visible={reportVisible} onClose={() => setReportVisible(false)} onSubmit={async (reason, details) => { await api.reports.reportPost(post.id, { reason, details }); }} title="Report Post" />
    </SafeAreaView>
  );
}

function PollCard({ poll, voting, onVote }: { poll: any; voting: boolean; onVote: (optionId: string) => void }) {
  const { colors } = useTheme();
  const total = Number(poll.totalVotes || 0);
  const selected = new Set<string>(poll.myVotes || []);
  return <View style={[styles.poll, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><View style={styles.pollHeader}><Ionicons name="stats-chart-outline" size={19} color={colors.brandPrimary} /><Text style={{ flex: 1, color: colors.onSurface, fontWeight: "800" }}>{poll.question}</Text>{voting && <ActivityIndicator size="small" color={colors.brandPrimary} />}</View>{(poll.options || []).map((option: any) => { const votes = Number(option.votes || 0); const percent = total ? Math.round((votes / total) * 100) : 0; const active = selected.has(option.id); return <Pressable key={option.id} onPress={() => onVote(option.id)} style={[styles.pollOption, { borderColor: active ? colors.brandPrimary : colors.border, backgroundColor: active ? colors.brandPrimary + "10" : colors.surface }]}><View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontWeight: active ? "700" : "500" }}>{option.label}</Text><View style={[styles.progressTrack, { backgroundColor: colors.border }]}><View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: colors.brandPrimary }]} /></View></View><Text style={{ color: active ? colors.brandPrimary : colors.onSurfaceTertiary, fontWeight: "700", fontSize: 12 }}>{percent}%</Text></Pressable>; })}<Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 7 }}>{total} vote{total === 1 ? "" : "s"}{poll.multiple_choice ? " · multiple choice" : ""}</Text></View>;
}

function CommentRow({ comment, onDelete, canDelete }: { comment: any; onDelete: () => void; canDelete: boolean }) {
  const { colors } = useTheme();
  return <View style={styles.comment}><Avatar uri={comment.user?.avatarUrl} name={comment.user?.name || "Member"} size={38} /><View style={{ flex: 1 }}><View style={[styles.commentBubble, { backgroundColor: colors.surfaceSecondary }]}><View style={{ flexDirection: "row", alignItems: "center" }}><Text style={{ flex: 1, color: colors.onSurface, fontWeight: "700" }}>{comment.user?.name || "Member"}</Text>{canDelete ? <Pressable onPress={() => Alert.alert("Delete comment?", "This comment will be removed.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: onDelete }])}><Ionicons name="trash-outline" size={15} color={colors.onSurfaceTertiary} /></Pressable> : null}</View><Text style={{ color: colors.onSurface, marginTop: 4, lineHeight: 20 }}>{comment.content}</Text></View><Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{comment.createdAt || comment.created_at || ""}</Text></View></View>;
}

const styles = StyleSheet.create({
  postCard: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  authorRow: { flexDirection: "row", alignItems: "center", gap: spacing.md }, iconButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  image: { width: "100%", aspectRatio: 16 / 10, borderRadius: radius.lg, marginTop: spacing.md },
  document: { marginTop: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  hashtag: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 9, paddingVertical: 6 },
  linkCard: { marginTop: spacing.md, borderWidth: 1, borderRadius: radius.lg, overflow: "hidden", flexDirection: "row" }, linkImage: { width: 92, minHeight: 82 },
  poll: { marginTop: spacing.md, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md }, pollHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  pollOption: { borderWidth: 1, borderRadius: radius.md, padding: 10, marginTop: 7, flexDirection: "row", alignItems: "center", gap: 10 }, progressTrack: { height: 4, borderRadius: 2, overflow: "hidden", marginTop: 7 }, progressFill: { height: 4, borderRadius: 2 },
  actions: { flexDirection: "row", justifyContent: "space-around", borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.lg, paddingTop: spacing.sm }, action: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8 },
  divider: { height: 7 }, comment: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md }, commentBubble: { padding: spacing.md, borderRadius: radius.lg },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth }, input: { flex: 1, maxHeight: 100, minHeight: 42, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 }, send: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
});
