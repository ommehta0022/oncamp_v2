import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/colors";
import { usePinnedContent } from "@/src/context/PinnedContentProvider";
import PostCard from "@/src/components/PostCard";
import { api } from "@/src/lib/api";
import { cache } from "@/src/lib/cache";
import { normalizePost } from "@/src/lib/mappers";
import CampusLoader from "@/src/components/CampusLoader";
import EmptyState from "@/src/components/EmptyState";
import { NetworkError } from "@/src/components/NetworkError";
import { useToast } from "@/src/components/Toast";

const PAGE_SIZE = 20;
const APP_ICON = require("../../assets/images/icon.png");

export default function Feed() {
  const { colors } = useTheme();
  const router = useRouter();
  const { showToast } = useToast();
  const { isPostPinned } = usePinnedContent();
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

  const displayPosts = useMemo(() => posts
    .map((post, index) => ({ post, index, pinned: isPostPinned(post.id) }))
    .sort((left, right) => Number(right.pinned) - Number(left.pinned) || left.index - right.index)
    .map(({ post }) => post), [isPostPinned, posts]);

  const loadMore = () => {
    if (!hasMore || loading || loadingMore || refreshing || posts.length === 0) return;
    void loadPosts(page + 1);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="feed-screen">
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.divider }]}>
        <View style={styles.brandWrap}>
          <Image source={APP_ICON} style={styles.brandIcon} contentFit="cover" />
          <Text style={[styles.brand, { color: colors.onSurface }]}>OnCampus</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push("/(tabs)/discover" as any)} style={styles.iconBtn} testID="feed-search-btn" accessibilityRole="button" accessibilityLabel="Search"><Ionicons name="search" size={22} color={colors.onSurface} /></Pressable>
          <Pressable onPress={() => router.push("/saved")} style={styles.iconBtn} testID="feed-saved-btn" accessibilityRole="button" accessibilityLabel="Saved posts"><Ionicons name="bookmark-outline" size={21} color={colors.onSurface} /></Pressable>
        </View>
      </View>

      {loading && posts.length === 0 ? <CampusLoader fullScreen label="Loading your campus feed…" /> : error && posts.length === 0 ? (
        <NetworkError onRetry={() => void loadPosts()} message={error} />
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          data={displayPosts}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: 120, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadPosts(1, true)} tintColor={colors.actionPrimary} colors={[colors.actionPrimary]} />}
          ListEmptyComponent={<EmptyState icon="newspaper-outline" title="No posts available" message="Institution posts and official campus announcements will appear here automatically." />}
          ListFooterComponent={loadingMore ? <CampusLoader compact label="Loading more…" /> : null}
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 62 },
  brandWrap: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  brandIcon: { width: 36, height: 36, borderRadius: 11 },
  brand: { fontSize: 22, fontWeight: "900", letterSpacing: -0.6 },
  headerActions: { flexDirection: "row", gap: 2 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
});
