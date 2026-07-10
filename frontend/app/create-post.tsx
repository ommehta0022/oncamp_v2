import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import Avatar from "@/src/components/Avatar";
import BottomSheet from "@/src/components/BottomSheet";
import EmptyState from "@/src/components/EmptyState";
import { useToast } from "@/src/components/Toast";
import { useRole } from "@/src/context/RoleProvider";
import { api, GroupDto, getUserErrorMessage } from "@/src/lib/api";
import { normalizeGroup } from "@/src/lib/mappers";
import { showImagePicker, uploadPostMedia } from "@/src/lib/imageUpload";
import { validatePostContent } from "@/src/utils/validation";

const POST_TYPES = [
  { value: "general", label: "General", icon: "chatbubble-ellipses-outline" },
  { value: "announcement", label: "Announcement", icon: "megaphone-outline" },
  { value: "event", label: "Event", icon: "calendar-outline" },
  { value: "notice", label: "Notice", icon: "information-circle-outline" },
] as const;

type MediaType = "image" | "video" | "document";

export default function CreatePost() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useRole();
  const { showToast } = useToast();
  const [text, setText] = useState("");
  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [group, setGroup] = useState<GroupDto | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupSheet, setGroupSheet] = useState(false);
  const [optionsSheet, setOptionsSheet] = useState(false);
  const [postType, setPostType] = useState<(typeof POST_TYPES)[number]["value"]>("general");
  const [visibility, setVisibility] = useState<"public" | "group">("public");
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const validation = useMemo(() => validatePostContent(text), [text]);

  const loadGroups = async () => {
    setLoadingGroups(true);
    setGroupError(null);
    try {
      const response = await api.groups.listMine();
      setGroups((Array.isArray(response) ? response : []).map(normalizeGroup));
    } catch (err) {
      setGroupError(getUserErrorMessage(err, "Could not load your groups."));
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    void loadGroups();
  }, []);

  const chooseImage = async () => {
    const uri = await showImagePicker({ aspect: [4, 3], quality: 0.85 });
    if (uri) {
      setMediaUri(uri);
      setMediaType("image");
      setError("");
    }
  };

  const chooseVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast({ message: "Photo library permission is required to attach a video.", variant: "warning" });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
      setMediaType("video");
      setError("");
    }
  };

  const chooseDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      const file = result.assets[0];
      if (file.size && file.size > 10 * 1024 * 1024) {
        showToast({ message: "Document must be 10 MB or smaller.", variant: "warning" });
        return;
      }
      setMediaUri(file.uri);
      setMediaType("document");
      setError("");
    }
  };

  const handlePost = async () => {
    if (!validation.valid || loading) {
      if (!validation.valid) setError(validation.error || "Check your post and try again.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      let mediaUrl: string | undefined;
      let uploadedMediaType = mediaType || undefined;
      if (mediaUri) {
        setUploading(true);
        const result = await uploadPostMedia(mediaUri);
        mediaUrl = result.url;
        uploadedMediaType = (result.mediaType as MediaType | undefined) || uploadedMediaType;
      }
      await api.feed.create({
        content: text.trim(),
        groupId: group?.id || undefined,
        type: postType,
        visibility: group && visibility === "group" ? "group" : "public",
        mediaUrl,
        mediaType: uploadedMediaType,
      });
      showToast({ message: "Post published", variant: "success" });
      router.back();
    } catch (err) {
      const message = getUserErrorMessage(err, "Could not publish your post.");
      setError(message);
      showToast({ message, variant: "error" });
    } finally {
      setUploading(false);
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
            disabled={!validation.valid || loading}
            style={[styles.postBtn, { backgroundColor: validation.valid ? colors.brandPrimary : colors.borderStrong, opacity: loading ? 0.7 : 1 }]}
          >
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontSize: font.sm, fontWeight: "500" }}>Post</Text>}
          </Pressable>
        }
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
            <Avatar uri={user?.avatarUrl} name={user?.name || "User"} size={44} verified={user?.verified} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{user?.name || "You"}</Text>
              <Pressable style={[styles.groupPicker, { backgroundColor: colors.brandTertiary }]} onPress={() => setGroupSheet(true)}>
                <Ionicons name="people" size={12} color={colors.onBrandTertiary} />
                <Text style={{ color: colors.onBrandTertiary, fontSize: font.sm, fontWeight: "500" }}>Post to {group?.name || "Campus"}</Text>
                <Ionicons name="chevron-down" size={12} color={colors.onBrandTertiary} />
              </Pressable>
            </View>
          </View>

          <TextInput
            value={text}
            onChangeText={(value) => { setText(value); setError(""); }}
            placeholder="What's on your mind, campus?"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={5000}
            accessibilityLabel="Post content"
            style={{ color: colors.onSurface, fontSize: font.lg, marginTop: spacing.xl, minHeight: 200, lineHeight: 24, textAlignVertical: "top" }}
            autoFocus
          />

          {mediaUri && (
            <View style={{ marginTop: spacing.md }}>
              {mediaType === "image" ? (
                <Image source={{ uri: mediaUri }} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: radius.md }} contentFit="cover" />
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }}>
                  <Ionicons name={mediaType === "video" ? "videocam" : "document-text"} size={22} color={colors.brandPrimary} />
                  <Text style={{ flex: 1, color: colors.onSurface }} numberOfLines={1}>{mediaType === "video" ? "Video attached" : "Document attached"}</Text>
                </View>
              )}
              <Pressable onPress={() => { setMediaUri(null); setMediaType(null); }} style={{ marginTop: spacing.sm, alignSelf: "flex-end" }}>
                <Text style={{ color: colors.error, fontSize: font.sm }}>Remove attachment</Text>
              </Pressable>
            </View>
          )}

          <Text style={{ color: error ? colors.error : colors.muted, fontSize: font.sm, marginTop: spacing.sm, textAlign: "right" }}>
            {error || `${text.length}/5000`}
          </Text>
          {uploading && <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: spacing.sm }}>Uploading attachment...</Text>}
        </ScrollView>

        <View style={[styles.toolbar, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
          <ToolButton icon="image-outline" label="Photo" onPress={chooseImage} disabled={loading} />
          <ToolButton icon="videocam-outline" label="Video" onPress={chooseVideo} disabled={loading} />
          <ToolButton icon="document-outline" label="Document" onPress={chooseDocument} disabled={loading} />
          <ToolButton icon="options-outline" label="Post options" onPress={() => setOptionsSheet(true)} disabled={loading} />
        </View>
      </KeyboardAvoidingView>

      <BottomSheet visible={groupSheet} onClose={() => setGroupSheet(false)} snapPoints={["65%"]} header={<Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "600" }}>Choose audience</Text>}>
        <ScrollView>
          <OptionRow icon="globe-outline" label="Campus" selected={!group} onPress={() => { setGroup(null); setVisibility("public"); setGroupSheet(false); }} />
          {loadingGroups ? <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} /> : groupError ? (
            <EmptyState icon="cloud-offline-outline" title="Could not load groups" message={groupError} actionLabel="Try again" onAction={loadGroups} />
          ) : groups.map((item) => (
            <OptionRow key={item.id} icon="people-outline" label={item.name} selected={group?.id === item.id} onPress={() => { setGroup(item); setVisibility("group"); setGroupSheet(false); }} />
          ))}
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={optionsSheet} onClose={() => setOptionsSheet(false)} snapPoints={["60%"]} header={<Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "600" }}>Post options</Text>}>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginBottom: spacing.sm }}>Post type</Text>
        {POST_TYPES.map((option) => (
          <OptionRow key={option.value} icon={option.icon} label={option.label} selected={postType === option.value} onPress={() => setPostType(option.value)} />
        ))}
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: spacing.lg, marginBottom: spacing.sm }}>Visibility</Text>
        <OptionRow icon="globe-outline" label="Public campus feed" selected={visibility === "public"} onPress={() => setVisibility("public")} />
        {group && <OptionRow icon="people-outline" label={`${group.name} only`} selected={visibility === "group"} onPress={() => setVisibility("group")} />}
      </BottomSheet>
    </SafeAreaView>
  );
}

function ToolButton({ icon, label, onPress, disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable style={[styles.toolBtn, { opacity: disabled ? 0.45 : 1 }]} onPress={onPress} disabled={disabled} accessibilityLabel={label}>
      <Ionicons name={icon} size={22} color={colors.brandPrimary} />
    </Pressable>
  );
}

function OptionRow({ icon, label, selected, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
      <Ionicons name={icon} size={20} color={colors.onSurfaceTertiary} />
      <Text style={{ flex: 1, color: colors.onSurface, fontSize: font.base }}>{label}</Text>
      {selected && <Ionicons name="checkmark-circle" size={20} color={colors.brandPrimary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  postBtn: { paddingHorizontal: spacing.lg, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  groupPicker: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  toolbar: { flexDirection: "row", justifyContent: "space-around", paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: Platform.OS === "ios" ? 24 : spacing.md },
  toolBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
