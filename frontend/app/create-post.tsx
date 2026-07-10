import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import Avatar from "@/src/components/Avatar";
import { useRole } from "@/src/context/RoleProvider";
import { api } from "@/src/lib/api";

export default function CreatePost() {
  const { colors } = useTheme();
  const router = useRouter();
  const [text, setText] = useState("");
  const { user } = useRole();
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    api.groups.listMine().then(res => {
      const g = (res as any).groups || res;
      if (g && g.length > 0) setGroup(g[0]);
    }).catch(() => {});
  }, []);

  const handlePost = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      await api.feed.create({ content: text, groupId: group?.id });
      router.back();
    } catch (e) {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header
        title="New post"
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={handlePost}
            disabled={!text.trim() || loading}
            style={[styles.postBtn, { backgroundColor: text.trim() ? colors.brandPrimary : colors.borderStrong }]}
          >
            <Text style={{ color: "#fff", fontSize: font.sm, fontWeight: "500" }}>Post</Text>
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
                <Ionicons name="chevron-down" size={12} color={colors.onBrandTertiary} />
              </Pressable>
            </View>
          </View>

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
        </ScrollView>

        <View style={[styles.toolbar, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
          {["image-outline", "videocam-outline", "document-outline", "location-outline", "happy-outline"].map((i) => (
            <Pressable key={i} style={styles.toolBtn}>
              <Ionicons name={i as any} size={22} color={colors.brandPrimary} />
            </Pressable>
          ))}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  postBtn: { paddingHorizontal: spacing.lg, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  groupPicker: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  toolbar: { flexDirection: "row", justifyContent: "space-around", paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: Platform.OS === "ios" ? 24 : spacing.md },
  toolBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
