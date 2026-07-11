import React, { useCallback, useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, Animated, Alert, Share } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import { api } from "@/src/lib/api";
import OptionsMenu from "@/src/components/OptionsMenu";
import ReportModal from "@/src/components/ReportModal";
import SkeletonLoader from "@/src/components/SkeletonLoader";
import { useRole } from "@/src/context/RoleProvider";

import { typography } from "@/src/theme/typography";
import { LinearGradient } from "expo-linear-gradient";
import ReactionMenu, { REACTION_EMOJIS } from "@/src/components/ReactionMenu";

export default function PostDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useRole();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  
  const [post, setPost] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [activeMenu, setActiveMenu] = useState<{ type: 'post' } | { type: 'comment', id: string, content: string, userId: string } | null>(null);
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'comment', id: string } | null>(null);
  const [reactionMenuVisible, setReactionMenuVisible] = useState(false);

  const handleDeletePost = () => {
    if (!id) return;
    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await api.posts.delete(id);
        router.back();
      }},
    ]);
  };

  const handlePinPost = async () => {
    if (!id) return;
    await api.posts.pin(id);
    load();
  };

  const handleDeleteComment = (commentId: string) => {
    Alert.alert("Delete Comment", "Are you sure you want to delete this comment?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await api.posts.deleteComment(commentId);
        load();
      }},
    ]);
  };

  const getMenuOptions = () => {
    if (!activeMenu) return [];
    const options = [];
    if (activeMenu.type === 'post' && post) {
      const isMine = post.author?.id === user?.id;
      const isAdmin = user?.roles?.includes("group_admin") || user?.roles?.includes("group_owner") || user?.roles?.includes("platform_admin");
      if (isMine || isAdmin) {
        options.push({ label: "Delete", icon: "trash-outline", color: colors.error || "#ef4444", onPress: handleDeletePost });
      }
      if (isAdmin) {
        options.push({ label: post.pinned ? "Unpin" : "Pin", icon: "pin-outline", onPress: handlePinPost });
      }
      if (!isMine) {
        options.push({ label: "Report", icon: "flag-outline", color: colors.warning || "#f59e0b", onPress: () => {
          setReportTarget({ type: 'post', id: post.id });
        }});
      }
    } else if (activeMenu.type === 'comment') {
      const isMine = activeMenu.userId === user?.id;
      const isAdmin = user?.roles?.includes("group_admin") || user?.roles?.includes("group_owner") || user?.roles?.includes("platform_admin");
      if (isMine || isAdmin) {
        options.push({ label: "Delete", icon: "trash-outline", color: colors.error || "#ef4444", onPress: () => handleDeleteComment(activeMenu.id) });
      }
      if (!isMine) {
        options.push({ label: "Report", icon: "flag-outline", color: colors.warning || "#f59e0b", onPress: () => {
          setReportTarget({ type: 'comment', id: activeMenu.id });
        }});
      }
    }
    return options;
  };

  const handleReport = async (reason: string, details: string) => {
    if (!reportTarget) return;
    if (reportTarget.type === 'post') {
      await api.reports.reportPost(reportTarget.id, { reason, details });
    } else if (reportTarget.type === 'comment') {
      await api.reports.reportMessage(reportTarget.id, { reason, details });
    }
  };

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.posts.get(id);
      setPost(data);
    } catch {
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!id || !text.trim()) return;
    const content = text.trim();
    setText("");
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await api.posts.comment(id, content).catch(() => {});
    load();
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background || colors.surface }} edges={["top"]}>
        <Header title="Post" onBack={() => router.back()} />
        <View style={{ padding: spacing.xl }}>
          <SkeletonLoader type="card" />
          <View style={{ marginTop: spacing.xl }}>
            <SkeletonLoader type="groupRow" />
            <SkeletonLoader type="groupRow" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background || colors.surface }} edges={["top"]}>
        <Header title="Post" onBack={() => router.back()} />
        <EmptyState icon="document-text-outline" title="Post not found" message="This post is not available or has been deleted." />
      </SafeAreaView>
    );
  }

  const comments = post.comments || [];

    const handleShare = async () => {
    try {
      if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const contentPreview = post.content.length > 50 ? post.content.substring(0, 50) + "..." : post.content;
      const url = `https://oncampus.app/post/${post.id}`;
      
      await Share.share({
        message: `${post.author?.name || "Someone"} on ONCAMPUS: "${contentPreview}"\n\n${url}`,
        url: url,
        title: "Share Post"
      });
      
      await api.posts.share(post.id).catch(() => {});
    } catch (error) {
      console.error("Error sharing post", error);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background || colors.surface }} edges={["top"]}>
      <Header title="Post" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={[styles.postCard, { backgroundColor: colors.background || colors.surface }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Avatar uri={post.author?.avatarUrl} name={post.author?.name || "User"} size={48} verified={post.author?.verified} />
              <View style={{ flex: 1, justifyContent: "center" }}>
                <Text style={{ color: colors.textPrimary || colors.onSurface, fontSize: 16, fontWeight: "700" }}>{post.author?.name || "User"}</Text>
                <Text style={{ color: colors.textSecondary || colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2, fontWeight: "500" }}>
                  {post.group?.name || "Group"} • {post.createdAt}
                </Text>
              </View>
              <Pressable 
                onPress={() => {
                  if (Platform.OS === 'ios') Haptics.selectionAsync();
                  setActiveMenu({ type: 'post' });
                }} 
                style={({ pressed }) => [{ padding: spacing.sm, opacity: pressed ? 0.5 : 1 }]} 
                hitSlop={15}
              >
                <Ionicons name="ellipsis-horizontal" size={22} color={colors.textSecondary || colors.onSurfaceTertiary} />
              </Pressable>
            </View>
            
            <Text style={{ color: colors.textPrimary || colors.onSurface, marginTop: spacing.md, ...typography.body }}>
              {post.content}
            </Text>
            
            {post.mediaUrl && (
              <Image 
                source={{ uri: post.mediaUrl }} 
                style={styles.img} 
                contentFit="cover" 
                transition={300}
              />
            )}
            
            <View style={[styles.actions, { borderTopColor: colors.border || colors.divider }]}>
              <Pressable 
                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingRight: 16 }}
                onPress={() => {
                  if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (post.liked) {
                    api.posts.unlike(post.id).then(r => setPost({ ...post, liked: r.liked, userReaction: null, counts: { ...post.counts, reactions: r.reactions } })).catch(() => {});
                  } else {
                    api.posts.like(post.id).then(r => setPost({ ...post, liked: r.liked, userReaction: "like", counts: { ...post.counts, reactions: r.reactions } })).catch(() => {});
                  }
                  setPost({ ...post, liked: !post.liked, userReaction: !post.liked ? "like" : null, counts: { ...post.counts, reactions: (post.counts?.reactions || 0) + (post.liked ? -1 : 1) } });
                }}
                onLongPress={() => {
                  if (Platform.OS === 'ios') Haptics.selectionAsync();
                  setReactionMenuVisible(true);
                }}
                delayLongPress={200}
                hitSlop={15}
              >
                {post.userReaction && post.userReaction !== "like" ? (
                  <Text style={{ fontSize: 18 }}>{REACTION_EMOJIS[post.userReaction] || "👍"}</Text>
                ) : (
                  <Ionicons name={post.liked ? "heart" : "heart-outline"} size={22} color={post.liked ? (colors.danger || colors.brandSecondary) : (colors.textSecondary || colors.onSurfaceTertiary)} />
                )}
                <Text style={{ color: post.liked ? (colors.danger || colors.brandSecondary) : (colors.textSecondary || colors.onSurfaceTertiary), fontSize: font.base, fontWeight: "600" }}>
                  {post.counts?.reactions || 0}
                </Text>
              </Pressable>
              
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingRight: 16 }}>
                <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary || colors.onSurfaceTertiary} />
                <Text style={{ color: colors.textSecondary || colors.onSurfaceTertiary, fontSize: font.base, fontWeight: "600" }}>
                  {comments.length}
                </Text>
              </View>

              <Pressable 
                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 }}
                onPress={handleShare}
                hitSlop={15}
              >
                <Ionicons name="share-outline" size={20} color={colors.textSecondary || colors.onSurfaceTertiary} />
              </Pressable>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border || colors.surfaceSecondary || "#222" }]} />

          {comments.length === 0 ? (
            <View style={{ paddingTop: spacing.xl }}>
              <EmptyState icon="chatbubble-outline" title="No comments yet" message="Be the first to share your thoughts." />
            </View>
          ) : (
            <View style={{ paddingTop: spacing.md }}>
              {comments.map((comment: any) => (
                <CommentRow 
                  key={comment.id} 
                  comment={comment} 
                  onLongPress={() => {
                    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setActiveMenu({ type: 'comment', id: comment.id, content: comment.content, userId: comment.user?.id });
                  }} 
                />
              ))}
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>

        <View style={[
          styles.composer, 
          { 
            backgroundColor: colors.background || colors.surface, 
            borderTopColor: colors.border,
            paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, spacing.sm) : spacing.sm 
          }
        ]}>
          <Avatar uri={user?.avatarUrl} name={user?.name || "You"} size={40} />
          <View style={[styles.input, { backgroundColor: colors.surfaceTertiary || "#eee", borderColor: "transparent" }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Add a comment..."
              placeholderTextColor={colors.muted}
              multiline
              style={{ flex: 1, color: colors.textPrimary || colors.onSurface, fontSize: 15, maxHeight: 100, paddingTop: Platform.OS === 'ios' ? 12 : 8, paddingBottom: Platform.OS === 'ios' ? 12 : 8 }}
            />
          </View>
          
          <Animated.View style={{ transform: [{ scale: text.trim() ? 1 : 0.8 }], opacity: text.trim() ? 1 : 0.5 }}>
            <Pressable onPress={submit} disabled={!text.trim()}>
              <LinearGradient
                colors={[colors.brandPrimary || "#2E5C4E", colors.brandSecondary || "#1a362d"]}
                style={styles.send}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="arrow-up" size={20} color="#fff" style={{ marginTop: -1 }} />
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
      
      <OptionsMenu
        visible={!!activeMenu}
        onClose={() => setActiveMenu(null)}
        options={getMenuOptions()}
      />
      
      <ReactionMenu
        visible={reactionMenuVisible}
        onClose={() => setReactionMenuVisible(false)}
        onSelect={(type) => {
          if (!id) return;
          const wasLiked = post.liked;
          setPost({ ...post, liked: true, userReaction: type, counts: { ...post.counts, reactions: (post.counts?.reactions || 0) + (wasLiked ? 0 : 1) } });
          api.posts.react(id, type).then(r => {
            setPost((p: any) => ({ ...p, liked: r.liked, userReaction: r.userReaction || type, counts: { ...p.counts, reactions: r.reactions } }));
          }).catch(() => {
            load();
          });
        }}
      />
      
      <ReportModal
        visible={!!reportTarget}
        onClose={() => setReportTarget(null)}
        onSubmit={handleReport}
        title={reportTarget?.type === 'post' ? "Report Post" : "Report Comment"}
      />
    </SafeAreaView>
  );
}

function CommentRow({ comment, onLongPress }: { comment: any, onLongPress: () => void }) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onLongPress={onLongPress}
      onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
      delayLongPress={250}
    >
      <Animated.View style={[styles.comment, { transform: [{ scale: scaleAnim }] }]}>
        <Avatar uri={comment.user?.avatarUrl} name={comment.user?.name || "Member"} size={40} />
        <View style={{ flex: 1 }}>
          <View style={[styles.commentBubble, { backgroundColor: colors.surfaceSecondary || "#f5f5f5" }]}>
            <Text style={{ color: colors.textPrimary || colors.onSurface, marginBottom: 2, ...typography.bodyBold }}>
              {comment.user?.name || "Member"}
            </Text>
            <Text style={{ color: colors.textPrimary || colors.onSurface, ...typography.body }}>
              {comment.content}
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary || colors.muted, fontSize: 11, fontWeight: "600", marginTop: 6, paddingLeft: spacing.sm }}>
            {comment.createdAt}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  postCard: { 
    paddingHorizontal: spacing.xl, 
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  img: { 
    width: "100%", 
    aspectRatio: 4 / 3, 
    borderRadius: radius.lg, 
    marginTop: spacing.md 
  },
  actions: { 
    flexDirection: "row", 
    borderTopWidth: StyleSheet.hairlineWidth, 
    marginTop: spacing.lg, 
    paddingTop: spacing.xs 
  },
  divider: {
    height: 6,
    width: "100%",
  },
  comment: { 
    flexDirection: "row", 
    gap: spacing.md, 
    paddingHorizontal: spacing.xl, 
    paddingVertical: spacing.sm 
  },
  commentBubble: { 
    paddingHorizontal: spacing.md, 
    paddingVertical: 10,
    borderRadius: radius.lg, 
    borderTopLeftRadius: 4 
  },
  composer: { 
    flexDirection: "row", 
    alignItems: "flex-end", 
    gap: spacing.sm, 
    paddingHorizontal: spacing.xl, 
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth 
  },
  input: { 
    flex: 1, 
    minHeight: 40, 
    borderRadius: 20, 
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    marginBottom: 4,
  },
  send: { 
    width: 38, 
    height: 38, 
    borderRadius: 19, 
    alignItems: "center", 
    justifyContent: "center",
    marginBottom: 4,
  },
});
