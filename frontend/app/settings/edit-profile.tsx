import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import Avatar from "@/src/components/Avatar";
import { currentUser } from "@/src/data/mock";

export default function EditProfile() {
  const { colors } = useTheme();
  const router = useRouter();
  const [name, setName] = useState(currentUser.name);
  const [handle, setHandle] = useState(currentUser.handle);
  const [institution, setInstitution] = useState(currentUser.institution);
  const [city, setCity] = useState(currentUser.city);
  const [bio, setBio] = useState(currentUser.bio);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header
        title="Edit profile"
        onBack={() => router.back()}
        right={
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "500" }}>Save</Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
          <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
            <Avatar uri={currentUser.avatar} name={name} size={100} verified={currentUser.verified} />
            <Pressable style={{ marginTop: spacing.md, flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="camera" size={16} color={colors.brandPrimary} />
              <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "500" }}>Change photo</Text>
            </Pressable>
          </View>

          <Field label="Display name" value={name} onChange={setName} />
          <Field label="Handle" value={handle} onChange={setHandle} />
          <Field label="Institution" value={institution} onChange={setInstitution} />
          <Field label="City" value={city} onChange={setCity} />
          <Field label="Bio" value={bio} onChange={setBio} multiline />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginBottom: spacing.sm }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        style={{
          backgroundColor: colors.surfaceSecondary,
          borderColor: colors.borderStrong,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: spacing.md,
          color: colors.onSurface,
          fontSize: font.lg,
          minHeight: multiline ? 90 : 52,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}
