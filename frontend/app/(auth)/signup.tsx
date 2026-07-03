import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Button from "@/src/components/Button";
import Header from "@/src/components/Header";

export default function Signup() {
  const { colors } = useTheme();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const valid = name.length > 1 && phone.length >= 10;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} testID="signup-screen">
      <Header title="" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={[styles.iconWrap, { backgroundColor: colors.brandTertiary }]}>
            <Ionicons name="person-add" size={30} color={colors.onBrandTertiary} />
          </View>
          <Text style={[styles.h1, { color: colors.onSurface }]}>Create your account</Text>
          <Text style={[styles.h2, { color: colors.onSurfaceTertiary }]}>
            Join your campus and connect with classmates, clubs, and faculty.
          </Text>

          <Field label="Full name" value={name} onChange={setName} placeholder="Your name" icon="person-outline" />
          <Field label="Email (student ID email)" value={email} onChange={setEmail} placeholder="you@institution.edu" icon="mail-outline" keyboardType="email-address" />
          <Field label="Phone number" value={phone} onChange={setPhone} placeholder="Phone number" icon="call-outline" keyboardType="phone-pad" />

          <View style={{ marginTop: spacing.xl }}>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, lineHeight: 18 }}>
              By continuing you agree to our <Text style={{ color: colors.brandPrimary, fontWeight: "500" }}>Terms</Text> and{" "}
              <Text style={{ color: colors.brandPrimary, fontWeight: "500" }}>Privacy Policy</Text>. OnCampus is group-only -
              there is no private messaging.
            </Text>
          </View>

          <View style={{ marginTop: spacing.xl }}>
            <Button
              label="Continue"
              fullWidth
              size="lg"
              disabled={!valid}
              onPress={() => router.push({ pathname: "/(auth)/otp", params: { phone } })}
              testID="signup-continue-btn"
            />
          </View>

          <Pressable onPress={() => router.push("/(auth)/login")} style={{ marginTop: spacing.xl, alignItems: "center" }}>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base }}>
              Already have an account?{" "}
              <Text style={{ color: colors.brandPrimary, fontWeight: "500" }}>Log in</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label, value, onChange, placeholder, icon, keyboardType,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
  icon: keyof typeof Ionicons.glyphMap; keyboardType?: "email-address" | "phone-pad" | "default";
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginBottom: spacing.sm }}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          { borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary },
        ]}
      >
        <Ionicons name={icon} size={18} color={colors.onSurfaceTertiary} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          keyboardType={keyboardType || "default"}
          autoCapitalize={keyboardType === "email-address" ? "none" : "words"}
          style={{ flex: 1, color: colors.onSurface, fontSize: font.lg, marginLeft: spacing.sm }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, paddingBottom: spacing["3xl"] },
  iconWrap: { width: 60, height: 60, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  h1: { fontSize: 26, fontWeight: "500", marginTop: spacing.lg, letterSpacing: -0.5 },
  h2: { fontSize: font.base, marginTop: spacing.sm, lineHeight: 20 },
  inputRow: {
    flexDirection: "row", alignItems: "center", height: 52,
    borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md,
  },
});
