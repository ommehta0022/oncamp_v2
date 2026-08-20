import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, spacing } from "@/src/theme/colors";
import PostCard from "@/src/components/PostCard";
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

  useEffect(() => { void loadPosts(); }, [loadPosts]);
  const loadMore = () => {
    if (!hasMore || loading || loadingMore || refreshing || posts.length === 0) return;
    void loadPosts(page + 1);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="feed-screen">
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={[styles.brand, { color: colors.onSurface }]}>OnCampus</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push("/search")} style={styles.iconBtn} testID="feed-search-btn"><Ionicons name="search" size={22} color={colors.onSurface} /></Pressable>
          <Pressable onPress={() => router.push("/saved")} style={styles.iconBtn} testID="feed-saved-btn"><Ionicons name="bookmark-outline" size={22} color={colors.onSurface} /></Pressable>
        </View>
      </View>

      {loading && posts.length === 0 ? <SkeletonLoader type="post" count={3} /> : error && posts.length === 0 ? (
        <NetworkError onRetry={() => void loadPosts()} message={error} />
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          data={posts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: 120, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadPosts(1, true)} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<EmptyState icon="newspaper-outline" title="No posts available" message="Institution posts and official campus announcements will appear here." actionLabel="Refresh" onAction={() => void loadPosts(1, true)} />}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.brandPrimary} style={{ paddingVertical: spacing.lg }} /> : null}
          renderItem={({ item }) => <PostCard post={item} onChange={(updated) => setPosts((current) => current.map((post) => post.id === updated.id ? updated : post))} onDeleted={(id) => setPosts((current) => current.filter((post) => post.id !== id))} style={{ marginHorizontal: spacing.lg }} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 56 },
  brand: { fontSize: 22, fontWeight: "500" },
  headerActions: { flexDirection: "row", gap: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
});
