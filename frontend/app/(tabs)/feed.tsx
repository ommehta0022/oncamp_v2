import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import { feed, currentUser, FeedPost } from "@/src/data/mock";
import { useRole } from "@/src/context/RoleProvider";

export default function Feed() {
  const { colors } = useTheme();
  const router = useRouter();
  const { canCreatePosts } = useRole();
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState(feed);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const toggleLike = (id: string) => {
    setPosts((p) =>
      p.map((post) =>
        post.id === id
          ? { ...post, liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) }
          : post
      )
    );
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
        ListHeaderComponent={canCreatePosts ? <Composer /> : null}
        renderItem={({ item }) => <PostCard post={item} onLike={() => toggleLike(item.id)} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      />
    </SafeAreaView>
  );
}

function Composer() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/create-post")}
      style={[styles.composer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
      testID="composer-btn"
    >
      <Avatar uri={currentUser.avatar} name={currentUser.name} size={40} />
      <View style={[styles.composerInput, { backgroundColor: colors.surfaceTertiary }]}>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base }}>Share something with your campus…</Text>
      </View>
      <Ionicons name="image-outline" size={22} color={colors.brandPrimary} />
    </Pressable>
  );
}

function PostCard({ post, onLike }: { post: FeedPost; onLike: () => void }) {
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
            {post.author.institution} · {post.createdAt}
            {post.group ? ` · in ${post.group.name}` : ""}
          </Text>
        </View>
        <Pressable hitSlop={8}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.onSurfaceTertiary} />
        </Pressable>
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
        <Image
          source={{ uri: post.image }}
          style={styles.postImage}
          contentFit="cover"
        />
      )}

      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        <ActionBtn
          icon={post.liked ? "heart" : "heart-outline"}
          label={String(post.likes)}
          color={post.liked ? colors.brandSecondary : colors.onSurfaceTertiary}
          onPress={onLike}
        />
        <ActionBtn icon="chatbubble-outline" label={String(post.comments)} color={colors.onSurfaceTertiary} />
        <ActionBtn icon="repeat-outline" label={String(post.reposts)} color={colors.onSurfaceTertiary} />
        <ActionBtn icon={post.bookmarked ? "bookmark" : "bookmark-outline"} label="" color={colors.onSurfaceTertiary} />
      </View>
    </Pressable>
  );
}

function ActionBtn({ icon, label, color, onPress }: { icon: any; label: string; color: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.actionBtn} hitSlop={8}>
      <Ionicons name={icon} size={20} color={color} />
      {!!label && <Text style={{ color, fontSize: font.sm, fontWeight: "500" }}>{label}</Text>}
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
