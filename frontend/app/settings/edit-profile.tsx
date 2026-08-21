import React, { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/colors";
import { typography } from "@/src/theme/typography";
import Header from "@/src/components/Header";
import { api, getUserErrorMessage } from "@/src/lib/api";
import { useRole } from "@/src/context/RoleProvider";
import { showImagePicker, uploadAvatar } from "@/src/lib/imageUpload";

export default function EditProfile() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, refreshUser } = useRole();
  const [name, setName] = useState(user?.name || "");
  const [handle, setHandle] = useState(user?.handle || "");
  const [course, setCourse] = useState(user?.course || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAvatarPick = async () => {
    if (Platform.OS === "ios") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const uri = await showImagePicker({ aspect: [1, 1], quality: 0.78 });
    if (uri) setAvatarUri(uri);
  };

  const save = async () => {
    if (saving) return;
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      Alert.alert("Display name", "Enter at least 2 characters.");
      return;
    }

    const cleanHandle = handle.trim().toLowerCase();
    if (cleanHandle && !/^[a-z0-9_]{3,30}$/.test(cleanHandle)) {
      Alert.alert("Username", "Use 3–30 letters, numbers or underscores.");
      return;
    }

    setSaving(true);
    try {
      let avatarUrl = user?.avatarUrl;
      if (avatarUri) {
        const uploaded = await uploadAvatar(avatarUri);
        avatarUrl = uploaded.url;
      }

      await api.users.updateMe({
        name: cleanName,
        handle: cleanHandle || undefined,
        course: course.trim().slice(0, 80) || undefined,
        bio: bio.trim().slice(0, 160) || undefined,
        avatarUrl,
        profileCompleted: true,
      });
      await refreshUser().catch(() => {});
      if (Platform.OS === "ios") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      Alert.alert("Could not save profile", getUserErrorMessage(error, "Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const displayAvatar = avatarUri || user?.avatarUrl;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background || colors.surface }} edges={["top"]} testID="edit-profile-screen">
      <Header
        title="Edit profile"
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => void save()}
            disabled={saving || !name.trim()}
            accessibilityRole="button"
            accessibilityLabel="Save profile"
            style={{ minWidth: 52, minHeight: 44, alignItems: "flex-end", justifyContent: "center" }}
          >
            {saving ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : <Text style={{ color: name.trim() ? colors.brandPrimary : colors.muted, fontSize: 16, fontWeight: "700" }}>Save</Text>}
          </Pressable>
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 60 }}>
          <View style={{ alignItems: "center", paddingTop: spacing.xl, paddingBottom: spacing.xl }}>
            <TouchableOpacity onPress={() => void handleAvatarPick()} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Change profile photo">
              <View style={{ position: "relative" }}>
                {displayAvatar ? (
                  <Image source={{ uri: displayAvatar }} style={{ width: 104, height: 104, borderRadius: 52 }} contentFit="cover" />
                ) : (
                  <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: colors.onSurfaceTertiary, fontSize: 38, fontWeight: "700" }}>{name.charAt(0).toUpperCase() || "?"}</Text>
                  </View>
                )}
                <View style={{ position: "absolute", right: 0, bottom: 0, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.background || colors.surface }}>
                  <Ionicons name="camera" size={16} color="#fff" />
                </View>
              </View>
            </TouchableOpacity>
            <Text style={{ color: colors.onSurfaceTertiary, marginTop: 10, fontSize: 13 }}>Profile photo</Text>
          </View>

          <View style={{ paddingHorizontal: spacing.xl }}>
            <Field label="Display name" value={name} onChange={setName} placeholder="Your name" required maxLength={60} />
            <Field label="Username" value={handle} onChange={(value) => setHandle(value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="username" prefix="@" maxLength={30} />
            <Field label="Course / program" value={course} onChange={setCourse} placeholder="e.g. BCA, Computer Science" maxLength={80} />
            <Field label="Bio" value={bio} onChange={setBio} placeholder="A short introduction" multiline maxLength={160} counter />
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, lineHeight: 18, marginTop: -4 }}>
              Your institution and campus membership are managed through verified campus enrollment, not this profile.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  placeholder,
  required,
  prefix,
  maxLength,
  counter,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  required?: boolean;
  prefix?: string;
  maxLength?: number;
  counter?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}{required ? <Text style={{ color: colors.error }}> *</Text> : null}
        </Text>
        {counter && maxLength ? <Text style={{ marginLeft: "auto", color: colors.muted, fontSize: 11 }}>{value.length}/{maxLength}</Text> : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: multiline ? "flex-start" : "center", minHeight: multiline ? 104 : 52, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary || colors.surface, paddingHorizontal: spacing.md }}>
        {prefix ? <Text style={{ color: colors.onSurfaceTertiary, fontSize: 16, marginRight: 4, paddingTop: multiline ? spacing.md : 0 }}>{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          multiline={multiline}
          maxLength={maxLength}
          accessibilityLabel={label}
          autoCapitalize={prefix ? "none" : "sentences"}
          style={{ flex: 1, color: colors.onSurface, paddingVertical: multiline ? spacing.md : 0, textAlignVertical: multiline ? "top" : "center", ...typography.body }}
        />
      </View>
    </View>
  );
}
