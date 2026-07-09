import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Pressable, ScrollView, useWindowDimensions, Animated } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Button from "@/src/components/Button";
import { typography } from "@/src/theme/typography";
import { AccountRole, api, saveSession } from "@/src/lib/api";
import { confirmFirebasePhoneCode, startFirebasePhoneAuth } from "@/src/lib/firebasePhoneAuth";

export default function Otp() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Get params
  const params = useLocalSearchParams();
  const phone = Array.isArray(params.phone) ? params.phone[0] : (params.phone as string) ?? "";
  const from = Array.isArray(params.from) ? params.from[0] : (params.from as string) ?? "login";
  const provider = Array.isArray(params.provider) ? params.provider[0] : (params.provider as string) ?? "dev";
  
  const { width } = useWindowDimensions();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [seconds, setSeconds] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputs = useRef<(TextInput | null)[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const boxSize = Math.floor((width - spacing.xl * 2 - spacing.sm * 5) / 6);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
    ]).start();
  }, [shakeAnim]);

  const verify = useCallback(async (code: string) => {
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      if (!phone) {
        throw new Error("Session expired. Please go back and retry.");
      }

      let session;
      if (provider === "firebase") {
        const idToken = await confirmFirebasePhoneCode(code);
        session = await api.auth.verifyOtp(idToken);
      } else {
        session = await api.auth.verifyDevOtp(phone, code);
      }
      await saveSession(session.accessToken, session.refreshToken);
      if (session.user) {
        await AsyncStorage.setItem("oncampus.user", JSON.stringify(session.user));
        await AsyncStorage.setItem("oncampus.role", resolveRole(session.user.accountType, session.user.roles));
      }
      await AsyncStorage.setItem("oncampus.authed", "true");
      router.replace(session.isNewUser || !session.user?.profileCompleted ? "/(auth)/profile-setup" : "/(tabs)/feed");
    } catch (err) {
      triggerShake();
      setError(err instanceof Error ? err.message : "Invalid code. Please try again.");
      setDigits(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  }, [submitting, phone, provider, router, triggerShake]);

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    
    if (clean) {
      if (i < 5) {
        inputs.current[i + 1]?.focus();
      } else {
        inputs.current[i]?.blur();
        // Auto-submit when all 6 digits are filled
        const fullCode = next.join("");
        if (fullCode.length === 6) {
          verify(fullCode);
        }
      }
    }
  };

  const onKey = (i: number, e: { nativeEvent: { key: string } }) => {
    if (e.nativeEvent.key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const filled = digits.every((d) => d !== "");

  const resend = async () => {
    if (!phone || seconds > 0 || resending) return;
    
    setResending(true);
    setError("");
    
    try {
      if (provider === "firebase") {
        await startFirebasePhoneAuth(phone);
      } else {
        await api.auth.startOtp(phone);
      }
      
      setSeconds(60);
      setDigits(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend OTP.");
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background || colors.surface }]} testID="otp-screen">
      <View style={[styles.header, { top: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary || colors.onSurface} />
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 80 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View nativeID="firebase-recaptcha" style={styles.recaptcha} />

          <View style={styles.cardContainer}>
            <View style={[styles.iconWrap, { backgroundColor: colors.highlight || colors.brandTertiary }]}>
              <Ionicons name="chatbubble-ellipses" size={28} color={colors.brandPrimary} />
            </View>

            <Text style={[styles.h1, { color: colors.textPrimary || colors.onSurface }]}>Check your phone</Text>
            <Text style={[styles.h2, { color: colors.textSecondary || colors.onSurfaceTertiary }]}>
              We've sent a 6-digit verification code to{"\n"}
              <Text style={{ fontWeight: "600", color: colors.textPrimary || colors.onSurface }}>{phone || "+91 XXXXX XXXXX"}</Text>
            </Text>

            <Animated.View style={[styles.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
              {digits.map((d, i) => {
                const isActive = focusedIndex === i || (d !== "" && focusedIndex > i);
                return (
                  <TextInput
                    key={i}
                    ref={(r) => { inputs.current[i] = r; }}
                    testID={`otp-digit-${i}`}
                    value={d}
                    onChangeText={(v) => setDigit(i, v)}
                    onKeyPress={(e) => onKey(i, e)}
                    onFocus={() => setFocusedIndex(i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    style={[
                      styles.otpBox,
                      {
                        width: boxSize,
                        height: boxSize + 8,
                        borderColor: isActive ? (colors.inputFocus || colors.brandPrimary) : (colors.inputBorder || colors.borderStrong),
                        backgroundColor: isActive ? (colors.surface) : (colors.inputBg || colors.surfaceSecondary),
                        color: colors.textPrimary || colors.onSurface,
                        borderWidth: isActive ? 2 : 1,
                      },
                    ]}
                  />
                );
              })}
            </Animated.View>

            {!!error && (
              <Animated.Text style={[styles.errorText, { color: colors.danger || colors.error, transform: [{ translateX: shakeAnim }] }]}>
                {error}
              </Animated.Text>
            )}

            <View style={{ marginTop: spacing.xl, alignItems: "center" }}>
              {seconds > 0 ? (
                <View style={styles.resendRow}>
                  <Text style={{ color: colors.textSecondary || colors.onSurfaceTertiary, fontSize: font.base }}>
                    Resend code in{" "}
                  </Text>
                  <Text style={{ color: colors.brandPrimary, fontWeight: "600", fontSize: font.base, width: 30 }}>
                    0:{seconds.toString().padStart(2, '0')}
                  </Text>
                </View>
              ) : (
                <Button 
                  label={resending ? "Sending..." : "Resend Code"} 
                  variant="ghost"
                  disabled={resending}
                  onPress={resend}
                  textStyle={{ color: colors.brandPrimary }}
                />
              )}
            </View>

            <View style={{ marginTop: spacing["3xl"] }}>
              <Button
                label="Verify & Continue"
                fullWidth
                size="lg"
                disabled={!filled || submitting}
                loading={submitting}
                onPress={() => verify(digits.join(""))}
                testID="verify-otp-btn"
              />
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
  otpRow: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    marginTop: spacing["2xl"], 
  },
  otpBox: { 
    borderRadius: radius.md, 
    textAlign: "center", 
    fontSize: 24, 
    fontWeight: "600",
  },
  recaptcha: { width: 1, height: 1, opacity: 0, overflow: "hidden" },
  errorText: {
    fontSize: font.sm,
    fontWeight: "500",
    marginTop: spacing.md,
    textAlign: "center",
  },
  resendRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 44, // Match button height roughly
  }
});

function resolveRole(accountType?: AccountRole, roles: AccountRole[] = []) {
  if (roles.includes("platform_admin")) return "platform_admin";
  if (roles.includes("institution_admin") || accountType === "institution_admin") return "institution_admin";
  if (roles.includes("group_owner")) return "group_owner";
  if (roles.includes("group_admin")) return "group_admin";
  if (roles.includes("moderator")) return "moderator";
  return "normal_user";
}
