import React, { useEffect, useState } from "react";
import { Alert, Platform, Pressable, Share, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import { api, FeedPostDto, getUserErrorMessage } from "@/src/lib/api";
import { normalizePost } from "@/src/lib/mappers";
import { useRole } from "@/src/context/RoleProvider";
import Avatar from "@/src/components/Avatar";
import OptionsMenu from "@/src/components/OptionsMenu";
import ReportModal from "@/src/components/ReportModal";
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
  const [item, setItem] = useState<any>(() => normalizePost(post));
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    setItem(normalizePost(post));
  }, [post]);

  const isMine = Boolean(user?.id && item.author?.id === user.id);
  const isModerator = Boolean(user?.roles?.some((role: string) => ["group_admin", "group_owner", "institution_admin", "platform_admin"].includes(role)));

  const applyPost = (next: any) => {
    setItem(next);
    onChange?.(next);
  };

  const updatePost = (patch: Record<string, unknown>) => {
    setItem((current: any) => {
      const next = { ...current, ...patch };
      onChange?.(next);
      return next;
    });
  };

  const toggleLike = async () => {
    if (busyAction === "like") return;
    const previous = item;
    const liked = !item.liked;
    updatePost({ liked, likes: Math.max(0, Number(item.likes || 0) + (liked ? 1 : -1)) });
    setBusyAction("like");
    try {
      const result = previous.liked ? await api.posts.unlike(item.id) : await api.posts.like(item.id);
      updatePost({ liked: result.liked, likes: result.reactions, userReaction: result.liked ? "like" : null });
    } catch (error) {
      applyPost(previous);
      showToast({ message: getUserErrorMessage(error, "Could not update this post."), variant: "error" });
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
      if (bookmarked) await api.saved.save(item.id);
      else await api.saved.remove(item.id);
      showToast({ message: bookmarked ? "Post saved" : "Removed from saved", variant: "success" });
    } catch (error) {
      applyPost(previous);
      showToast({ message: getUserErrorMessage(error, "Could not update saved posts."), variant: "error" });
    } finally {
      setBusyAction(null);
    }
  };

  const repost = async () => {
    if (busyAction === "repost") return;
    const previous = item;
    updatePost({ reposts: Number(item.reposts || 0) + 1 });
    setBusyAction("repost");
    try {
      await api.posts.repost(item.id);
      showToast({ message: "Reposted to your feed", variant: "success" });
    } catch (error) {
      applyPost(previous);
      showToast({ message: getUserErrorMessage(error, "Could not repost this post."), variant: "error" });
    } finally {
      setBusyAction(null);
    }
  };

  const sharePost = async () => {
    try {
      const preview = item.content.length > 80 ? `${item.content.slice(0, 80)}...` : item.content;
      await Share.share({
        title: "Share post",
        message: `${item.author?.name || "Someone"} on OnCampus: ${preview}\n\nhttps://oncampus.app/post/${item.id}`,
        url: Platform.OS === "ios" ? `https://oncampus.app/post/${item.id}` : undefined,
      });
      await api.posts.share(item.id).catch(() => undefined);
    } catch (error) {
      showToast({ message: getUserErrorMessage(error, "Could not open sharing."), variant: "error" });
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

  const pinPost = async () => {
    try {
      await api.posts.pin(item.id);
      updatePost({ pinned: true });
      showToast({ message: "Post pinned", variant: "success" });
    } catch (error) {
      showToast({ message: getUserErrorMessage(error, "Could not pin this post."), variant: "error" });
    }
  };

  const unpinPost = async () => {
    try {
      await api.posts.unpin(item.id);
      updatePost({ pinned: false });
      showToast({ message: "Post unpinned", variant: "success" });
    } catch (error) {
      showToast({ message: getUserErrorMessage(error, "Could not unpin this post."), variant: "error" });
    }
  };

  const options = [
    ...(isMine ? [{ label: "Edit", icon: "create-outline", onPress: () => router.push(`/post/edit/${item.id}`) }] : []),
    ...(isMine || isModerator ? [{ label: "Delete", icon: "trash-outline", color: colors.error, onPress: deletePost }] : []),
    ...((isMine || isModerator) && !item.pinned ? [{ label: "Pin to top", icon: "pin-outline", onPress: pinPost }] : []),
    ...((isMine || isModerator) && item.pinned ? [{ label: "Unpin post", icon: "pin-outline", onPress: unpinPost }] : []),
    ...(!isMine ? [{ label: "Report", icon: "flag-outline", color: colors.warning, onPress: () => setReportVisible(true) }] : []),
  ];

  return (
    <>
      <Pressable
        onPress={() => router.push(`/post/${item.id}`)}
        style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, style]}
        testID={`post-card-${item.id}`}
      >
        {item.pinned && (
          <View style={[styles.pinned, { backgroundColor: colors.brandTertiary }]}>
            <Ionicons name="pin" size={12} color={colors.onBrandTertiary} />
            <Text style={{ color: colors.onBrandTertiary, fontSize: font.sm, fontWeight: "500" }}>Pinned</Text>
          </View>
        )}

        <View style={styles.postHeader}>
          <Avatar uri={item.author?.avatar || item.author?.avatarUrl} name={item.author?.name || "User"} size={44} verified={item.author?.verified} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.authorLine}>
              <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500", flexShrink: 1 }} numberOfLines={1}>{item.author?.name || "User"}</Text>
              {item.author?.badge === "official" && (
                <View style={[styles.badgeChip, { backgroundColor: colors.info }]}>
                  <Text style={{ color: colors.onInfo, fontSize: 9, fontWeight: "500" }}>OFFICIAL</Text>
                </View>
              )}
              {item.author?.badge === "faculty" && (
                <View style={[styles.badgeChip, { backgroundColor: colors.warning }]}>
                  <Text style={{ color: colors.onWarning, fontSize: 9, fontWeight: "500" }}>FACULTY</Text>
                </View>
              )}
            </View>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }} numberOfLines={1}>
              {[item.author?.institution, item.createdAt, item.group?.name ? `in ${item.group.name}` : ""].filter(Boolean).join(" · ")}
            </Text>
          </View>
          {options.length > 0 && (
            <Pressable onPress={() => setMenuVisible(true)} hitSlop={8} style={styles.menuBtn}>
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.onSurfaceTertiary} />
            </Pressable>
          )}
        </View>

        {item.announcement && (
          <View style={[styles.announcement, { backgroundColor: colors.brandSecondary + "22" }]}>
            <Ionicons name="megaphone" size={14} color={colors.brandSecondary} />
            <Text style={{ color: colors.brandSecondary, fontSize: font.sm, fontWeight: "500" }}>Announcement</Text>
          </View>
        )}

        {!!item.content && (
          <Text style={{ color: colors.onSurface, fontSize: font.base, lineHeight: 22, marginTop: spacing.md }}>
            {item.content}
          </Text>
        )}

        {!!item.mediaUrl && item.mediaType !== "document" && (
          <Image source={{ uri: item.mediaUrl }} style={styles.postImage} contentFit="cover" transition={180} />
        )}

        {!!item.mediaUrl && item.mediaType === "document" && (
          <View style={[styles.document, { borderColor: colors.border, backgroundColor: colors.surfaceTertiary }]}>
            <Ionicons name="document-text-outline" size={22} color={colors.brandPrimary} />
            <Text style={{ flex: 1, color: colors.onSurface, fontSize: font.sm }} numberOfLines={1}>Attached document</Text>
          </View>
        )}

        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          <ActionBtn
            icon={item.liked ? "heart" : "heart-outline"}
            label={String(item.counts?.reactions || item.likes || 0)}
            color={item.liked ? colors.brandSecondary : colors.onSurfaceTertiary}
            onPress={toggleLike}
          />
          <ActionBtn icon="reader-outline" label={String(item.counts?.comments || item.comments || 0)} color={colors.onSurfaceTertiary} onPress={() => router.push(`/post/${item.id}`)} />
          <ActionBtn icon="repeat-outline" label={String(item.counts?.reposts || item.reposts || 0)} color={colors.onSurfaceTertiary} onPress={repost} />
          <ActionBtn icon={item.bookmarked ? "bookmark" : "bookmark-outline"} label="" color={item.bookmarked ? colors.brandSecondary : colors.onSurfaceTertiary} onPress={toggleBookmark} />
        </View>
      </Pressable>

      <OptionsMenu visible={menuVisible} onClose={() => setMenuVisible(false)} options={options} title="Post options" />
      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        onSubmit={async (reason, details) => {
          await api.reports.reportPost(item.id, { reason, details });
        }}
        title="Report Post"
      />
    </>
  );
}

function ActionBtn({ icon, label, color, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.actionBtn} hitSlop={8}>
      <Ionicons name={icon} size={20} color={color} />
      {!!label && <Text style={{ color, fontSize: font.sm, fontWeight: "500" }}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
  },
  postHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  authorLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  badgeChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 4 },
  menuBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  announcement: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, marginTop: spacing.md,
  },
  postImage: {
    width: "100%", aspectRatio: 16 / 10, borderRadius: radius.md, marginTop: spacing.md,
  },
  document: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md,
  },
  actions: {
    flexDirection: "row", justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingHorizontal: 6 },
  pinned: {
    flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: spacing.sm,
  },
});
