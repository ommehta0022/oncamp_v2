import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Pressable, ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Button from "@/src/components/Button";
import Header from "@/src/components/Header";
import { AccountRole, api, saveSession } from "@/src/lib/api";

export default function Otp() {
  const { colors } = useTheme();
  const router = useRouter();

  // Get params - challengeId may come as string or array
  const params = useLocalSearchParams();
  const phone = Array.isArray(params.phone) ? params.phone[0] : (params.phone as string) ?? "";
  const from = Array.isArray(params.from) ? params.from[0] : (params.from as string) ?? "login";
  const name = Array.isArray(params.name) ? params.name[0] : (params.name as string) ?? "";
  const email = Array.isArray(params.email) ? params.email[0] : (params.email as string) ?? "";
  
  const { width } = useWindowDimensions();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [seconds, setSeconds] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const inputs = useRef<(TextInput | null)[]>([]);

  const boxSize = Math.floor((width - spacing.xl * 2 - spacing.sm * 5) / 6);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) inputs.current[i + 1]?.focus();
  };

  const onKey = (i: number, e: { nativeEvent: { key: string } }) => {
    if (e.nativeEvent.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  const filled = digits.every((d) => d !== "");

  const verify = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    const code = digits.join("");

    try {
      if (!phone) {
        throw new Error("Session expired. Please go back and retry.");
      }

      const session = await api.auth.verifyOtpDev(phone, code);
      await saveSession(session.accessToken, session.refreshToken);
      if (session.user) {
        await AsyncStorage.setItem("oncampus.user", JSON.stringify(session.user));
        await AsyncStorage.setItem("oncampus.role", resolveRole(session.user.accountType, session.user.roles));
      }
      await AsyncStorage.setItem("oncampus.authed", "true");
      
      if (session.user?.accountType === "institution_admin") {
        router.replace("/institution/dashboard");
      } else {
        router.replace(session.isNewUser || !session.user?.profileCompleted ? "/(auth)/profile-setup" : "/(tabs)/feed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify OTP.");
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (!phone || seconds > 0 || resending) return;
    
    setResending(true);
    setError("");
    
    try {
      // Send new OTP
      await api.auth.startOtp(phone);
      
      // Reset state
      setSeconds(30);
      setDigits(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
      
      // Show success message briefly
      setError(""); // Clear any previous errors
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend OTP.");
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} testID="otp-screen">
      <Header title="" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.wrap}
          keyboardShouldPersistTaps="handled"
        >
          {/* reCAPTCHA container for Firebase web SDK */}
          <View nativeID="firebase-recaptcha" style={styles.recaptcha} />

          <Text style={[styles.h1, { color: colors.onSurface }]}>Verify your number</Text>
          <Text style={[styles.h2, { color: colors.onSurfaceTertiary }]}>
            Enter the 6-digit OTP sent to {phone || "+91 XXXXX XXXXX"}
          </Text>

          <View style={styles.otpRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(r) => { inputs.current[i] = r; }}
                testID={`otp-digit-${i}`}
                value={d}
                onChangeText={(v) => setDigit(i, v)}
                onKeyPress={(e) => onKey(i, e)}
                keyboardType="number-pad"
                maxLength={1}
                style={[
                  styles.otpBox,
                  {
                    width: boxSize,
                    height: boxSize + 4,
                    borderColor: d ? colors.brandPrimary : colors.borderStrong,
                    backgroundColor: colors.surfaceSecondary,
                    color: colors.onSurface,
                  },
                ]}
              />
            ))}
          </View>

          <View style={{ marginTop: spacing.xl, alignItems: "center" }}>
            {seconds > 0 ? (
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base }}>
                Resend OTP in{" "}
                <Text style={{ color: colors.onSurface, fontWeight: "500" }}>{seconds}s</Text>
              </Text>
            ) : (
              <Pressable onPress={resend} disabled={resending}>
                <Text style={{ color: resending ? colors.muted : colors.brandPrimary, fontSize: font.base, fontWeight: "500" }}>
                  {resending ? "Sending..." : "Resend OTP"}
                </Text>
              </Pressable>
            )}
          </View>

          <View style={{ marginTop: spacing["2xl"] }}>
            <Button
              label="Verify & Continue"
              fullWidth
              size="lg"
              disabled={!filled || submitting}
              onPress={verify}
              testID="verify-otp-btn"
            />
          </View>

          {!!error && (
            <Text style={{ color: colors.error, fontSize: font.sm, marginTop: spacing.sm, textAlign: "center" }}>
              {error}
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, flexGrow: 1 },
  h1: { fontSize: 28, fontWeight: "500", letterSpacing: -0.5 },
  h2: { fontSize: font.base, marginTop: spacing.sm, lineHeight: 20 },
  otpRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing["2xl"], gap: spacing.sm },
  otpBox: { borderWidth: 1, borderRadius: radius.md, textAlign: "center", fontSize: 22, fontWeight: "500" },
  recaptcha: { width: 1, height: 1, opacity: 0, overflow: "hidden" },
});

function resolveRole(accountType?: AccountRole, roles: AccountRole[] = []) {
  if (roles.includes("platform_admin")) return "platform_admin";
  if (roles.includes("institution_admin") || accountType === "institution_admin") return "institution_admin";
  if (roles.includes("group_owner")) return "group_owner";
  if (roles.includes("group_admin")) return "group_admin";
  if (roles.includes("moderator")) return "moderator";
  return "normal_user";
}
