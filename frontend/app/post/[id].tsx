import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import Header from "@/src/components/Header";
import { feed, users, currentUser } from "@/src/data/mock";

export default function PostDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const post = feed.find((p) => p.id === id) || feed[0];
  const [text, setText] = useState("");
  const [comments, setComments] = useState([
    { id: "c1", user: users[1], content: "This is incredible. Congrats team!", time: "1h", likes: 12 },
    { id: "c2", user: users[3], content: "Where can we register for the demo?", time: "45m", likes: 4 },
    { id: "c3", user: users[6], content: "Sign-ups open Wednesday — I'll drop a link here.", time: "30m", likes: 8 },
  ]);

  const submit = () => {
    if (!text.trim()) return;
    setComments((c) => [...c, { id: "c" + Date.now(), user: currentUser, content: text.trim(), time: "now", likes: 0 }]);
    setText("");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Post" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={80}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={[styles.postCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Avatar uri={post.author.avatar} name={post.author.name} size={48} verified={post.author.verified} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{post.author.name}</Text>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{post.author.institution} · {post.createdAt}</Text>
              </View>
            </View>
            <Text style={{ color: colors.onSurface, fontSize: font.base, lineHeight: 22, marginTop: spacing.md }}>{post.content}</Text>
            {post.image && <Image source={{ uri: post.image }} style={styles.img} contentFit="cover" />}
            <View style={[styles.actions, { borderTopColor: colors.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="heart-outline" size={20} color={colors.onSurfaceTertiary} />
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{post.likes} likes</Text>
              </View>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{comments.length} comments · {post.reposts} reposts</Text>
            </View>
          </View>

          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "500", paddingHorizontal: spacing.lg, marginTop: spacing.lg, textTransform: "uppercase", letterSpacing: 0.5 }}>Comments</Text>

          {comments.map((c) => (
            <View key={c.id} style={styles.comment}>
              <Avatar uri={c.user.avatar} name={c.user.name} size={36} />
              <View style={{ flex: 1 }}>
                <View style={[styles.commentBubble, { backgroundColor: colors.surfaceTertiary }]}>
                  <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>{c.user.name}</Text>
                  <Text style={{ color: colors.onSurface, fontSize: font.base, marginTop: 2, lineHeight: 20 }}>{c.content}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: spacing.lg, marginTop: 6, paddingLeft: spacing.sm }}>
                  <Text style={{ color: colors.muted, fontSize: font.sm }}>{c.time}</Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "500" }}>Like ({c.likes})</Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "500" }}>Reply</Text>
                </View>
              </View>
            </View>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>

        <View style={[styles.composer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Avatar uri={currentUser.avatar} name={currentUser.name} size={36} />
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
