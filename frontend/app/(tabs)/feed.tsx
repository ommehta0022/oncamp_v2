import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import PostCard from "@/src/components/PostCard";
import { useRole } from "@/src/context/RoleProvider";
import { api } from "@/src/lib/api";
import { cache } from "@/src/lib/cache";
import { normalizePost } from "@/src/lib/mappers";
import SkeletonLoader from "@/src/components/SkeletonLoader";
import EmptyState from "@/src/components/EmptyState";
import { NetworkError } from "@/src/components/NetworkError";
import { useToast } from "@/src/components/Toast";

const PAGE_SIZE = 20;

export default function Feed() {
  const { colors } = useTheme();
  const router = useRouter();
  const { canCreatePosts } = useRole();
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = useCallback(async (pageToLoad = 1, isRefresh = false) => {
    if (pageToLoad > 1) setLoadingMore(true);
    else if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      if (pageToLoad === 1 && !isRefresh) {
        const cached = await cache.get<any[]>("feed_posts");
        if (cached?.length) setPosts(cached.map(normalizePost));
      }

      const response = await api.feed.list(pageToLoad, PAGE_SIZE);
      const rows = (response.posts || response.feed || []).map(normalizePost);
      setPosts((current) => {
        if (pageToLoad === 1) return rows;
        const seen = new Set(current.map((post) => post.id));
        return [...current, ...rows.filter((post) => !seen.has(post.id))];
      });
      setPage(pageToLoad);
      setHasMore(Boolean(response.hasMore ?? rows.length === PAGE_SIZE));
      if (pageToLoad === 1) await cache.set("feed_posts", rows, 5 * 60 * 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load your feed.";
      setError(message);
      if (isRefresh || pageToLoad > 1) showToast({ message, variant: "error" });
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const onRefresh = () => void loadPosts(1, true);

  const loadMore = () => {
    if (!hasMore || loading || loadingMore || refreshing || posts.length === 0) return;
    void loadPosts(page + 1);
  };

  const updatePost = (updated: any) => {
    setPosts((current) => current.map((post) => post.id === updated.id ? updated : post));
  };

  const removePost = (postId: string) => {
    setPosts((current) => current.filter((post) => post.id !== postId));
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

      {loading && posts.length === 0 ? (
        <SkeletonLoader type="post" count={3} />
      ) : error && posts.length === 0 ? (
        <NetworkError onRetry={() => void loadPosts()} message={error} />
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          data={posts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingBottom: 120, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
          ListHeaderComponent={canCreatePosts ? <Composer /> : <View style={{ height: spacing.md }} />}
          ListEmptyComponent={
            <EmptyState
              icon="newspaper-outline"
              title="No posts available"
              message="There are no posts in your feed yet. Pull to refresh or create the first post."
              actionLabel={canCreatePosts ? "Create post" : "Refresh"}
              onAction={() => canCreatePosts ? router.push("/create-post") : loadPosts(1, true)}
            />
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.brandPrimary} style={{ paddingVertical: spacing.lg }} /> : null}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onChange={updatePost}
              onDeleted={removePost}
              style={{ marginHorizontal: spacing.lg }}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
        />
      )}
    </SafeAreaView>
  );
}

function Composer() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useRole();
  return (
    <Pressable
      onPress={() => router.push("/create-post")}
      style={[styles.composer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
      testID="composer-btn"
    >
      <Avatar uri={(user as any)?.avatar || user?.avatarUrl} name={user?.name || "User"} size={40} />
      <View style={[styles.composerInput, { backgroundColor: colors.surfaceTertiary }]}>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base }}>Share something with your campus...</Text>
      </View>
      <Ionicons name="image-outline" size={22} color={colors.brandPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 56,
  },
  brand: { fontSize: 22, fontWeight: "500", letterSpacing: 0 },
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
});
