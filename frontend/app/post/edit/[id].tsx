import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform, Pressable, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import Avatar from "@/src/components/Avatar";
import { useRole } from "@/src/context/RoleProvider";
import { api, FeedPostDto } from "@/src/lib/api";
import { showImagePicker, uploadPostMedia } from "@/src/lib/imageUpload";
import { useToast } from "@/src/components/Toast";

export default function EditPost() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useRole();
  const { showToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<FeedPostDto | null>(null);
  
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (!id) return;
    
    api.posts.get(id)
      .then((data: any) => {
        setPost(data);
        setText(data.content || "");
        
        if (data.mediaUrls && data.mediaUrls.length > 0) {
          setImageUri(data.mediaUrls[0]);
        } else if (data.mediaUrl) {
          setImageUri(data.mediaUrl);
        } else if (data.imageUrl) {
          setImageUri(data.imageUrl);
        }
        
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch post for edit:", err);
        setError("Failed to load post");
        setLoading(false);
      });
  }, [id]);

  const handleImagePick = async () => {
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const uri = await showImagePicker({ aspect: [4, 3], quality: 0.8 });
    if (uri) setImageUri(uri);
  };

  const submit = async () => {
    if (!text.trim() || submitting || !post) return;
    setSubmitting(true);
    setError("");
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      let mediaUrl = imageUri;
      
      if (imageUri && !imageUri.startsWith("http")) {
        setUploadingImage(true);
        try {
          const result = await uploadPostMedia(imageUri);
          mediaUrl = result.url;
        } catch (error) {
          console.error("Image upload failed:", error);
          Alert.alert("Upload Failed", "Continuing without new image");
          mediaUrl = post.mediaUrl || post.imageUrl || null;
        } finally {
          setUploadingImage(false);
        }
      }
      
      await api.posts.edit(post.id, {
        content: text.trim(),
        mediaUrl: mediaUrl || null,
      });
      
      if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({ message: "Post updated successfully", variant: "success" });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update post");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background || colors.surface }} edges={["top"]}>
        <Header title="Edit Post" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background || colors.surface }} edges={["top"]}>
      <Header
        title="Edit Post"
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={submit}
            disabled={!text.trim() || submitting}
            style={[styles.postBtn, { backgroundColor: text.trim() ? colors.brandPrimary : colors.borderStrong || colors.border }]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={{ color: "#fff", fontSize: font.sm, fontWeight: "600" }}>Save</Text>
            )}
          </Pressable>
        }
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg }}>
          
          {post && (
            <>
              <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
                <Avatar uri={user?.avatarUrl} name={user?.name || "You"} size={44} verified={user?.verified} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary || colors.onSurface, fontSize: font.base, fontWeight: "600" }}>{user?.name || "You"}</Text>
                  {post.group && (
                    <View style={[styles.groupPicker, { backgroundColor: colors.brandSecondary || colors.brandTertiary }]}>
                      <Ionicons name="people" size={12} color={colors.onBrandTertiary || "#FFF"} />
                      <Text style={{ color: colors.onBrandTertiary || "#FFF", fontSize: font.sm, fontWeight: "500" }}>{post.group.name}</Text>
                    </View>
                  )}
                </View>
              </View>

              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="What's on your mind, campus?"
                placeholderTextColor={colors.textSecondary || colors.muted}
                multiline
                style={{
                  color: colors.textPrimary || colors.onSurface, fontSize: 16,
                  marginTop: spacing.xl, minHeight: 200, lineHeight: 24,
                  textAlignVertical: "top",
                  fontWeight: "500"
                }}
                autoFocus
              />

              {/* Image Preview */}
              {imageUri ? (
                <View style={styles.imagePreview}>
                  <Image source={{ uri: imageUri }} style={styles.previewImage} contentFit="cover" />
                  <View style={styles.overlayControls}>
                    <TouchableOpacity 
                      onPress={handleImagePick} 
                      disabled={uploadingImage || submitting}
                      style={[styles.overlayBtn, { backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 16 }]}
                    >
                      {uploadingImage ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <Ionicons name="image" size={20} color="#FFF" />
                          <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 14 }}>Change</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.overlayBtn, { backgroundColor: "rgba(220,50,50,0.8)" }]}
                      onPress={() => setImageUri(null)}
                      disabled={uploadingImage || submitting}
                    >
                      <Ionicons name="trash" size={20} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={[styles.toolbar, { borderTopColor: colors.border || "rgba(0,0,0,0.1)", marginTop: 20 }]}>
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
              )}

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
  imagePreview: { marginTop: spacing.xl, borderRadius: radius.md, overflow: "hidden", position: "relative" },
  previewImage: { width: "100%", height: 300 },
  overlayControls: { position: "absolute", bottom: spacing.md, right: spacing.md, flexDirection: "row", gap: spacing.sm },
  overlayBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 40, width: 40, borderRadius: 20, justifyContent: "center" },
  toolbar: { flexDirection: "row", alignItems: "center", paddingTop: spacing.md, marginTop: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth },
  toolbarButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "rgba(0,0,0,0.03)", borderRadius: radius.pill },
  toolbarText: { fontSize: font.sm, fontWeight: "600" },
});
