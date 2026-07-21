import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import { api, FeedPostDto } from "@/src/lib/api";
import { normalizePost } from "@/src/lib/mappers";

export default function Saved() {
  const { colors } = useTheme();
  const router = useRouter();
  const [savedPosts, setSavedPosts] = useState<(FeedPostDto | any)[]>([]);

  useEffect(() => {
    api.saved.list().then((rows) => setSavedPosts(rows.map(normalizePost))).catch(() => setSavedPosts([]));
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="saved-screen">
      <Header title="Saved" subtitle={`${savedPosts.length} posts`} onBack={() => router.back()} />
      {savedPosts.length === 0 ? (
        <EmptyState icon="bookmark-outline" title="Nothing saved yet" message="Bookmark posts from the feed to read later." />
      ) : (
        <FlatList showsVerticalScrollIndicator={false}
          data={savedPosts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/post/${item.id}`)}
              style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
              <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
                <Avatar uri={item.author?.avatarUrl || item.author?.avatar} name={item.author?.name || "User"} size={40} verified={item.author?.verified} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{item.author?.name || "User"}</Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{item.createdAt}</Text>
                </View>
                <Ionicons name="bookmark" size={18} color={colors.brandSecondary} />
              </View>
              <Text style={{ color: colors.onSurface, fontSize: font.base, lineHeight: 20, marginTop: spacing.md }} numberOfLines={3}>
                {item.content}
              </Text>
              {(item.image || item.imageUrl || item.mediaUrl) && <Image source={{ uri: item.image || item.imageUrl || item.mediaUrl }} style={styles.img} contentFit="cover" />}
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  img: { width: "100%", aspectRatio: 16 / 10, borderRadius: radius.md, marginTop: spacing.md },
});
