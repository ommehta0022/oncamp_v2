import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Pressable, ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Button from "@/src/components/Button";
import Header from "@/src/components/Header";
import { api, saveSession } from "@/src/lib/api";
import { useRole } from "@/src/context/RoleProvider";
import { confirmFirebasePhoneCode, startFirebasePhoneAuth } from "@/src/lib/firebasePhoneAuth";

export default function Otp() {
  const { colors } = useTheme();
  const { refreshUser } = useRole();
  const router = useRouter();
  const { phone, challengeId } = useLocalSearchParams<{ phone: string; challengeId: string }>();
  const { width } = useWindowDimensions();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [seconds, setSeconds] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const inputs = useRef<(TextInput | null)[]>([]);
  const currentChallengeId = useRef<string>(challengeId ?? "");

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
      if (!currentChallengeId.current) {
        throw new Error("Session expired. Please go back and retry.");
      }
      // Step 1: Confirm OTP with Firebase → get Firebase ID token
      const firebaseIdToken = await confirmFirebasePhoneCode(code);
      // Step 2: Verify with NestJS backend using challengeId + Firebase token
      const session = await api.auth.verifyOtp(currentChallengeId.current, firebaseIdToken);
      await saveSession(session.accessToken, session.refreshToken);
      // Build user cache — NestJS returns userId + optional user fields
      const userCache = session.user ?? { id: session.userId };
      await AsyncStorage.setItem("oncampus.user", JSON.stringify(userCache));
      await AsyncStorage.setItem("oncampus.authed", "true");
      await refreshUser();
      // isNewUser → profile setup, else → home feed
      if (session.isNewUser) {
        router.replace("/(auth)/profile-setup");
      } else {
        router.replace("/(tabs)/feed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify OTP.");
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (!phone || seconds > 0) return;
    setError("");
    try {
      const response = await api.auth.startOtp(phone);
      currentChallengeId.current = response.challengeId;
      await startFirebasePhoneAuth(phone);
      setSeconds(30);
      setDigits(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend OTP.");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} testID="otp-screen">
      <Header title="" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          {Platform.OS === "web" && <View nativeID="firebase-recaptcha" style={styles.recaptcha} />}
          <Text style={[styles.h1, { color: colors.onSurface }]}>Verify your number</Text>
          <Text style={[styles.h2, { color: colors.onSurfaceTertiary }]}>
            Enter the 6-digit code sent to {phone || "+91 98765 43210"}
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
                Resend code in <Text style={{ color: colors.onSurface, fontWeight: "500" }}>{seconds}s</Text>
              </Text>
            ) : (
              <Pressable onPress={resend}>
                <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "500" }}>Resend code</Text>
              </Pressable>
            )}
          </View>

          <View style={{ marginTop: spacing["2xl"] }}>
            <Button label="Verify & Continue" fullWidth size="lg" disabled={!filled || submitting} onPress={verify} testID="verify-otp-btn" />
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
