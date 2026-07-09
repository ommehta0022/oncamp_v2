import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView, Pressable, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Button from "@/src/components/Button";
import { api } from "@/src/lib/api";
import { useRole } from "@/src/context/RoleProvider";
import { showImagePicker, uploadAvatar } from "@/src/lib/imageUpload";

export default function ProfileSetup() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, refreshUser } = useRole();
  const [name, setName] = useState(user?.name || "");
  const [institution, setInstitution] = useState(user?.course || "");
  const [city, setCity] = useState(user?.city || "");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarPick = async () => {
    const uri = await showImagePicker({ aspect: [1, 1], quality: 0.8 });
    if (uri) setAvatarUri(uri);
  };

  const finish = async (skip = false) => {
    if (saving) return;
    setSaving(true);
    try {
      let avatarUrl = null;
      
      // Upload avatar if selected
      if (avatarUri && !skip) {
        setUploadingAvatar(true);
        try {
          const result = await uploadAvatar(avatarUri);
          avatarUrl = result.url;
        } catch (error) {
          console.error("Avatar upload failed:", error);
          Alert.alert("Upload Failed", "Could not upload profile picture. Continue anyway?", [
            { text: "Retry", onPress: () => { setSaving(false); setUploadingAvatar(false); } },
            { text: "Continue", onPress: async () => { setUploadingAvatar(false); await completeSetup(null, skip); } },
          ]);
          setSaving(false);
          setUploadingAvatar(false);
          return;
        } finally {
          setUploadingAvatar(false);
        }
      }
      
      await completeSetup(avatarUrl, skip);
    } catch (error) {
      console.error("Profile setup failed:", error);
      Alert.alert("Error", "Failed to save profile. Please try again.");
      setSaving(false);
    }
  };

  const completeSetup = async (avatarUrl: string | null, skip: boolean) => {
    const trimmed = {
      name: name.trim(),
      institution: institution.trim(),
      city: city.trim(),
      bio: bio.trim(),
    };
    
    await api.users.updateMe({
      name: trimmed.name || undefined,
      course: trimmed.institution || undefined,
      city: trimmed.city || undefined,
      bio: trimmed.bio || undefined,
      avatarUrl: avatarUrl || undefined,
      profileCompleted: true,
      defaultAvatarKey: user?.defaultAvatarKey || "initials",
      onboardingSkipped: skip ? {
        name: !trimmed.name,
        institution: !trimmed.institution,
        city: !trimmed.city,
        bio: !trimmed.bio,
        avatar: !avatarUri,
      } : {},
    });
    
    await refreshUser().catch(() => {});
    setSaving(false);
    router.replace("/(tabs)/feed");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} testID="profile-setup-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <Text style={[styles.h1, { color: colors.onSurface }]}>Set up your profile</Text>
          <Text style={[styles.h2, { color: colors.onSurfaceTertiary }]}>
            Help your classmates recognize you across campus.
          </Text>

          {/* Avatar Picker */}
          <TouchableOpacity onPress={handleAvatarPick} style={styles.avatarContainer} activeOpacity={0.7}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceVariant }]}>
                <Ionicons name="person" size={40} color={colors.onSurfaceTertiary} />
              </View>
            )}
            <View style={[styles.cameraIcon, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>

          <Field label="Display name" value={name} onChange={setName} placeholder="Your full name" />
          <Field label="Institution" value={institution} onChange={setInstitution} placeholder="Your institution" icon="school-outline" />
          <Field label="City" value={city} onChange={setCity} placeholder="Your city" icon="location-outline" />
          <Field label="Bio" value={bio} onChange={setBio} placeholder="A short bio: batch, interests, clubs" multiline />

          <View style={{ marginTop: spacing["2xl"] }}>
            <Button
              label="Finish"
              fullWidth
              size="lg"
              disabled={saving || !name.trim() || !city.trim()}
              onPress={() => finish(false)}
              testID="finish-setup-btn"
            />
            <Pressable
              onPress={() => finish(true)}
              style={{ marginTop: spacing.md, alignItems: "center" }}
            >
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base }}>Skip for now</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label, value, onChange, placeholder, icon, multiline,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
  icon?: keyof typeof Ionicons.glyphMap; multiline?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginBottom: spacing.sm }}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          {
            borderColor: colors.borderStrong,
            backgroundColor: colors.surfaceSecondary,
            minHeight: multiline ? 90 : 52,
            alignItems: multiline ? "flex-start" : "center",
            paddingVertical: multiline ? spacing.md : 0,
          },
        ]}
      >
        {icon && <Ionicons name={icon} size={18} color={colors.onSurfaceTertiary} style={{ marginTop: multiline ? 2 : 0 }} />}
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          multiline={multiline}
          style={{
            flex: 1, color: colors.onSurface, fontSize: font.lg,
            marginLeft: icon ? spacing.sm : 0,
            textAlignVertical: multiline ? "top" : "center",
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, paddingBottom: spacing["3xl"] },
  h1: { fontSize: 26, fontWeight: "500", letterSpacing: -0.5, marginTop: spacing.lg },
  h2: { fontSize: font.base, marginTop: spacing.sm, lineHeight: 20 },
  inputRow: {
    flexDirection: "row", borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  avatarContainer: {
    alignSelf: "center",
    marginVertical: spacing.xl,
    marginTop: spacing["2xl"],
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
  },
});
