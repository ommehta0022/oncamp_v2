import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform, Pressable, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import Avatar from "@/src/components/Avatar";
import EmptyState from "@/src/components/EmptyState";
import { useRole } from "@/src/context/RoleProvider";
import { api, GroupDto } from "@/src/lib/api";
import { showImagePicker, uploadPostMedia } from "@/src/lib/imageUpload";

export default function CreatePost() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useRole();
  const [text, setText] = useState("");
  const [group, setGroup] = useState<GroupDto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    api.groups.listMine()
      .then((rows) => {
        setGroup(rows[0] || null);
      })
      .catch(() => {
        setGroup(null);
      });
  }, []);

  const handleImagePick = async () => {
    const uri = await showImagePicker({ aspect: [4, 3], quality: 0.8 });
    if (uri) setImageUri(uri);
  };

  const submit = async () => {
    if (!text.trim() || submitting || !group) return;
    setSubmitting(true);
    setError("");
    try {
      let mediaUrl = null;
      
      // Upload image if selected
      if (imageUri) {
        setUploadingImage(true);
        try {
          const result = await uploadPostMedia(imageUri);
          mediaUrl = result.url;
        } catch (error) {
          console.error("Image upload failed:", error);
          Alert.alert("Upload Failed", "Continuing without image");
        } finally {
          setUploadingImage(false);
        }
      }
      
      await api.feed.create({
        content: text.trim(),
        type: "announcement",
        visibility: "group",
        groupId: group.id,
        mediaUrl: mediaUrl || undefined,
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create post");
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header
        title="New post"
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={submit}
            disabled={!text.trim() || submitting}
            style={[styles.postBtn, { backgroundColor: text.trim() && group ? colors.brandPrimary : colors.borderStrong }]}
          >
            <Text style={{ color: "#fff", fontSize: font.sm, fontWeight: "500" }}>{submitting ? "Posting" : "Post"}</Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg }}>
          {!group && (
            <EmptyState icon="people-outline" title="No group selected" message="Join or create a real group before publishing a group post." />
          )}
          {group && (
            <>
          <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
            <Avatar uri={user?.avatarUrl} name={user?.name || "You"} size={44} verified={user?.verified} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{user?.name || "Complete your profile"}</Text>
              <View style={[styles.groupPicker, { backgroundColor: colors.brandTertiary }]}>
                <Ionicons name="people" size={12} color={colors.onBrandTertiary} />
                <Text style={{ color: colors.onBrandTertiary, fontSize: font.sm, fontWeight: "500" }}>Post to {group.name}</Text>
              </View>
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

          {/* Image Preview */}
          {imageUri && (
            <View style={styles.imagePreview}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} contentFit="cover" />
              <TouchableOpacity 
                style={styles.removeImage} 
                onPress={() => setImageUri(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Image Attachment Button */}
          <View style={styles.toolbar}>
            <TouchableOpacity 
              onPress={handleImagePick} 
              disabled={uploadingImage || submitting}
              style={[styles.toolbarButton, { opacity: uploadingImage || submitting ? 0.5 : 1 }]}
            >
              {uploadingImage ? (
                <ActivityIndicator size="small" color={colors.brandPrimary} />
              ) : (
                <Ionicons name="image-outline" size={24} color={colors.brandPrimary} />
              )}
              <Text style={[styles.toolbarText, { color: colors.brandPrimary }]}>
                {uploadingImage ? "Uploading..." : "Add Photo"}
              </Text>
            </TouchableOpacity>
          </View>

          {!!error && <Text style={{ color: colors.error, fontSize: font.sm, marginTop: spacing.md }}>{error}</Text>}
          </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  postBtn: { paddingHorizontal: spacing.lg, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  groupPicker: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  imagePreview: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    overflow: "hidden",
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: 200,
  },
  removeImage: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
  },
  toolbar: {
    flexDirection: "row",
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  toolbarButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  toolbarText: {
    fontSize: font.sm,
    marginLeft: spacing.sm,
    fontWeight: "500",
  },
});
