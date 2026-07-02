import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Button from "@/src/components/Button";
import Header from "@/src/components/Header";
import { startFirebasePhoneAuth } from "@/src/lib/firebasePhoneAuth";

export default function Login() {
  const { colors } = useTheme();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const cc = "+91";
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const sendOtp = async () => {
    if (phone.length < 10 || submitting) return;
    setSubmitting(true);
    setError("");
    const fullPhone = `${cc}${phone.replace(/\D/g, "")}`;
    try {
      await startFirebasePhoneAuth(fullPhone);
      router.push({ pathname: "/(auth)/otp", params: { phone: fullPhone } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send OTP. Check Firebase phone auth setup.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} testID="login-screen">
      <Header title="" transparent />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={[styles.iconWrap, { backgroundColor: colors.brandTertiary }]}>
            <Ionicons name="school" size={32} color={colors.onBrandTertiary} />
          </View>
          {Platform.OS === "web" && <View nativeID="firebase-recaptcha" style={styles.recaptcha} />}
          <Text style={[styles.h1, { color: colors.onSurface }]}>Welcome back</Text>
          <Text style={[styles.h2, { color: colors.onSurfaceTertiary }]}>
            Log in to your campus network. We&apos;ll send you a code.
          </Text>

          <View style={{ marginTop: spacing["2xl"] }}>
            <Text style={[styles.label, { color: colors.onSurfaceTertiary }]}>Phone number</Text>
            <View style={[styles.phoneRow, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary }]}>
              <Pressable style={styles.cc}>
                <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }}>{cc}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.onSurfaceTertiary} />
              </Pressable>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <TextInput
                testID="phone-input"
                value={phone}
                onChangeText={setPhone}
                placeholder="98765 43210"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                style={{ flex: 1, color: colors.onSurface, fontSize: font.lg, paddingHorizontal: spacing.md }}
                maxLength={12}
              />
            </View>
          </View>

          <View style={{ marginTop: spacing["2xl"] }}>
            <Button
              label="Send OTP"
              fullWidth
              size="lg"
              disabled={phone.length < 10 || submitting}
              onPress={sendOtp}
              testID="send-otp-btn"
            />
          </View>
          {!!error && (
            <Text style={{ color: colors.error, fontSize: font.sm, marginTop: spacing.sm }}>
              {error}
            </Text>
          )}

          <View style={styles.divider2}>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>OR</Text>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
          </View>

          <Button
            label="Continue with Institution SSO"
            fullWidth
            size="lg"
            variant="outline"
            leftIcon={<Ionicons name="school-outline" size={18} color={colors.onSurface} />}
          />

          <Pressable onPress={() => router.push("/(auth)/signup")} style={{ marginTop: spacing.xl, alignItems: "center" }}>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base }}>
              New here?{" "}
              <Text style={{ color: colors.brandPrimary, fontWeight: "500" }}>Create an account</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, flexGrow: 1 },
  iconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  h1: { fontSize: 28, fontWeight: "500", marginTop: spacing.xl, letterSpacing: -0.5 },
  h2: { fontSize: font.base, marginTop: spacing.sm, lineHeight: 20 },
  label: { fontSize: font.sm, marginBottom: spacing.sm },
  phoneRow: {
    flexDirection: "row", alignItems: "center", height: 56,
    borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md,
  },
  cc: { flexDirection: "row", alignItems: "center", gap: 4 },
  divider: { width: 1, height: 24, marginHorizontal: spacing.md },
  divider2: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    marginTop: spacing["2xl"], marginBottom: spacing.xl,
  },
  line: { flex: 1, height: 1 },
  recaptcha: { width: 1, height: 1, opacity: 0, overflow: "hidden" },
});
