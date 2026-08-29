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
import ReportModal from "@/src/components/ReportModal";
import RichPostText from "@/src/components/RichPostText";
import { useToast } from "@/src/components/Toast";

type Props = {
  post: FeedPostDto | any;
  onChange?: (post: any) => void;
  onDeleted?: (postId: string) => void;
  style?: StyleProp<ViewStyle>;
};

const VERIFIED_BLUE = "#1D73E8";

export default function PostCard({ post, onChange, onDeleted, style }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useRole();
  const { showToast } = useToast();
  const { isPostPinned, togglePostPin } = usePinnedContent();
  const [item, setItem] = useState<any>(() => normalizePost(post));
  const [menuVisible, setMenuVisible] = useState(false);
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

  const toggleLike = async () => {
    if (busyAction === "reaction") return;
    const previous = item;
    const wasLiked = item.userReaction === "like";
    const hadReaction = Boolean(item.userReaction);
    const nextCount = Math.max(0, Number(item.counts?.reactions || 0) + (wasLiked ? -1 : hadReaction ? 0 : 1));
    const optimistic = {
      ...item,
      liked: !wasLiked,
      userReaction: wasLiked ? null : "like",
      counts: { ...(item.counts || {}), reactions: nextCount },
    };
    applyPost(optimistic);
    setBusyAction("reaction");
    try {
      const result = await campusApi.student.reaction(item.id, wasLiked ? undefined : "like");
      applyPost({
        ...optimistic,
        liked: result.reaction === "like",
        userReaction: result.reaction || null,
        counts: { ...(optimistic.counts || {}), reactions: Number(result.total ?? nextCount) },
        reactionCounts: result.counts || {},
      });
    } catch (error) {
      applyPost(previous);
      showToast({ message: getUserErrorMessage(error, "Could not update your like."), variant: "error" });
    } finally {
      setBusyAction(null);
    }
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
    } finally {
      setBusyAction(null);
    }
  };

  const togglePersonalPin = async () => {
    const nextPinned = await togglePostPin(item.id);
    showToast({ message: nextPinned ? "Pinned to the top of your feed" : "Removed from your pinned feed", variant: "success" });
  };

  const shareExternally = async () => {
    try {
      const title = String(item.title || "OnCampus post").trim();
      const content = String(item.content || "").trim();
      const deepLink = `oncampus://post/${encodeURIComponent(String(item.id))}`;
      await Share.share({
        title,
        message: [title !== "OnCampus post" ? title : "", content, deepLink].filter(Boolean).join("\n\n"),
      });
    } catch {
      showToast({ message: "Could not open the share sheet.", variant: "error" });
    }
  };

  const deletePost = () => {
    Alert.alert("Delete post?", "This post will be removed from OnCampus.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.posts.delete(item.id);
            onDeleted?.(item.id);
            showToast({ message: "Post deleted", variant: "success" });
          } catch (error) {
            showToast({ message: getUserErrorMessage(error, "Could not delete this post."), variant: "error" });
          }
        },
      },
    ]);
  };

  const pinPostGlobally = async () => {
    try {
      await api.posts.pin(item.id);
      updatePost({ pinned: true });
      showToast({ message: "Post pinned for everyone", variant: "success" });
    } catch (error) {
      showToast({ message: getUserErrorMessage(error, "Could not pin this post."), variant: "error" });
    }
  };

  const unpinPostGlobally = async () => {
    try {
      await api.posts.unpin(item.id);
      updatePost({ pinned: false });
      showToast({ message: "Global pin removed", variant: "success" });
    } catch (error) {
      showToast({ message: getUserErrorMessage(error, "Could not unpin this post."), variant: "error" });
    }
  };

  const options = [
    { label: personalPinned ? "Unpin from my feed" : "Pin to my feed", icon: personalPinned ? "pin" : "pin-outline", onPress: () => { void togglePersonalPin(); } },
    ...(isMine ? [{ label: "Edit", icon: "create-outline", onPress: () => router.push(`/post/edit/${item.id}`) }] : []),
    ...((isMine || isModerator) && !item.pinned ? [{ label: "Pin for everyone", icon: "megaphone-outline", onPress: pinPostGlobally }] : []),
    ...((isMine || isModerator) && item.pinned ? [{ label: "Remove global pin", icon: "megaphone-outline", onPress: unpinPostGlobally }] : []),
    ...(isMine || isModerator ? [{ label: "Delete", icon: "trash-outline", color: colors.error, onPress: deletePost }] : []),
    ...(!isMine ? [{ label: "Report", icon: "flag-outline", color: colors.warning, onPress: () => setReportVisible(true) }] : []),
  ];

  const isOfficial = item.author?.badge === "official";
  const likeColor = item.userReaction === "like" ? colors.brandPrimary : colors.onSurfaceTertiary;

  return (
    <>
      <Pressable onPress={() => router.push(`/post/${item.id}`)} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, style]} testID={`post-card-${item.id}`}>
        {(personalPinned || item.pinned) ? (
          <View style={styles.pinRow}>
            {personalPinned ? <View style={[styles.pinned, { backgroundColor: colors.surfaceTertiary }]}><Ionicons name="pin" size={12} color={colors.onSurfaceTertiary} /><Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "600" }}>Pinned for you</Text></View> : null}
            {item.pinned ? <View style={[styles.pinned, { backgroundColor: colors.brandTertiary }]}><Ionicons name="megaphone" size={12} color={colors.onBrandTertiary} /><Text style={{ color: colors.onBrandTertiary, fontSize: font.sm, fontWeight: "600" }}>Campus pinned</Text></View> : null}
          </View>
        ) : null}
        <View style={styles.postHeader}>
          <Avatar
            uri={item.author?.avatar || item.author?.avatarUrl}
            name={item.author?.name || "User"}
            size={44}
            verified={Boolean(item.author?.verified && !isOfficial)}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.authorLine}>
              <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "600", flexShrink: 1 }} numberOfLines={1}>{item.author?.name || "User"}</Text>
              {isOfficial ? <Ionicons name="checkmark-circle" size={16} color={VERIFIED_BLUE} accessibilityLabel="Verified official account" /> : null}
              {item.author?.badge === "faculty" ? <View style={[styles.badgeChip, { backgroundColor: colors.warning }]}><Text style={{ color: colors.onWarning, fontSize: 9, fontWeight: "600" }}>FACULTY</Text></View> : null}
            </View>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }} numberOfLines={1}>{[item.author?.institution, item.createdAt, item.group?.name ? `in ${item.group.name}` : ""].filter(Boolean).join(" · ")}</Text>
          </View>
          <Pressable onPress={() => setMenuVisible(true)} hitSlop={8} style={styles.menuBtn} accessibilityRole="button" accessibilityLabel="Post options">
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.onSurfaceTertiary} />
          </Pressable>
        </View>
        {item.announcement ? <View style={[styles.announcement, { backgroundColor: colors.brandSecondary + "22" }]}><Ionicons name="megaphone" size={14} color={colors.brandSecondary} /><Text style={{ color: colors.brandSecondary, fontSize: font.sm, fontWeight: "600" }}>Announcement</Text></View> : null}
        {!!item.title && <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "700", lineHeight: 24, marginTop: spacing.md }}>{item.title}</Text>}
        {!!item.content && <View style={{ marginTop: spacing.md }}><RichPostText content={item.content} /></View>}
        {!!item.mediaUrl && item.mediaType !== "document" ? <Image source={{ uri: item.mediaUrl }} style={styles.postImage} contentFit="cover" transition={180} cachePolicy="memory-disk" /> : null}
        {!!item.mediaUrl && item.mediaType === "document" ? <View style={[styles.document, { borderColor: colors.border, backgroundColor: colors.surfaceTertiary }]}><Ionicons name="document-text-outline" size={22} color={colors.brandPrimary} /><Text style={{ flex: 1, color: colors.onSurface, fontSize: font.sm }} numberOfLines={1}>Attached document</Text></View> : null}
        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          <ActionBtn
            icon={item.userReaction === "like" ? "thumbs-up" : "thumbs-up-outline"}
            label={String(item.counts?.reactions || 0)}
            color={likeColor}
            onPress={() => void toggleLike()}
            accessibilityLabel={item.userReaction === "like" ? "Unlike post" : "Like post"}
          />
          <ActionBtn icon="reader-outline" label={String(item.counts?.comments || item.comments || 0)} color={colors.onSurfaceTertiary} onPress={() => router.push(`/post/${item.id}`)} accessibilityLabel="Open comments" />
          <ActionBtn icon={item.bookmarked ? "bookmark" : "bookmark-outline"} label="" color={item.bookmarked ? colors.brandSecondary : colors.onSurfaceTertiary} onPress={toggleBookmark} accessibilityLabel={item.bookmarked ? "Remove bookmark" : "Save post"} />
          <ActionBtn icon="share-social-outline" label="" color={colors.onSurfaceTertiary} onPress={() => void shareExternally()} accessibilityLabel="Share to another app" />
        </View>
      </Pressable>
      <OptionsMenu visible={menuVisible} onClose={() => setMenuVisible(false)} options={options} title="Post options" />
      <ReportModal visible={reportVisible} onClose={() => setReportVisible(false)} onSubmit={async (reason, details) => { await api.reports.reportPost(item.id, { reason, details }); }} title="Report Post" />
    </>
  );
}

function ActionBtn({ icon, label, color, onPress, accessibilityLabel }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; onPress: () => void; accessibilityLabel: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name={icon} size={20} color={color} />
      {!!label && <Text style={{ color, fontSize: font.sm, fontWeight: "500" }}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: 1, padding: spacing.lg },
  pinRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.sm },
  postHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  authorLine: { flexDirection: "row", alignItems: "center", gap: 5 },
  badgeChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 4 },
  menuBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  announcement: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, marginTop: spacing.md },
  postImage: { width: "100%", aspectRatio: 16 / 10, borderRadius: radius.md, marginTop: spacing.md },
  document: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  actions: { flexDirection: "row", justifyContent: "space-around", borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.md, paddingTop: spacing.md },
  actionBtn: { minWidth: 44, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 4, paddingHorizontal: 10 },
  pinned: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
});
