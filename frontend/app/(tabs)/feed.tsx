import React, { useCallback, useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, TouchableOpacity, Animated, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import EmptyState from "@/src/components/EmptyState";
import Card from "@/src/components/Card";
import SkeletonLoader from "@/src/components/SkeletonLoader";
import { api, FeedPostDto } from "@/src/lib/api";
import OptionsMenu from "@/src/components/OptionsMenu";
import ReportModal from "@/src/components/ReportModal";
import { Alert } from "react-native";
import { cache } from "@/src/lib/cache";
import { useRole } from "@/src/context/RoleProvider";
import ImageViewer from "@/src/components/ImageViewer";
import { typography } from "@/src/theme/typography";
import { useToast } from "@/src/components/Toast";
import ReactionMenu, { REACTION_EMOJIS } from "@/src/components/ReactionMenu";

type FeedPost = {
  id: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
    institution?: string;
    verified?: boolean;
    badge?: string;
  };
  group?: { id: string; name: string };
  content: string;
  image?: string;
  createdAt: string;
  likes: number;
  comments: number;
  reposts: number;
  liked?: boolean;
  bookmarked?: boolean;
  pinned?: boolean;
  announcement?: boolean;
  postType?: string;
  userReaction?: string | null;
};

export default function Feed() {
  const { colors } = useTheme();
  const router = useRouter();
  const { canCreatePosts, user } = useRole();
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImage, setViewerImage] = useState("");
  const [activeOptionsPost, setActiveOptionsPost] = useState<FeedPost | null>(null);
  const [activeReactionPost, setActiveReactionPost] = useState<FeedPost | null>(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportTarget, setReportTarget] = useState<string | null>(null);

  // FAB animation
  const scrollY = useRef(new Animated.Value(0)).current;
  const fabTranslateY = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 100],
    extrapolate: "clamp",
  });

  const openImage = (url: string) => {
    setViewerImage(url);
    setViewerVisible(true);
  };

  const loadPosts = useCallback(async (isLoadMore = false) => {
    if (isLoadMore && (loadingMore || !hasMore)) return;
    
    if (isLoadMore) {
      setLoadingMore(true);
    }

    try {
      if (!isLoadMore) {
        const cached = await cache.get<FeedPost[]>("feed_posts");
        if (cached && posts.length === 0) setPosts(cached);
      }
      
      const currentPage = isLoadMore ? page + 1 : 1;
      const response = await api.feed.list(currentPage);
      const apiPosts = response.posts || response.feed || [];
      const mapped = apiPosts.map(toFeedPost);
      
      if (isLoadMore) {
        setPosts(prev => {
          // avoid duplicates
          const existingIds = new Set(prev.map(p => p.id));
          const newUnique = mapped.filter(p => !existingIds.has(p.id));
          return [...prev, ...newUnique];
        });
      } else {
        setPosts(mapped);
        await cache.set("feed_posts", mapped);
      }
      
      setHasMore(response.hasMore ?? mapped.length >= 20);
      setPage(currentPage);
    } catch {
      if (!isLoadMore && posts.length === 0) {
        const cached = await cache.get<FeedPost[]>("feed_posts");
        if (cached) setPosts(cached);
        else setPosts([]);
      }
    } finally {
      if (isLoadMore) setLoadingMore(false);
      else setLoading(false);
    }
  }, [posts.length, page, hasMore, loadingMore]);

  useEffect(() => {
    if (loading && page === 1) {
      loadPosts(false);
    }
  }, []);

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      loadPosts(true);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPosts(false);
    setRefreshing(false);
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleLike = async (id: string) => {
    const current = posts.find((post) => post.id === id);
    if (!current) return;
    setPosts((p) =>
      p.map((post) =>
        post.id === id
          ? { ...post, liked: !post.liked, userReaction: !post.liked ? "like" : null, likes: post.likes + (post.liked ? -1 : 1) }
          : post
      )
    );
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = current.liked ? await api.posts.unlike(id) : await api.posts.like(id);
      setPosts((p) => p.map((post) => post.id === id ? { ...post, liked: result.liked, userReaction: result.liked ? "like" : null, likes: result.reactions } : post));
    } catch {
      setPosts((p) => p.map((post) => post.id === id ? current : post));
    }
  };

  const handleReact = async (id: string, type: string) => {
    const current = posts.find((post) => post.id === id);
    if (!current) return;
    const wasLiked = current.liked;
    setPosts((p) =>
      p.map((post) =>
        post.id === id
          ? { ...post, liked: true, userReaction: type, likes: post.likes + (wasLiked ? 0 : 1) }
          : post
      )
    );
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await api.posts.react(id, type);
      setPosts((p) => p.map((post) => post.id === id ? { ...post, liked: result.liked, userReaction: result.userReaction || type, likes: result.reactions } : post));
    } catch {
      setPosts((p) => p.map((post) => post.id === id ? current : post));
      showToast({ message: "Could not add reaction", variant: "error" });
    }
  };

  const toggleBookmark = async (id: string) => {
    const current = posts.find((post) => post.id === id);
    if (!current) return;
    setPosts((p) => p.map((post) => post.id === id ? { ...post, bookmarked: !post.bookmarked } : post));
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (current.bookmarked) {
        await api.saved.remove(id);
        showToast({ message: "Removed from saved posts" });
      } else {
        await api.saved.save(id);
        showToast({ message: "Saved post", variant: "success" });
      }
    } catch {
      setPosts((p) => p.map((post) => post.id === id ? current : post));
      showToast({ message: "Failed to save post", variant: "error" });
    }
  };

  const handleDeletePost = (post: FeedPost) => {
    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await api.posts.delete(post.id);
          setPosts(p => p.filter(x => x.id !== post.id));
          showToast({ message: "Post deleted" });
        } catch (err) {
          showToast({ message: "Could not delete post", variant: "error" });
        }
      }},
    ]);
  };

  const handlePinPost = async (post: FeedPost) => {
    try {
      await api.posts.pin(post.id);
      setPosts(p => p.map(x => x.id === post.id ? { ...x, pinned: !x.pinned } : x));
      showToast({ message: post.pinned ? "Post unpinned" : "Post pinned", variant: "success" });
    } catch (err) {
      showToast({ message: "Could not pin post", variant: "error" });
    }
  };

  const getPostOptions = () => {
    if (!activeOptionsPost) return [];
    const isMine = activeOptionsPost.author.id === user?.id;
    const isAdmin = user?.roles?.includes("group_admin") || user?.roles?.includes("group_owner") || user?.roles?.includes("platform_admin");
    const options = [];
    if (isMine || isAdmin) {
      options.push({ label: "Delete", icon: "trash-outline", color: colors.danger || colors.error, onPress: () => handleDeletePost(activeOptionsPost) });
    }
    if (isAdmin) {
      options.push({ label: activeOptionsPost.pinned ? "Unpin" : "Pin", icon: "pin-outline", onPress: () => handlePinPost(activeOptionsPost) });
    }
    if (!isMine) {
      options.push({ 
        label: "Report", 
        icon: "flag-outline", 
        color: colors.warning, 
        onPress: () => {
          setReportTarget(activeOptionsPost.id);
          setReportModalVisible(true);
        }
      });
    }
    return options;
  };

  const handleReport = async (reason: string, details: string) => {
    if (!reportTarget) return;
    await api.reports.reportPost(reportTarget, { reason, details });
    showToast({ message: "Report submitted successfully", variant: "success" });
  };

  const renderSkeletons = () => (
    <View style={{ paddingHorizontal: spacing.md }}>
      <SkeletonLoader type="post" count={3} />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background || colors.surface }} edges={["top"]} testID="feed-screen">
      <View style={[styles.header, { backgroundColor: colors.background || colors.surface }]}>
        <Text style={[styles.brand, { color: colors.textPrimary || colors.onSurface }]}>OnCampus</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push("/search")} style={styles.iconBtn} testID="feed-search-btn">
            <Ionicons name="search" size={24} color={colors.textPrimary || colors.onSurface} />
          </Pressable>
          <Pressable onPress={() => router.push("/saved")} style={styles.iconBtn} testID="feed-saved-btn">
            <Ionicons name="bookmark-outline" size={24} color={colors.textPrimary || colors.onSurface} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        renderSkeletons()
      ) : (
        <Animated.FlatList 
          showsVerticalScrollIndicator={false}
          data={posts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingBottom: 120, paddingTop: spacing.md }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor={colors.brandPrimary} 
              colors={[colors.brandPrimary]}
            />
          }
          ListHeaderComponent={
            canCreatePosts ? <Composer user={user} /> : <View style={{ height: spacing.sm }} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            <View style={{ paddingVertical: spacing.xl }}>
              {loadingMore ? (
                <ActivityIndicator size="small" color={colors.brandPrimary} />
              ) : !hasMore && posts.length > 0 ? (
                <Text style={{ textAlign: 'center', color: colors.textSecondary || colors.muted, fontSize: font.sm }}>
                  You've caught up!
                </Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="newspaper-outline"
              title="No posts yet"
              message="Real announcements and posts will appear here after verified publishers create them."
            />
          }
          renderItem={({ item }) => (
            <PostCard 
              post={item} 
              onLike={() => toggleLike(item.id)}
              onLikeLongPress={() => setActiveReactionPost(item)}
              onBookmark={() => toggleBookmark(item.id)} 
              onImagePress={openImage}
              onOptionsPress={() => setActiveOptionsPost(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        />
      )}
      
      {canCreatePosts && (
        <Animated.View style={[styles.fabContainer, { transform: [{ translateY: fabTranslateY }] }]}>
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => {
              if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/create-post");
            }}
          >
            <LinearGradient
              colors={[colors.gradientStart || colors.brandPrimary, colors.gradientEnd || colors.brandTertiary]}
              style={styles.fab}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="add" size={32} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}
      
      <ReactionMenu
        visible={!!activeReactionPost}
        onClose={() => setActiveReactionPost(null)}
        onSelect={(type) => {
          if (activeReactionPost) handleReact(activeReactionPost.id, type);
        }}
      />
      
      <OptionsMenu
        visible={!!activeOptionsPost}
        onClose={() => setActiveOptionsPost(null)}
        options={getPostOptions()}
      />
      
      <ReportModal
        visible={reportModalVisible}
        onClose={() => {
          setReportModalVisible(false);
          setReportTarget(null);
        }}
        onSubmit={handleReport}
        title="Report Post"
      />
      
      <ImageViewer
        visible={viewerVisible}
        imageUrl={viewerImage}
        onClose={() => setViewerVisible(false)}
      />
    </SafeAreaView>
  );
}

function toFeedPost(post: FeedPostDto): FeedPost {
  return {
    id: post.id,
    author: {
      id: post.author?.id || "unknown",
      name: post.author?.name || "User",
      avatar: post.author?.avatarUrl,
      institution: post.author?.institution || post.group?.name || "",
      verified: post.author?.verified,
      badge: post.author?.badge === "official" ? "official" : undefined,
    },
    group: post.group,
    content: post.content,
    image: post.imageUrl || post.mediaUrl,
    createdAt: post.createdAt,
    likes: post.counts?.reactions || 0,
    comments: post.counts?.comments || 0,
    reposts: post.counts?.reposts || 0,
    pinned: post.pinned,
    announcement: post.announcement,
    liked: post.liked,
    bookmarked: post.bookmarked,
    postType: (post as any).postType || post.postType || "discussion",
    userReaction: post.userReaction,
  };
}

function Composer({ user }: { user: ReturnType<typeof useRole>["user"] }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Card 
      padding={spacing.md} 
      style={{ marginHorizontal: spacing.md, marginBottom: spacing.lg, borderRadius: radius.lg }}
    >
      <Pressable
        onPress={() => router.push("/create-post")}
        style={styles.composer}
        testID="composer-btn"
      >
        <Avatar uri={user?.avatarUrl} name={user?.name || "You"} size={40} />
        <View style={[styles.composerInput, { backgroundColor: colors.inputBg || colors.surfaceTertiary }]}>
          <Text style={{ color: colors.placeholder || colors.onSurfaceTertiary, fontSize: font.base }}>What's happening on campus?</Text>
        </View>
        <View style={[styles.iconWrap, { backgroundColor: colors.brandPrimary + '15' }]}>
          <Ionicons name="image" size={20} color={colors.brandPrimary} />
        </View>
      </Pressable>
    </Card>
  );
}

function PostCard({ post, onLike, onLikeLongPress, onBookmark, onImagePress, onOptionsPress }: { post: FeedPost; onLike: () => void; onLikeLongPress?: () => void; onBookmark: () => void; onImagePress: (url: string) => void; onOptionsPress?: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  
  const handleShare = async () => {
    try {
      if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const contentPreview = post.content.length > 50 ? post.content.substring(0, 50) + "..." : post.content;
      const url = `https://oncampus.app/post/${post.id}`;
      
      const { Share } = require('react-native');
      await Share.share({
        message: `${post.author.name} on ONCAMPUS: "${contentPreview}"\n\n${url}`,
        url: url,
        title: "Share Post"
      });
      
      // Tell backend about the share if supported
      await api.posts.share(post.id).catch(() => {});
    } catch (error) {
      console.error("Error sharing post", error);
    }
  };

  const isLong = post.content.length > 200;
  const displayContent = expanded || !isLong ? post.content : post.content.substring(0, 200) + "...";

  return (
    <Card 
      padding={spacing.lg}
      style={{ marginHorizontal: spacing.md, borderRadius: radius.lg }}
      onPress={() => router.push(`/post/${post.id}`)}
    >
      {post.pinned && (
        <View style={[styles.pinned, { backgroundColor: (colors.brandTertiary || colors.brandPrimary) + '15' }]}>
          <Ionicons name="pin" size={12} color={colors.brandPrimary} />
          <Text style={{ color: colors.brandPrimary, fontSize: font.sm, fontWeight: "600" }}>Pinned</Text>
        </View>
      )}

      <View style={styles.postHeader}>
        <Avatar uri={post.author.avatar} name={post.author.name} size={44} verified={post.author.verified} />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: colors.textPrimary || colors.onSurface, fontSize: font.base, fontWeight: "700" }}>{post.author.name}</Text>
            {post.author.badge === "official" && (
              <View style={[styles.badgeChip, { backgroundColor: colors.info || "#3b82f6" }]}>
                <Text style={{ color: "#ffffff", fontSize: 9, fontWeight: "700", letterSpacing: 0.5 }}>OFFICIAL</Text>
              </View>
            )}
            {post.author.badge === "faculty" && (
              <View style={[styles.badgeChip, { backgroundColor: colors.warning || "#f59e0b" }]}>
                <Text style={{ color: "#ffffff", fontSize: 9, fontWeight: "700", letterSpacing: 0.5 }}>FACULTY</Text>
              </View>
            )}
          </View>
          <Text style={{ color: colors.textSecondary || colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }} numberOfLines={1}>
            {post.author.institution} • {post.createdAt}
            {post.group ? ` • in ${post.group.name}` : ""}
          </Text>
        </View>
        {onOptionsPress && (
          <Pressable onPress={onOptionsPress} style={{ padding: spacing.xs }} hitSlop={15}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary || colors.onSurfaceTertiary} />
          </Pressable>
        )}
      </View>

      {(post.announcement || (post.postType && post.postType !== "discussion")) && (
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" }}>
          {post.announcement && (
            <View style={[styles.announcement, { marginTop: 0, backgroundColor: colors.brandSecondary + "15" }]}>
              <Ionicons name="megaphone" size={14} color={colors.brandSecondary} />
              <Text style={{ color: colors.brandSecondary, fontSize: font.sm, fontWeight: "600" }}>Announcement</Text>
            </View>
          )}
          
          {post.postType && post.postType !== "discussion" && post.postType !== "announcement" && (
            <View style={[styles.announcement, { marginTop: 0, backgroundColor: colors.surfaceSecondary || "#f0f0f0" }]}>
              <Ionicons 
                name={
                  post.postType === "event" ? "calendar" : 
                  post.postType === "job" ? "briefcase" : 
                  post.postType === "poll" ? "stats-chart" : "document-text"
                } 
                size={14} 
                color={colors.textSecondary || colors.onSurfaceTertiary} 
              />
              <Text style={{ color: colors.textSecondary || colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "600", textTransform: "capitalize" }}>
                {post.postType}
              </Text>
            </View>
          )}
        </View>
      )}

      <Text style={{ color: colors.textPrimary || colors.onSurface, marginTop: spacing.md, ...typography.body }}>
        {displayContent}
      </Text>
      {isLong && !expanded && (
        <Pressable onPress={() => setExpanded(true)} style={{ marginTop: 2 }}>
          <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "600" }}>Read more</Text>
        </Pressable>
      )}

      {post.image && (
        <TouchableOpacity onPress={() => onImagePress(post.image!)} activeOpacity={0.9}>
          <Image
            source={{ uri: post.image }}
            style={styles.postImage}
            contentFit="cover"
            transition={200}
          />
        </TouchableOpacity>
      )}

      <View style={[styles.actions, { borderTopColor: colors.border || colors.borderStrong }]}>
        <ActionBtn
          icon={post.userReaction && post.userReaction !== "like" ? null : (post.liked ? "heart" : "heart-outline")}
          emoji={post.userReaction && post.userReaction !== "like" ? REACTION_EMOJIS[post.userReaction] : null}
          label={String(post.likes)}
          color={post.liked ? (colors.danger || colors.brandSecondary) : (colors.textSecondary || colors.onSurfaceTertiary)}
          onPress={onLike}
          onLongPress={onLikeLongPress}
          isLiked={post.liked}
        />
        <ActionBtn 
          icon="chatbubble-outline" 
          label={String(post.comments)} 
          color={colors.textSecondary || colors.onSurfaceTertiary} 
        />
        <ActionBtn 
          icon="share-outline" 
          label="" 
          color={colors.textSecondary || colors.onSurfaceTertiary} 
          onPress={handleShare}
        />
        <ActionBtn 
          icon={post.bookmarked ? "bookmark" : "bookmark-outline"} 
          label="" 
          color={post.bookmarked ? colors.brandPrimary : (colors.textSecondary || colors.onSurfaceTertiary)} 
          onPress={onBookmark} 
        />
      </View>
    </Card>
  );
}

function ActionBtn({ icon, emoji, label, color, onPress, onLongPress, isLiked }: { icon?: any; emoji?: string | null; label: string; color: string; onPress?: () => void; onLongPress?: () => void; isLiked?: boolean }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (!onPress) return;
    
    // Bounce animation
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.2, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true })
    ]).start();
    
    onPress();
  };

  const handleLongPress = () => {
    if (!onLongPress) return;
    if (Platform.OS === 'ios') Haptics.selectionAsync();
    onLongPress();
  };

  const content = (
    <Animated.View style={[styles.actionBtnInner, { transform: [{ scale: scaleAnim }] }]}>
      {emoji ? (
        <Text style={{ fontSize: 18 }}>{emoji}</Text>
      ) : (
        icon && <Ionicons name={icon} size={22} color={color} />
      )}
      {!!label && <Text style={{ color, fontSize: font.sm, fontWeight: "600" }}>{label}</Text>}
    </Animated.View>
  );

  if (!onPress && !onLongPress) {
    return <View style={styles.actionBtn}>{content}</View>;
  }
  
  return (
    <Pressable onPress={handlePress} onLongPress={handleLongPress} delayLongPress={200} style={styles.actionBtn} hitSlop={15}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
  },
  brand: { 
    ...typography.h2,
    fontSize: 24, 
    letterSpacing: -0.5 
  },
  headerActions: { flexDirection: "row", gap: spacing.md },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  composer: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
  },
  composerInput: {
    flex: 1, height: 44, borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, justifyContent: "center",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  postHeader: { flexDirection: "row", alignItems: "center" },
  badgeChip: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, marginLeft: 6 },
  announcement: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, marginTop: spacing.md,
  },
  postImage: {
    width: "100%", aspectRatio: 16 / 10, borderRadius: radius.md, marginTop: spacing.md,
  },
  actions: {
    flexDirection: "row", justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.md,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  actionBtn: { paddingVertical: 4 },
  actionBtnInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  pinned: {
    flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: spacing.md,
  },
  fabContainer: {
    position: "absolute",
    bottom: spacing.xl,
    right: spacing.xl,
    zIndex: 10,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  }
});
