import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Pressable, ScrollView, Animated } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Button from "@/src/components/Button";
import { typography } from "@/src/theme/typography";
import { api } from "@/src/lib/api";
import { startFirebasePhoneAuth } from "@/src/lib/firebasePhoneAuth";

export default function Login() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isFocused, setIsFocused] = useState(false);

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
      try {
        await startFirebasePhoneAuth(fullPhone);
        router.push({
          pathname: "/(auth)/otp",
          params: { phone: fullPhone, provider: "firebase", from: "login" },
        });
      } catch (fbError) {
        console.warn("Firebase auth failed, falling back to dev mode:", fbError);
        const otp = await api.auth.startOtp(fullPhone);
        router.push({
          pathname: "/(auth)/otp",
          params: { phone: fullPhone, provider: "dev", from: "login", challengeId: otp?.challengeId || "" },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send OTP. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background || colors.surface }]} testID="login-screen">
      {/* Absolute positioned header for back button */}
      <View style={[styles.header, { top: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary || colors.onSurface} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 80 }]} 
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.cardContainer}>
            <View style={[styles.iconWrap, { backgroundColor: colors.highlight || colors.brandTertiary }]}>
              <Ionicons name="school" size={28} color={colors.brandPrimary} />
            </View>
            
            <Text style={[styles.h1, { color: colors.textPrimary || colors.onSurface }]}>Welcome back</Text>
            <Text style={[styles.h2, { color: colors.textSecondary || colors.onSurfaceTertiary }]}>
              Enter your mobile number to securely log in to your account.
            </Text>

            <View style={{ marginTop: spacing["3xl"] }}>
              <Text style={[styles.label, { color: colors.textPrimary || colors.onSurface }]}>Mobile Number</Text>
              
              <View 
                style={[
                  styles.phoneRow, 
                  { 
                    backgroundColor: colors.inputBg || colors.surfaceSecondary,
                    borderColor: isFocused ? (colors.inputFocus || colors.brandPrimary) : (colors.inputBorder || colors.borderStrong),
                  }
                ]}
              >
                <View style={styles.cc}>
                  <Text style={{ fontSize: 20, marginRight: 6 }}>🇮🇳</Text>
                  <Text style={{ color: colors.textSecondary || colors.muted, fontSize: font.lg, fontWeight: "600" }}>+91</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <TextInput
                  testID="phone-input"
                  value={phone}
                  onChangeText={handlePhoneChange}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="00000 00000"
                  placeholderTextColor={colors.placeholder || colors.muted}
                  keyboardType="phone-pad"
                  style={{ flex: 1, color: colors.textPrimary || colors.onSurface, fontSize: font.lg, paddingHorizontal: spacing.sm, fontWeight: "500", height: "100%" }}
                  maxLength={10}
                  autoFocus
                />
              </View>
              
              {!!error && (
                <Text style={{ color: colors.danger || colors.error, fontSize: font.sm, marginTop: spacing.sm, fontWeight: "500" }}>
                  {error}
                </Text>
              )}
            </View>

            <View style={{ marginTop: spacing["2xl"] }}>
              <Button
                label="Continue"
                fullWidth
                size="lg"
                disabled={!validatePhone(phone) || submitting}
                loading={submitting}
                onPress={sendOtp}
                testID="send-otp-btn"
              />
            </View>

            <View style={styles.termsContainer}>
              <Text style={[styles.termsText, { color: colors.textSecondary || colors.muted }]}>
                By continuing, you agree to our{" "}
              </Text>
              <Pressable onPress={() => {}}>
                <Text style={[styles.termsLink, { color: colors.brandPrimary }]}>Terms of Service</Text>
              </Pressable>
              <Text style={[styles.termsText, { color: colors.textSecondary || colors.muted }]}>
                {" "}and{" "}
              </Text>
              <Pressable onPress={() => {}}>
                <Text style={[styles.termsLink, { color: colors.brandPrimary }]}>Privacy Policy</Text>
              </Pressable>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: "absolute",
    left: spacing.lg,
    zIndex: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  wrap: { 
    padding: spacing.xl, 
    flexGrow: 1, 
    justifyContent: "center",
    paddingBottom: spacing["3xl"]
  },
  cardContainer: {
    width: "100%",
  },
  iconWrap: { 
    width: 56, 
    height: 56, 
    borderRadius: 16, 
    alignItems: "center", 
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  h1: { 
    ...typography.h1,
    marginBottom: spacing.xs,
  },
  h2: { 
    ...typography.body,
  },
  label: { 
    fontSize: font.sm, 
    fontWeight: "600",
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  phoneRow: {
    flexDirection: "row", 
    alignItems: "center", 
    height: 56,
    borderRadius: radius.md, 
    borderWidth: 1.5, 
    paddingHorizontal: spacing.md,
  },
  cc: { 
    flexDirection: "row", 
    alignItems: "center", 
  },
  divider: { 
    width: 1, 
    height: 24, 
    marginHorizontal: spacing.md 
  },
  termsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: spacing["2xl"],
    paddingHorizontal: spacing.xl,
  },
  termsText: {
    fontSize: 12,
    textAlign: "center",
  },
  termsLink: {
    fontSize: 12,
    fontWeight: "600",
  }
});
