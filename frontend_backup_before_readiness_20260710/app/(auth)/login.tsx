import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Button from "@/src/components/Button";
import Header from "@/src/components/Header";
import { api } from "@/src/lib/api";

export default function Login() {
  const { colors } = useTheme();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Validate phone number (10 digits)
  const validatePhone = (value: string): boolean => {
    const cleaned = value.replace(/\D/g, "");
    return cleaned.length === 10;
  };

  const handlePhoneChange = (value: string) => {
    // Only allow digits, max 10
    const cleaned = value.replace(/\D/g, "").slice(0, 10);
    setPhone(cleaned);
    setError("");
  };

  const sendOtp = async () => {
    if (!validatePhone(phone) || submitting) return;
    
    setSubmitting(true);
    setError("");
    
    // Backend will handle adding +91
    const fullPhone = `+91${phone}`;
    
    try {
      const otp = await api.auth.startOtp(fullPhone, 'login');
      router.push({
        pathname: "/(auth)/otp",
        params: {
          phone: fullPhone,
          challengeId: otp.challengeId || "",
          from: "login",
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send OTP. Please try again.");
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
          <Text style={[styles.h1, { color: colors.onSurface }]}>Welcome back</Text>
          <Text style={[styles.h2, { color: colors.onSurfaceTertiary }]}>
            Log in to your campus network. We&apos;ll send you a code.
          </Text>

          <View style={{ marginTop: spacing["2xl"] }}>
            <Text style={[styles.label, { color: colors.onSurfaceTertiary }]}>Phone number</Text>
            <View style={[styles.phoneRow, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary }]}>
              <View style={styles.cc}>
                <Text style={{ color: colors.muted, fontSize: font.lg, fontWeight: "500" }}>+91</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <TextInput
                testID="phone-input"
                value={phone}
                onChangeText={handlePhoneChange}
                placeholder="10-digit mobile number"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                style={{ flex: 1, color: colors.onSurface, fontSize: font.lg, paddingHorizontal: spacing.md }}
                maxLength={10}
                autoFocus
              />
            </View>
            {phone.length > 0 && phone.length < 10 && (
              <Text style={{ color: colors.error, fontSize: font.sm, marginTop: spacing.xs }}>
                Phone number must be 10 digits
              </Text>
            )}
          </View>

          <View style={{ marginTop: spacing["2xl"] }}>
            <Button
              label="Send OTP"
              fullWidth
              size="lg"
              disabled={!validatePhone(phone) || submitting}
              onPress={sendOtp}
              testID="send-otp-btn"
            />
          </View>
          {!!error && (
            <Text style={{ color: colors.error, fontSize: font.sm, marginTop: spacing.sm }}>
              {error}
            </Text>
          )}

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
});
