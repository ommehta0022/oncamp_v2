import React, { useState } from "react";
import { View, Text, ScrollView, TextInput, KeyboardAvoidingView, Platform, Pressable, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import { api } from "@/src/lib/api";
import { useRole } from "@/src/context/RoleProvider";
import { showImagePicker, uploadAvatar } from "@/src/lib/imageUpload";
import { typography } from "@/src/theme/typography";
import { LinearGradient } from "expo-linear-gradient";

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
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  const handleAvatarPick = async () => {
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const uri = await showImagePicker({ aspect: [1, 1], quality: 0.8 });
    if (uri) setAvatarUri(uri);
  };

  const handleCoverPick = async () => {
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const uri = await showImagePicker({ aspect: [3, 1], quality: 0.8 });
    if (uri) setCoverUri(uri);
  };

  const save = async () => {
    if (saving) return;
    
    if (!name.trim()) {
      Alert.alert("Name Required", "Please enter your display name");
      return;
    }
    
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    try {
      let avatarUrl = user?.avatarUrl;
      let coverUrl = user?.coverUrl;
      
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

      if (coverUri) {
        setUploadingCover(true);
        try {
          const result = await uploadAvatar(coverUri);
          coverUrl = result.url;
        } catch (error) {
          console.error("Cover upload failed:", error);
          setSaving(false);
          setUploadingCover(false);
          return;
        } finally {
          setUploadingCover(false);
        }
      }
      
      await saveProfile(avatarUrl, coverUrl);
    } catch (error) {
      console.error("Profile update failed:", error);
      Alert.alert("Error", "Failed to save profile. Please try again.");
      setSaving(false);
    }
  };

  const saveProfile = async (avatarUrl?: string, coverUrl?: string) => {
    try {
      await api.users.updateMe({ 
        name: name.trim(), 
        handle: handle.trim() || undefined, 
        course: institution.trim() || undefined, 
        city: city.trim() || undefined, 
        bio: bio.trim() || undefined,
        avatarUrl: avatarUrl || user?.avatarUrl,
        coverUrl: coverUrl || user?.coverUrl,
        profileCompleted: true 
      });
      await refreshUser().catch(() => {});
      if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const displayAvatar = avatarUri || user?.avatarUrl;
  const displayCover = coverUri || (user as any)?.coverUrl;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background || colors.surface }} edges={["top"]}>
      <Header
        title="Edit Profile"
        onBack={() => router.back()}
        right={
          <Pressable onPress={save} disabled={saving || uploadingAvatar || uploadingCover || !name.trim()} style={({pressed}) => [{opacity: pressed ? 0.5 : 1}]}>
            {saving || uploadingAvatar || uploadingCover ? (
              <ActivityIndicator size="small" color={colors.brandPrimary} />
            ) : (
              <Text style={{ 
                color: (!name.trim()) ? colors.textSecondary || colors.muted : colors.brandPrimary, 
                fontSize: 16, 
                fontWeight: "600",
                letterSpacing: 0.2
              }}>
                Save
              </Text>
            )}
          </Pressable>
        }
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          
          <View style={{ marginBottom: spacing.xl }}>
              <TouchableOpacity activeOpacity={0.9} onPress={handleCoverPick} style={{ position: "relative" }}>
                {displayCover ? (
                  <Image source={{ uri: displayCover }} style={{ width: "100%", height: 120 }} contentFit="cover" />
                ) : (
                  <View style={{ width: "100%", height: 120, backgroundColor: colors.brandPrimary || "#2E5C4E" }} />
                )}
                <LinearGradient colors={["transparent", "rgba(0,0,0,0.5)"]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none" />
                <View style={{ position: "absolute", bottom: 12, right: 12, backgroundColor: "rgba(0,0,0,0.6)", padding: 8, borderRadius: 20 }}>
                  <Ionicons name="camera" size={20} color="#FFF" />
                </View>
              </TouchableOpacity>

            <View style={{ alignItems: "center", marginTop: -55 }} pointerEvents="box-none">
              <View style={{ position: "relative" }}>
              {displayAvatar ? (
                <Image 
                  source={{ uri: displayAvatar }} 
                  style={{ width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: colors.surfaceSecondary || colors.border }} 
                  contentFit="cover" 
                />
              ) : (
                <View style={{ 
                  width: 110, 
                  height: 110, 
                  borderRadius: 55, 
                  backgroundColor: colors.surfaceTertiary,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 3,
                  borderColor: colors.surfaceSecondary || colors.border
                }}>
                  <Text style={{ fontSize: 40, color: colors.textSecondary || colors.onSurfaceTertiary, fontWeight: "600" }}>
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
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 3,
                  borderColor: colors.background || colors.surface,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 4,
                  elevation: 4,
                }}
                activeOpacity={0.7}
                disabled={uploadingAvatar}
              >
                <LinearGradient
                  colors={[colors.brandPrimary || "#2E5C4E", colors.brandSecondary || "#1a362d"]}
                  style={{ width: "100%", height: "100%", borderRadius: 18, alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name="camera" size={16} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
            </View>
          </View>

          <View style={{ paddingHorizontal: spacing.lg, alignItems: "center", marginBottom: spacing.lg }}>
            <Text style={{ color: colors.textSecondary || colors.onSurfaceTertiary, fontSize: 13, fontWeight: "500" }}>
              Change Profile & Cover Photos
            </Text>
          </View>

          <View style={{ paddingHorizontal: spacing.xl }}>
            <Field 
              label="Display Name" 
              value={name} 
              onChange={setName} 
              placeholder="e.g. Jane Doe"
              required
            />
            <Field 
              label="Username" 
              value={handle} 
              onChange={(v) => setHandle(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))} 
              placeholder="jane_doe"
              showPrefix="@"
            />
            <Field 
              label="Institution" 
              value={institution} 
              onChange={setInstitution} 
              placeholder="e.g. Stanford University"
            />
            <Field 
              label="City" 
              value={city} 
              onChange={setCity} 
              placeholder="e.g. San Francisco, CA"
            />
            <Field 
              label="Bio" 
              value={bio} 
              onChange={setBio} 
              placeholder="Tell us a little bit about yourself"
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
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
        <Text style={{ color: colors.textSecondary || colors.onSurfaceTertiary, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
          {required && <Text style={{ color: colors.error || "#ef4444" }}> *</Text>}
        </Text>
        {counter && maxLength && (
          <Text style={{ color: colors.textSecondary || colors.muted, fontSize: 11, marginLeft: "auto", fontWeight: "600" }}>
            {value.length}/{maxLength}
          </Text>
        )}
      </View>
      <View style={{ 
        flexDirection: "row", 
        alignItems: multiline ? "flex-start" : "center",
        backgroundColor: colors.surfaceSecondary || colors.surface,
        borderColor: colors.border || colors.borderStrong,
        borderWidth: 1,
        borderRadius: radius.lg,
        paddingHorizontal: spacing.md,
        minHeight: multiline ? 100 : 52,
      }}>
        {showPrefix && (
          <Text style={{ 
            color: colors.textSecondary || colors.onSurfaceTertiary, 
            fontSize: 16, 
            marginRight: 4,
            fontWeight: "500",
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
            color: colors.textPrimary || colors.onSurface,
            paddingVertical: multiline ? spacing.md : 0,
            textAlignVertical: multiline ? "top" : "center",
            ...typography.body
          }}
        />
      </View>
    </View>
  );
}
