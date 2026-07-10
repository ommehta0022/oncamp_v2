import React, { useState } from "react";
import { ActivityIndicator, Alert, View, Text, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import Avatar from "@/src/components/Avatar";
import { useRole } from "@/src/context/RoleProvider";
import { api } from "@/src/lib/api";
import { showImagePicker, uploadPostMedia } from "@/src/lib/imageUpload";
import { asArray, normalizeGroup } from "@/src/lib/mappers";

export default function CreatePost() {
  const { colors } = useTheme();
  const router = useRouter();
  const [text, setText] = useState("");
  const { user } = useRole();
  const [group, setGroup] = useState<any>(null);
  const [groups, setGroups] = useState<ReturnType<typeof normalizeGroup>[]>([]);
  const [loading, setLoading] = useState(false);
  const [mediaUri, setMediaUri] = useState<string | null>(null);

  React.useEffect(() => {
    api.groups.listMine().then(res => {
      const list = asArray(res, "groups").map(normalizeGroup);
      setGroups(list);
      if (list.length > 0) setGroup(list[0]);
    }).catch(() => {});
  }, []);

  const handlePost = async () => {
    if ((!text.trim() && !mediaUri) || loading) return;
    setLoading(true);
    try {
      let mediaUrl: string | undefined;
      if (mediaUri) {
        const uploaded = await uploadPostMedia(mediaUri);
        mediaUrl = uploaded.url;
      }
      await api.feed.create({ content: text.trim(), groupId: group?.id, mediaUrl });
      router.back();
    } catch (e) {
      Alert.alert("Post failed", e instanceof Error ? e.message : "Please try again.");
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const uri = await showImagePicker({ aspect: [4, 3], quality: 0.85 });
    if (uri) setMediaUri(uri);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header
        title="New post"
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={handlePost}
            disabled={(!text.trim() && !mediaUri) || loading}
            style={[styles.postBtn, { backgroundColor: (text.trim() || mediaUri) ? colors.brandPrimary : colors.borderStrong }]}
          >
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontSize: font.sm, fontWeight: "500" }}>Post</Text>}
          </Pressable>
        }
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg }}>
          <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
            <Avatar uri={(user as any)?.avatar} name={user?.name || "User"} size={44} verified={(user as any)?.verified} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{user?.name}</Text>
              <Pressable style={[styles.groupPicker, { backgroundColor: colors.brandTertiary }]}>
                <Ionicons name="people" size={12} color={colors.onBrandTertiary} />
                <Text style={{ color: colors.onBrandTertiary, fontSize: font.sm, fontWeight: "500" }}>Post to {group?.name || "Campus"}</Text>
              </Pressable>
            </View>
          </View>

          {groups.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.lg }}>
              {groups.map((item) => {
                const selected = group?.id === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setGroup(item)}
                    style={[styles.groupChip, { backgroundColor: selected ? colors.brandPrimary : colors.surfaceTertiary }]}
                  >
                    <Text style={{ color: selected ? colors.onBrandPrimary : colors.onSurface, fontSize: font.sm, fontWeight: "500" }} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="What's on your mind, campus?"
            placeholderTextColor={colors.muted}
            multiline
            style={{
              color: colors.onSurface, fontSize: font.lg,
              marginTop: spacing.xl, minHeight: 200, lineHeight: 24,
              textAlignVertical: "top",
            }}
            autoFocus
          />

          {mediaUri && (
            <View style={{ marginTop: spacing.lg }}>
              <Image source={{ uri: mediaUri }} style={styles.preview} contentFit="cover" />
              <Pressable onPress={() => setMediaUri(null)} style={[styles.removeMedia, { backgroundColor: colors.surfaceSecondary }]}>
                <Ionicons name="close" size={18} color={colors.onSurface} />
              </Pressable>
            </View>
          )}
        </ScrollView>

        <View style={[styles.toolbar, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
          <Pressable style={styles.toolBtn} onPress={pickImage}>
            <Ionicons name="image-outline" size={22} color={colors.brandPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  postBtn: { paddingHorizontal: spacing.lg, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  groupPicker: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  groupChip: { maxWidth: 180, height: 32, borderRadius: radius.pill, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center" },
  preview: { width: "100%", aspectRatio: 16 / 10, borderRadius: radius.md },
  removeMedia: { position: "absolute", right: spacing.sm, top: spacing.sm, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  toolbar: { flexDirection: "row", justifyContent: "space-around", paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: Platform.OS === "ios" ? 24 : spacing.md },
  toolBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
