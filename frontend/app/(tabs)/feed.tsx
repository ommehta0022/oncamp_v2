import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import EmptyState from "@/src/components/EmptyState";
import ImageViewer from "@/src/components/ImageViewer";
import { useRole } from "@/src/context/RoleProvider";
import { api, FeedPostDto } from "@/src/lib/api";

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
};

export default function Feed() {
  const { colors } = useTheme();
  const router = useRouter();
  const { canCreatePosts, user } = useRole();
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImage, setViewerImage] = useState("");

  const openImage = (url: string) => {
    setViewerImage(url);
    setViewerVisible(true);
  };

  const loadPosts = useCallback(async () => {
    try {
      const response = await api.feed.list();
      const apiPosts = response.posts || response.feed || [];
      setPosts(apiPosts.map(toFeedPost));
    } catch {
      setPosts([]);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const toggleLike = async (id: string) => {
    const current = posts.find((post) => post.id === id);
    if (!current) return;
    setPosts((p) =>
      p.map((post) =>
        post.id === id
          ? { ...post, liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) }
          : post
      )
    );
    try {
      const result = current.liked ? await api.posts.unlike(id) : await api.posts.like(id);
      setPosts((p) => p.map((post) => post.id === id ? { ...post, liked: result.liked, likes: result.reactions } : post));
    } catch {
      setPosts((p) => p.map((post) => post.id === id ? current : post));
    }
  };

  const toggleBookmark = async (id: string) => {
    const current = posts.find((post) => post.id === id);
    if (!current) return;
    setPosts((p) => p.map((post) => post.id === id ? { ...post, bookmarked: !post.bookmarked } : post));
    try {
      if (current.bookmarked) await api.saved.remove(id);
      else await api.saved.save(id);
    } catch {
      setPosts((p) => p.map((post) => post.id === id ? current : post));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="feed-screen">
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={[styles.brand, { color: colors.onSurface }]}>OnCampus</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push("/search")} style={styles.iconBtn} testID="feed-search-btn">
            <Ionicons name="search" size={22} color={colors.onSurface} />
          </Pressable>
          <Pressable onPress={() => router.push("/saved")} style={styles.iconBtn} testID="feed-saved-btn">
            <Ionicons name="bookmark-outline" size={22} color={colors.onSurface} />
          </Pressable>
        </View>
      </View>

      <FlatList showsVerticalScrollIndicator={false}
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        ListHeaderComponent={canCreatePosts ? <Composer user={user} /> : <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <EmptyState
            icon="newspaper-outline"
            title="No posts yet"
            message="Real announcements and posts will appear here after verified publishers create them."
            actionLabel={canCreatePosts ? "Create post" : undefined}
            onAction={canCreatePosts ? () => router.push("/create-post") : undefined}
          />
        }
        renderItem={({ item }) => <PostCard post={item} onLike={() => toggleLike(item.id)} onBookmark={() => toggleBookmark(item.id)} onImagePress={openImage} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
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
  };
}

function Composer({ user }: { user: ReturnType<typeof useRole>["user"] }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/create-post")}
      style={[styles.composer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
      testID="composer-btn"
    >
      <Avatar uri={user?.avatarUrl} name={user?.name || "You"} size={40} />
      <View style={[styles.composerInput, { backgroundColor: colors.surfaceTertiary }]}>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base }}>Share something with your campus...</Text>
      </View>
      <Ionicons name="image-outline" size={22} color={colors.brandPrimary} />
    </Pressable>
  );
}

function PostCard({ post, onLike, onBookmark, onImagePress }: { post: FeedPost; onLike: () => void; onBookmark: () => void; onImagePress: (url: string) => void }) {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/post/${post.id}`)}
      style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
    >
      {post.pinned && (
        <View style={[styles.pinned, { backgroundColor: colors.brandTertiary }]}>
          <Ionicons name="pin" size={12} color={colors.onBrandTertiary} />
          <Text style={{ color: colors.onBrandTertiary, fontSize: font.sm, fontWeight: "500" }}>Pinned</Text>
        </View>
      )}

      <View style={styles.postHeader}>
        <Avatar uri={post.author.avatar} name={post.author.name} size={44} verified={post.author.verified} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{post.author.name}</Text>
            {post.author.badge === "official" && (
              <View style={[styles.badgeChip, { backgroundColor: colors.info }]}>
                <Text style={{ color: colors.onInfo, fontSize: 9, fontWeight: "500" }}>OFFICIAL</Text>
              </View>
            )}
            {post.author.badge === "faculty" && (
              <View style={[styles.badgeChip, { backgroundColor: colors.warning }]}>
                <Text style={{ color: colors.onWarning, fontSize: 9, fontWeight: "500" }}>FACULTY</Text>
              </View>
            )}
          </View>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }} numberOfLines={1}>
            {post.author.institution} - {post.createdAt}
            {post.group ? ` - in ${post.group.name}` : ""}
          </Text>
        </View>
      </View>

      {post.announcement && (
        <View style={[styles.announcement, { backgroundColor: colors.brandSecondary + "22" }]}>
          <Ionicons name="megaphone" size={14} color={colors.brandSecondary} />
          <Text style={{ color: colors.brandSecondary, fontSize: font.sm, fontWeight: "500" }}>Announcement</Text>
        </View>
      )}

      <Text style={{ color: colors.onSurface, fontSize: font.base, lineHeight: 22, marginTop: spacing.md }}>
        {post.content}
      </Text>

      {post.image && (
        <TouchableOpacity onPress={() => onImagePress(post.image!)} activeOpacity={0.9}>
          <Image
            source={{ uri: post.image }}
            style={styles.postImage}
            contentFit="cover"
          />
        </TouchableOpacity>
      )}

      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        <ActionBtn
          icon={post.liked ? "heart" : "heart-outline"}
          label={String(post.likes)}
          color={post.liked ? colors.brandSecondary : colors.onSurfaceTertiary}
          onPress={onLike}
        />
        <ActionBtn icon="chatbubble-outline" label={String(post.comments)} color={colors.onSurfaceTertiary} />
        <ActionBtn icon={post.bookmarked ? "bookmark" : "bookmark-outline"} label="" color={post.bookmarked ? colors.brandSecondary : colors.onSurfaceTertiary} onPress={onBookmark} />
      </View>
    </Pressable>
  );
}

function ActionBtn({ icon, label, color, onPress }: { icon: any; label: string; color: string; onPress?: () => void }) {
  const content = (
    <>
      <Ionicons name={icon} size={20} color={color} />
      {!!label && <Text style={{ color, fontSize: font.sm, fontWeight: "500" }}>{label}</Text>}
    </>
  );
  if (!onPress) {
    return <View style={styles.actionBtn}>{content}</View>;
  }
  return (
    <Pressable onPress={onPress} style={styles.actionBtn} hitSlop={8}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 56,
  },
  brand: { fontSize: 22, fontWeight: "500", letterSpacing: -0.5 },
  headerActions: { flexDirection: "row", gap: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  composer: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    marginHorizontal: spacing.lg, marginTop: spacing.md,
    padding: spacing.md, borderRadius: radius.md, borderWidth: 1,
  },
  composerInput: {
    flex: 1, height: 40, borderRadius: radius.pill,
    paddingHorizontal: spacing.md, justifyContent: "center",
  },
  card: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.md, borderWidth: 1,
    padding: spacing.lg,
  },
  postHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  badgeChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 4 },
  announcement: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, marginTop: spacing.md,
  },
  postImage: {
    width: "100%", aspectRatio: 16 / 10, borderRadius: radius.md, marginTop: spacing.md,
  },
  actions: {
    flexDirection: "row", justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingHorizontal: 8 },
  pinned: {
    flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: spacing.sm,
  },
});
