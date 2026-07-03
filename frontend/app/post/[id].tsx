import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import { useRole } from "@/src/context/RoleProvider";
import { api } from "@/src/lib/api";

export default function PostDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useRole();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<any | null>(null);
  const [text, setText] = useState("");

  const load = useCallback(() => {
    if (!id) return;
    api.posts.get(id).then(setPost).catch(() => setPost(null));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!id || !text.trim()) return;
    const content = text.trim();
    setText("");
    await api.posts.comment(id, content).catch(() => {});
    load();
  };

  if (!post) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
        <Header title="Post" onBack={() => router.back()} />
        <EmptyState icon="document-text-outline" title="Post not found" message="This post is not available in the database." />
      </SafeAreaView>
    );
  }

  const comments = post.comments || [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Post" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={80}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={[styles.postCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Avatar uri={post.author?.avatarUrl} name={post.author?.name || "User"} size={48} verified={post.author?.verified} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{post.author?.name || "User"}</Text>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{post.group?.name || "Group"} - {post.createdAt}</Text>
              </View>
            </View>
            <Text style={{ color: colors.onSurface, fontSize: font.base, lineHeight: 22, marginTop: spacing.md }}>{post.content}</Text>
            {post.mediaUrl && <Image source={{ uri: post.mediaUrl }} style={styles.img} contentFit="cover" />}
            <View style={[styles.actions, { borderTopColor: colors.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="heart-outline" size={20} color={colors.onSurfaceTertiary} />
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{post.counts?.reactions || 0} likes</Text>
              </View>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{comments.length} comments</Text>
            </View>
          </View>

          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "500", paddingHorizontal: spacing.lg, marginTop: spacing.lg, textTransform: "uppercase", letterSpacing: 0.5 }}>Comments</Text>

          {comments.length === 0 ? (
            <EmptyState icon="chatbubble-outline" title="No comments yet" message="Be the first to comment on this real post." />
          ) : comments.map((comment: any) => (
            <View key={comment.id} style={styles.comment}>
              <Avatar uri={comment.user?.avatarUrl} name={comment.user?.name || "Member"} size={36} />
              <View style={{ flex: 1 }}>
                <View style={[styles.commentBubble, { backgroundColor: colors.surfaceTertiary }]}>
                  <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>{comment.user?.name || "Member"}</Text>
                  <Text style={{ color: colors.onSurface, fontSize: font.base, marginTop: 2, lineHeight: 20 }}>{comment.content}</Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: font.sm, marginTop: 6, paddingLeft: spacing.sm }}>{comment.createdAt}</Text>
              </View>
            </View>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>

        <View style={[styles.composer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Avatar uri={user?.avatarUrl} name={user?.name || "You"} size={36} />
          <View style={[styles.input, { backgroundColor: colors.surfaceTertiary }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Add a comment"
              placeholderTextColor={colors.muted}
              style={{ flex: 1, color: colors.onSurface, fontSize: font.base }}
            />
          </View>
          <Pressable onPress={submit} style={[styles.send, { backgroundColor: colors.brandPrimary }]}>
            <Ionicons name="arrow-up" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  postCard: { margin: spacing.lg, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  img: { width: "100%", aspectRatio: 16 / 10, borderRadius: radius.md, marginTop: spacing.md },
  actions: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.md, paddingTop: spacing.md },
  comment: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  commentBubble: { padding: spacing.md, borderRadius: radius.md },
  composer: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 40, borderRadius: radius.pill, paddingHorizontal: spacing.md, justifyContent: "center" },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
