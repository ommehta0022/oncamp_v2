import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Button from "@/src/components/Button";
import Header from "@/src/components/Header";

export default function Otp() {
  const { colors } = useTheme();
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [seconds, setSeconds] = useState(30);
  const inputs = useRef<Array<TextInput | null>>([]);

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
    await AsyncStorage.setItem("oncampus.authed", "true");
    router.replace("/(auth)/profile-setup");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} testID="otp-screen">
      <Header title="" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <Text style={[styles.h1, { color: colors.onSurface }]}>Verify your number</Text>
          <Text style={[styles.h2, { color: colors.onSurfaceTertiary }]}>
            Enter the 6-digit code sent to {phone || "+91 98765 43210"}
          </Text>

          <View style={styles.otpRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(r) => {
                  inputs.current[i] = r;
                }}
                testID={`otp-digit-${i}`}
                value={d}
                onChangeText={(v) => setDigit(i, v)}
                onKeyPress={(e) => onKey(i, e)}
                keyboardType="number-pad"
                maxLength={1}
                style={[
                  styles.otpBox,
                  {
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
              <Pressable onPress={() => setSeconds(30)}>
                <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "500" }}>Resend code</Text>
              </Pressable>
            )}
          </View>

          <View style={{ marginTop: spacing["2xl"] }}>
            <Button label="Verify & Continue" fullWidth size="lg" disabled={!filled} onPress={verify} testID="verify-otp-btn" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, flexGrow: 1 },
  h1: { fontSize: 28, fontWeight: "500", letterSpacing: -0.5 },
  h2: { fontSize: font.base, marginTop: spacing.sm, lineHeight: 20 },
  otpRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing["2xl"], gap: spacing.sm },
  otpBox: {
    flex: 1, height: 56, borderWidth: 1, borderRadius: radius.md,
    textAlign: "center", fontSize: 22, fontWeight: "500",
  },
});
