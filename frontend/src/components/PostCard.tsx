import React, { useEffect, useState } from "react";
import { Alert, Pressable, Share, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import { api, FeedPostDto, getUserErrorMessage } from "@/src/lib/api";
import { campusApi } from "@/src/lib/campusApi";
import { normalizePost } from "@/src/lib/mappers";
import { useRole } from "@/src/context/RoleProvider";
import { usePinnedContent } from "@/src/context/PinnedContentProvider";
import Avatar from "@/src/components/Avatar";
import OptionsMenu from "@/src/components/OptionsMenu";
import ReactionMenu, { REACTION_EMOJIS } from "@/src/components/ReactionMenu";
import ReportModal from "@/src/components/ReportModal";
import RichPostText from "@/src/components/RichPostText";
import { useToast } from "@/src/components/Toast";

type Props = {
  post: FeedPostDto | any;
  onChange?: (post: any) => void;
  onDeleted?: (postId: string) => void;
  style?: StyleProp<ViewStyle>;
};

export default function PostCard({ post, onChange, onDeleted, style }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useRole();
  const { showToast } = useToast();
  const { isPostPinned, togglePostPin } = usePinnedContent();
  const [item, setItem] = useState<any>(() => normalizePost(post));
  const [menuVisible, setMenuVisible] = useState(false);
  const [reactionMenuVisible, setReactionMenuVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => { setItem(normalizePost(post)); }, [post]);

  const isMine = Boolean(user?.id && item.author?.id === user.id);
  const isModerator = Boolean(user?.roles?.some((role: string) => ["group_admin", "group_owner", "institution_admin", "platform_admin"].includes(role)));
  const personalPinned = isPostPinned(item.id);
  const applyPost = (next: any) => { setItem(next); onChange?.(next); };
  const updatePost = (patch: Record<string, unknown>) => {
    setItem((current: any) => {
      const next = { ...current, ...patch };
      onChange?.(next);
      return next;
    });
  };

  const chooseReaction = async (reaction: string) => {
    if (busyAction === "reaction") return;
    const previous = item;
    const removing = item.userReaction === reaction;
    setBusyAction("reaction");
    setReactionMenuVisible(false);
    try {
      const result = await campusApi.student.reaction(item.id, removing ? undefined : reaction);
      applyPost({
        ...item,
        liked: result.reaction === "like",
        userReaction: result.reaction || null,
        counts: { ...(item.counts || {}), reactions: Number(result.total || 0) },
        reactionCounts: result.counts || {},
      });
    } catch (error) {
      applyPost(previous);
      showToast({ message: getUserErrorMessage(error, "Could not update your reaction."), variant: "error" });
    } finally { setBusyAction(null); }
  };

  const toggleBookmark = async () => {
    if (busyAction === "bookmark") return;
    const previous = item;
    const bookmarked = !item.bookmarked;
    updatePost({ bookmarked });
    setBusyAction("bookmark");
    try {
      if (bookmarked) await api.saved.save(item.id); else await api.saved.remove(item.id);
      showToast({ message: bookmarked ? "Post saved" : "Removed from saved", variant: "success" });
    } catch (error) {
      applyPost(previous);
      showToast({ message: getUserErrorMessage(error, "Could not update saved posts."), variant: "error" });
    } finally { setBusyAction(null); }
  };

  const togglePersonalPin = async () => {
    const next = await togglePostPin(item.id);
    showToast({ message: next ? "Pinned to the top of your feed" : "Removed from your pinned feed", variant: "success" });
  };

  const shareExternally = async () => {
    try {
      const title = String(item.title || "OnCampus post").trim();
      const content = String(item.content || "").trim();
      const deepLink = `oncampus://post/${encodeURIComponent(String(item.id))}`;
      await Share.share({ title, message: [title !== "OnCampus post" ? title : "", content, deepLink].filter(Boolean).join("\n\n") });
    } catch {
      showToast({ message: "Could not open the share sheet.", variant: "error" });
    }
  };

  const deletePost = () => {
    Alert.alert("Delete post?", "This post will be removed from OnCampus.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await api.posts.delete(item.id);
          onDeleted?.(item.id);
          showToast({ message: "Post deleted", variant: "success" });
        } catch (error) { showToast({ message: getUserErrorMessage(error, "Could not delete this post."), variant: "error" }); }
      } },
    ]);
  };

  const pinPostGlobally = async () => {
    try { await api.posts.pin(item.id); updatePost({ pinned: true }); showToast({ message: "Post pinned for everyone", variant: "success" }); }
    catch (error) { showToast({ message: getUserErrorMessage(error, "Could not pin this post."), variant: "error" }); }
  };
  const unpinPostGlobally = async () => {
    try { await api.posts.unpin(item.id); updatePost({ pinned: false }); showToast({ message: "Global pin removed", variant: "success" }); }
    catch (error) { showToast({ message: getUserErrorMessage(error, "Could not unpin this post."), variant: "error" }); }
  };

  const options = [
    { label: personalPinned ? "Unpin from my feed" : "Pin to my feed", icon: personalPinned ? "pin" : "pin-outline", onPress: () => { void togglePersonalPin(); } },
    ...(isMine ? [{ label: "Edit", icon: "create-outline", onPress: () => router.push(`/post/edit/${item.id}`) }] : []),
    ...((isMine || isModerator) && !item.pinned ? [{ label: "Pin for everyone", icon: "megaphone-outline", onPress: pinPostGlobally }] : []),
    ...((isMine || isModerator) && item.pinned ? [{ label: "Remove global pin", icon: "megaphone-outline", onPress: unpinPostGlobally }] : []),
    ...(isMine || isModerator ? [{ label: "Delete", icon: "trash-outline", color: colors.error, onPress: deletePost }] : []),
    ...(!isMine ? [{ label: "Report", icon: "flag-outline", color: colors.warning, onPress: () => setReportVisible(true) }] : []),
  ];

  const reactionEmoji = item.userReaction ? REACTION_EMOJIS[item.userReaction] : null;

  return (
    <>
      <Pressable
        onPress={() => router.push(`/post/${item.id}`)}
        style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: personalPinned ? colors.actionPrimary : colors.border, shadowColor: colors.shadow }, style]}
        testID={`post-card-${item.id}`}
      >
        {(personalPinned || item.pinned) && (
          <View style={styles.pinRow}>
            {personalPinned && <View style={[styles.pinned, { backgroundColor: colors.selectionSoft }]}><Ionicons name="pin" size={12} color={colors.onSelectionSoft} /><Text style={{ color: colors.onSelectionSoft, fontSize: font.sm, fontWeight: "800" }}>Pinned for you</Text></View>}
            {item.pinned && <View style={[styles.pinned, { backgroundColor: colors.brandTertiary }]}><Ionicons name="megaphone" size={12} color={colors.onBrandTertiary} /><Text style={{ color: colors.onBrandTertiary, fontSize: font.sm, fontWeight: "800" }}>Campus pinned</Text></View>}
          </View>
        )}
        <View style={styles.postHeader}>
          <Avatar uri={item.author?.avatar || item.author?.avatarUrl} name={item.author?.name || "User"} size={44} verified={item.author?.verified} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.authorLine}>
              <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "700", flexShrink: 1 }} numberOfLines={1}>{item.author?.name || "User"}</Text>
              {item.author?.badge === "official" && <View style={[styles.badgeChip, { backgroundColor: colors.officialBadge }]}><Text style={{ color: colors.onInfo, fontSize: 9, fontWeight: "700" }}>OFFICIAL</Text></View>}
              {item.author?.badge === "faculty" && <View style={[styles.badgeChip, { backgroundColor: colors.facultyBadge }]}><Text style={{ color: colors.onWarning, fontSize: 9, fontWeight: "700" }}>FACULTY</Text></View>}
            </View>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }} numberOfLines={1}>{[item.author?.institution, item.createdAt, item.group?.name ? `in ${item.group.name}` : ""].filter(Boolean).join(" · ")}</Text>
          </View>
          <Pressable onPress={() => setMenuVisible(true)} hitSlop={8} style={styles.menuBtn} accessibilityRole="button" accessibilityLabel="Post options"><Ionicons name="ellipsis-horizontal" size={20} color={colors.onSurfaceTertiary} /></Pressable>
        </View>
        {item.announcement && <View style={[styles.announcement, { backgroundColor: `${colors.announcement}18` }]}><Ionicons name="megaphone" size={14} color={colors.announcement} /><Text style={{ color: colors.announcement, fontSize: font.sm, fontWeight: "800" }}>Announcement</Text></View>}
        {!!item.title && <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "800", lineHeight: 24, marginTop: spacing.md }}>{item.title}</Text>}
        {!!item.content && <View style={{ marginTop: spacing.md }}><RichPostText content={item.content} /></View>}
        {!!item.mediaUrl && item.mediaType !== "document" && <Image source={{ uri: item.mediaUrl }} style={styles.postImage} contentFit="cover" transition={180} cachePolicy="memory-disk" />}
        {!!item.mediaUrl && item.mediaType === "document" && <View style={[styles.document, { borderColor: colors.border, backgroundColor: colors.surfaceTertiary }]}><Ionicons name="document-text-outline" size={22} color={colors.actionPrimary} /><Text style={{ flex: 1, color: colors.onSurface, fontSize: font.sm }} numberOfLines={1}>Attached document</Text></View>}
        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          <ActionBtn emoji={reactionEmoji || undefined} icon={reactionEmoji ? undefined : "happy-outline"} label={String(item.counts?.reactions || 0)} color={item.userReaction ? colors.reactionActive : colors.onSurfaceTertiary} onPress={() => setReactionMenuVisible(true)} accessibilityLabel="React to post" />
          <ActionBtn icon="reader-outline" label={String(item.counts?.comments || item.comments || 0)} color={colors.onSurfaceTertiary} onPress={() => router.push(`/post/${item.id}`)} accessibilityLabel="Open comments" />
          <ActionBtn icon={item.bookmarked ? "bookmark" : "bookmark-outline"} label="" color={item.bookmarked ? colors.actionPrimary : colors.onSurfaceTertiary} onPress={toggleBookmark} accessibilityLabel={item.bookmarked ? "Remove bookmark" : "Save post"} />
          <ActionBtn icon="share-social-outline" label="" color={colors.onSurfaceTertiary} onPress={() => void shareExternally()} accessibilityLabel="Share to another app" />
        </View>
      </Pressable>
      <OptionsMenu visible={menuVisible} onClose={() => setMenuVisible(false)} options={options} title="Post options" />
      <ReactionMenu visible={reactionMenuVisible} onClose={() => setReactionMenuVisible(false)} onSelect={(type) => void chooseReaction(type)} />
      <ReportModal visible={reportVisible} onClose={() => setReportVisible(false)} onSubmit={async (reason, details) => { await api.reports.reportPost(item.id, { reason, details }); }} title="Report Post" />
    </>
  );
}

function ActionBtn({ icon, emoji, label, color, onPress, accessibilityLabel }: { icon?: keyof typeof Ionicons.glyphMap; emoji?: string; label: string; color: string; onPress: () => void; accessibilityLabel: string }) {
  return <Pressable onPress={onPress} style={styles.actionBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>{emoji ? <Text style={{ fontSize: 19 }}>{emoji}</Text> : icon ? <Ionicons name={icon} size={20} color={color} /> : null}{!!label && <Text style={{ color, fontSize: font.sm, fontWeight: "600" }}>{label}</Text>}</Pressable>;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  pinRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.sm },
  postHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  authorLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  badgeChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 4 },
  menuBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  announcement: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, marginTop: spacing.md },
  postImage: { width: "100%", aspectRatio: 16 / 10, borderRadius: radius.md, marginTop: spacing.md },
  document: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  actions: { flexDirection: "row", justifyContent: "space-around", borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.md, paddingTop: spacing.md },
  actionBtn: { minWidth: 44, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 4, paddingHorizontal: 10 },
  pinned: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
});
