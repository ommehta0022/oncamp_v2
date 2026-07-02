import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Button from "@/src/components/Button";
import Avatar from "@/src/components/Avatar";
import { currentUser } from "@/src/data/mock";

export default function ProfileSetup() {
  const { colors } = useTheme();
  const router = useRouter();
  const [name, setName] = useState(currentUser.name);
  const [institution, setInstitution] = useState(currentUser.institution);
  const [city, setCity] = useState(currentUser.city);
  const [bio, setBio] = useState("");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} testID="profile-setup-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <Text style={[styles.h1, { color: colors.onSurface }]}>Set up your profile</Text>
          <Text style={[styles.h2, { color: colors.onSurfaceTertiary }]}>
            Help your classmates recognize you across campus.
          </Text>

          <View style={styles.avatarWrap}>
            <Avatar uri={currentUser.avatar} name={name} size={112} />
            <Pressable
              style={[styles.editAvatar, { backgroundColor: colors.brandPrimary, borderColor: colors.surface }]}
              testID="edit-avatar-btn"
            >
              <Ionicons name="camera" size={16} color={colors.onBrandPrimary} />
            </Pressable>
          </View>

          <Field label="Display name" value={name} onChange={setName} placeholder="Your full name" />
          <Field label="Institution" value={institution} onChange={setInstitution} placeholder="e.g. IIT Bombay" icon="school-outline" />
          <Field label="City" value={city} onChange={setCity} placeholder="e.g. Mumbai" icon="location-outline" />
          <Field label="Bio" value={bio} onChange={setBio} placeholder="A short bio — batch, interests, clubs" multiline />

          <View style={{ marginTop: spacing["2xl"] }}>
            <Button
              label="Finish"
              fullWidth
              size="lg"
              disabled={!name || !institution || !city}
              onPress={() => router.replace("/(tabs)/feed")}
              testID="finish-setup-btn"
            />
            <Pressable
              onPress={() => router.replace("/(tabs)/feed")}
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
  avatarWrap: { alignSelf: "center", marginTop: spacing.xl, marginBottom: spacing.sm },
  editAvatar: {
    position: "absolute", right: -4, bottom: -4,
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center", borderWidth: 3,
  },
  inputRow: {
    flexDirection: "row", borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
});
