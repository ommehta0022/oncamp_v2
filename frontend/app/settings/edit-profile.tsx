import React, { useState } from "react";
import { View, Text, ScrollView, TextInput, KeyboardAvoidingView, Platform, Pressable, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import { api } from "@/src/lib/api";
import { useRole } from "@/src/context/RoleProvider";
import { showImagePicker, uploadAvatar } from "@/src/lib/imageUpload";

export default function EditProfile() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, refreshUser } = useRole();
  const [name, setName] = useState(user?.name || "");
  const [handle, setHandle] = useState(user?.handle || "");
  const [institution, setInstitution] = useState(user?.course || "");
  const [city, setCity] = useState(user?.city || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [saving, setSaving] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarPick = async () => {
    const uri = await showImagePicker({ aspect: [1, 1], quality: 0.8 });
    if (uri) setAvatarUri(uri);
  };

  const save = async () => {
    if (saving) return;
    
    // Validate required fields
    if (!name.trim()) {
      Alert.alert("Name Required", "Please enter your display name");
      return;
    }
    
    setSaving(true);
    try {
      let avatarUrl = user?.avatarUrl;
      
      // Upload new avatar if selected
      if (avatarUri) {
        setUploadingAvatar(true);
        try {
          const result = await uploadAvatar(avatarUri);
          avatarUrl = result.url;
        } catch (error) {
          console.error("Avatar upload failed:", error);
          Alert.alert("Upload Failed", "Could not upload profile picture. Save without changing it?", [
            { text: "Cancel", style: "cancel", onPress: () => { setSaving(false); setUploadingAvatar(false); } },
            { text: "Continue", onPress: async () => { setUploadingAvatar(false); await saveProfile(user?.avatarUrl); } },
          ]);
          setSaving(false);
          setUploadingAvatar(false);
          return;
        } finally {
          setUploadingAvatar(false);
        }
      }
      
      await saveProfile(avatarUrl);
    } catch (error) {
      console.error("Profile update failed:", error);
      Alert.alert("Error", "Failed to save profile. Please try again.");
      setSaving(false);
    }
  };

  const saveProfile = async (avatarUrl?: string) => {
    try {
      await api.users.updateMe({ 
        name: name.trim(), 
        handle: handle.trim() || undefined, 
        course: institution.trim() || undefined, 
        city: city.trim() || undefined, 
        bio: bio.trim() || undefined,
        avatarUrl: avatarUrl || user?.avatarUrl,
        profileCompleted: true 
      });
      await refreshUser().catch(() => {});
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const displayAvatar = avatarUri || user?.avatarUrl;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header
        title="Edit profile"
        onBack={() => router.back()}
        right={
          <Pressable onPress={save} disabled={saving || uploadingAvatar || !name.trim()}>
            <Text style={{ 
              color: (saving || uploadingAvatar || !name.trim()) ? colors.muted : colors.brandPrimary, 
              fontSize: font.base, 
              fontWeight: "500" 
            }}>
              {saving || uploadingAvatar ? "Saving..." : "Save"}
            </Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Profile Header with Avatar */}
          <View style={{ alignItems: "center", paddingVertical: spacing.xl, paddingHorizontal: spacing.lg }}>
            <View style={{ position: "relative", marginBottom: spacing.lg }}>
              {displayAvatar ? (
                <Image 
                  source={{ uri: displayAvatar }} 
                  style={{ width: 120, height: 120, borderRadius: 60 }} 
                  contentFit="cover" 
                />
              ) : (
                <View style={{ 
                  width: 120, 
                  height: 120, 
                  borderRadius: 60, 
                  backgroundColor: colors.surfaceVariant,
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <Text style={{ fontSize: 40, color: colors.onSurfaceTertiary, fontWeight: "500" }}>
                    {name.charAt(0).toUpperCase() || "?"}
                  </Text>
                </View>
              )}
              
              <TouchableOpacity
                onPress={handleAvatarPick}
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.brandPrimary,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 3,
                  borderColor: colors.surface,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 4,
                }}
                activeOpacity={0.7}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="camera" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>

            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, textAlign: "center" }}>
              Tap the camera icon to change your profile picture
            </Text>
          </View>

          <View style={{ paddingHorizontal: spacing.lg }}>
            <Field 
              label="Display name" 
              value={name} 
              onChange={setName} 
              placeholder="Your full name"
              required
            />
            <Field 
              label="Username" 
              value={handle} 
              onChange={(v) => setHandle(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))} 
              placeholder="username"
              showPrefix="@"
            />
            <Field 
              label="Institution" 
              value={institution} 
              onChange={setInstitution} 
              placeholder="Your college or university"
            />
            <Field 
              label="City" 
              value={city} 
              onChange={setCity} 
              placeholder="Your current city"
            />
            <Field 
              label="Bio" 
              value={bio} 
              onChange={setBio} 
              placeholder="Tell others about yourself"
              multiline 
              maxLength={160}
              counter
            />
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
  showPrefix,
  maxLength,
  counter
}: { 
  label: string; 
  value: string; 
  onChange: (v: string) => void; 
  multiline?: boolean; 
  placeholder?: string;
  required?: boolean;
  showPrefix?: string;
  maxLength?: number;
  counter?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.sm }}>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>
          {label}
          {required && <Text style={{ color: colors.error }}> *</Text>}
        </Text>
        {counter && maxLength && (
          <Text style={{ color: colors.muted, fontSize: font.xs, marginLeft: "auto" }}>
            {value.length}/{maxLength}
          </Text>
        )}
      </View>
      <View style={{ 
        flexDirection: "row", 
        alignItems: multiline ? "flex-start" : "center",
        backgroundColor: colors.surfaceSecondary,
        borderColor: colors.borderStrong,
        borderWidth: 1,
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
        minHeight: multiline ? 90 : 52,
      }}>
        {showPrefix && (
          <Text style={{ 
            color: colors.onSurfaceTertiary, 
            fontSize: font.lg, 
            marginRight: spacing.xs,
            lineHeight: 52,
          }}>
            {showPrefix}
          </Text>
        )}
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          multiline={multiline}
          maxLength={maxLength}
          style={{
            flex: 1,
            color: colors.onSurface,
            fontSize: font.lg,
            paddingVertical: multiline ? spacing.md : 0,
            textAlignVertical: multiline ? "top" : "center",
          }}
        />
      </View>
    </View>
  );
}
