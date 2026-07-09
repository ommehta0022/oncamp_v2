import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable, TouchableOpacity, ActivityIndicator, Alert, Animated } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Button from "@/src/components/Button";
import Input from "@/src/components/Input";
import { typography } from "@/src/theme/typography";
import { api } from "@/src/lib/api";
import { useRole } from "@/src/context/RoleProvider";
import { showImagePicker, uploadAvatar } from "@/src/lib/imageUpload";
import { useToast } from "@/src/components/Toast";

export default function ProfileSetup() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useRole();
  const { showToast } = useToast();
  
  const [step, setStep] = useState(1);
  const [name, setName] = useState(user?.name || "");
  const [institution, setInstitution] = useState(user?.course || "");
  const [city, setCity] = useState(user?.city || "");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleAvatarPick = async () => {
    const uri = await showImagePicker({ aspect: [1, 1], quality: 0.8 });
    if (uri) setAvatarUri(uri);
  };
  
  const animateStep = (nextStep: number) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setStep(nextStep);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
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
      showToast({ message: "Failed to save profile.", variant: "error" });
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
    showToast({ message: "Welcome to OnCampus!", variant: "success", icon: "party-horn" as any });
    router.replace("/(tabs)/feed");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background || colors.surface }]} testID="profile-setup-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        {step > 1 ? (
          <Pressable onPress={() => animateStep(step - 1)} hitSlop={10} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary || colors.onSurface} />
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
        
        <View style={styles.stepIndicator}>
          {[1, 2, 3].map((s) => (
            <View 
              key={s} 
              style={[
                styles.stepDot, 
                { 
                  backgroundColor: step >= s ? colors.brandPrimary : colors.borderStrong,
                  width: step === s ? 24 : 8 
                }
              ]} 
            />
          ))}
        </View>
        
        <Pressable onPress={() => finish(true)} hitSlop={10} style={styles.skipBtn}>
          <Text style={{ color: colors.textSecondary || colors.muted, fontWeight: "500" }}>Skip</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          
          <Animated.View style={{ opacity: fadeAnim }}>
            {step === 1 && (
              <View style={styles.stepContent}>
                <Text style={[styles.h1, { color: colors.textPrimary || colors.onSurface }]}>Let's set up your profile</Text>
                <Text style={[styles.h2, { color: colors.textSecondary || colors.onSurfaceTertiary }]}>
                  Add a photo so your classmates can recognize you.
                </Text>

                <TouchableOpacity onPress={handleAvatarPick} style={styles.avatarContainer} activeOpacity={0.7}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarImage} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: colors.highlight || colors.surfaceTertiary }]}>
                      <Ionicons name="person" size={48} color={colors.brandPrimary} />
                    </View>
                  )}
                  <View style={[styles.cameraIcon, { backgroundColor: colors.brandPrimary, borderColor: colors.surface }]}>
                    {uploadingAvatar ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="camera" size={18} color="#FFFFFF" />
                    )}
                  </View>
                </TouchableOpacity>

                <View style={{ marginTop: spacing["3xl"] }}>
                  <Button
                    label="Continue"
                    fullWidth
                    size="lg"
                    onPress={() => animateStep(2)}
                  />
                </View>
              </View>
            )}

            {step === 2 && (
              <View style={styles.stepContent}>
                <Text style={[styles.h1, { color: colors.textPrimary || colors.onSurface }]}>The Basics</Text>
                <Text style={[styles.h2, { color: colors.textSecondary || colors.onSurfaceTertiary }]}>
                  What should we call you?
                </Text>

                <View style={{ marginTop: spacing["2xl"] }}>
                  <Input 
                    label="Display Name" 
                    value={name} 
                    onChangeText={setName} 
                    placeholder="E.g. Jane Doe" 
                    leftIcon="person-outline"
                    autoFocus
                  />
                  <Input 
                    label="A Short Bio" 
                    value={bio} 
                    onChangeText={setBio} 
                    placeholder="Batch of '25, CS major, loves coffee..." 
                    multiline 
                    maxLength={150}
                  />
                </View>

                <View style={{ marginTop: spacing.xl }}>
                  <Button
                    label="Continue"
                    fullWidth
                    size="lg"
                    disabled={!name.trim()}
                    onPress={() => animateStep(3)}
                  />
                </View>
              </View>
            )}

            {step === 3 && (
              <View style={styles.stepContent}>
                <Text style={[styles.h1, { color: colors.textPrimary || colors.onSurface }]}>Your Campus</Text>
                <Text style={[styles.h2, { color: colors.textSecondary || colors.onSurfaceTertiary }]}>
                  Connect with your specific community.
                </Text>

                <View style={{ marginTop: spacing["2xl"] }}>
                  <Input 
                    label="Institution" 
                    value={institution} 
                    onChangeText={setInstitution} 
                    placeholder="E.g. National Institute of Technology" 
                    leftIcon="school-outline"
                    autoFocus
                  />
                  <Input 
                    label="City" 
                    value={city} 
                    onChangeText={setCity} 
                    placeholder="E.g. Bangalore" 
                    leftIcon="location-outline"
                  />
                </View>

                <View style={{ marginTop: spacing.xl }}>
                  <Button
                    label="Finish Setup"
                    fullWidth
                    size="lg"
                    disabled={saving || !institution.trim()}
                    loading={saving}
                    onPress={() => finish(false)}
                  />
                </View>
              </View>
            )}
          </Animated.View>
          
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  skipBtn: {
    width: 44,
    height: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stepDot: {
    height: 8,
    borderRadius: 4,
  },
  wrap: { 
    padding: spacing.xl, 
    paddingBottom: spacing["3xl"] 
  },
  stepContent: {
    paddingTop: spacing.md,
  },
  h1: { 
    ...typography.h1,
    marginBottom: spacing.xs,
  },
  h2: { 
    ...typography.body,
  },
  avatarContainer: {
    alignSelf: "center",
    marginVertical: spacing.xl,
    marginTop: spacing["3xl"],
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
  },
});
