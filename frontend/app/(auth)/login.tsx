import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius } from "@/src/theme/colors";
import Button from "@/src/components/Button";
import { api, getUserErrorMessage } from "@/src/lib/api";
import { digitsOnly, validateIndianPhone } from "@/src/utils/validation";

const APP_ICON = require("../../assets/images/icon.png");

export default function Login() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loginType, setLoginType] = useState<"student" | "institution">("student");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const phoneValidation = validateIndianPhone(phone);

  const handlePhoneChange = (value: string) => {
    setPhone(digitsOnly(value, 10));
    setError("");
  };

  const sendOtp = async () => {
    const validation = validateIndianPhone(phone);
    if (!validation.valid || submitting) {
      setError(validation.error || "Enter a valid phone number");
      return;
    }
    setSubmitting(true);
    setError("");
    const fullPhone = `+91${phone}`;
    try {
      const otp = loginType === "institution"
        ? await api.auth.startInstitutionOtp(fullPhone)
        : await api.auth.startOtp(fullPhone, "login");
      router.push({
        pathname: "/(auth)/otp",
        params: {
          phone: fullPhone,
          challengeId: otp.challengeId || "",
          from: loginType === "institution" ? "login_institution" : "login",
        },
      });
    } catch (err) {
      setError(getUserErrorMessage(err, "Could not send OTP. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]} testID="login-screen">
      <StatusBar style={isDark ? "light" : "dark"} translucent backgroundColor="transparent" />
      <LinearGradient
        colors={isDark ? ["#080809", "#100E0B", "#080809"] : ["#FFFDF9", "#F5F0E7", "#FAF9F6"]}
        locations={[0, 0.52, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.glow, { backgroundColor: colors.luxuryGoldSoft }]} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom, 20) + 18 }]}
        >
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.backButton, { backgroundColor: colors.glassStrong, borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Go back">
              <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
            </Pressable>
            <Text style={[styles.brandWord, { color: colors.onSurface }]}>OnCampus</Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <View style={styles.heroArea}>
            <View style={[styles.logoFrame, { backgroundColor: colors.glassStrong, borderColor: colors.border }]}>
              <Image source={APP_ICON} style={{ width: "100%", height: "100%", borderRadius: 20 }} contentFit="cover" />
            </View>
            <Text style={[styles.h1, { color: colors.onSurface }]}>Welcome back</Text>
            <Text style={[styles.h2, { color: colors.onSurfaceTertiary }]}>
              {loginType === "student" ? "Enter your mobile number to continue to your campus." : "Sign in to manage your institution workspace."}
            </Text>
          </View>

          <View style={[styles.modeSwitch, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}>
            {(["student", "institution"] as const).map((type) => {
              const active = loginType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => { setLoginType(type); setError(""); }}
                  style={[styles.modeButton, active && { backgroundColor: colors.surfaceSecondary, shadowColor: colors.shadow }]}
                >
                  <Text style={[styles.modeText, { color: active ? colors.onSurface : colors.onSurfaceTertiary }]}>{type === "student" ? "Student" : "Institution"}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.onSurface }]}>Mobile number</Text>
            <View style={[styles.phoneRow, { borderColor: phone.length > 0 && !phoneValidation.valid ? colors.error : colors.inputBorder, backgroundColor: colors.inputBg }]}>
              <Text style={[styles.countryCode, { color: colors.onSurface }]}>+91</Text>
              <View style={[styles.divider, { backgroundColor: colors.divider }]} />
              <TextInput
                testID="phone-input"
                value={phone}
                onChangeText={handlePhoneChange}
                placeholder="10-digit mobile number"
                placeholderTextColor={colors.placeholder}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                accessibilityLabel="Phone number"
                style={[styles.phoneInput, { color: colors.onSurface }]}
                maxLength={10}
                autoFocus
              />
            </View>
            {phone.length > 0 && !phoneValidation.valid ? <Text style={[styles.validation, { color: colors.error }]}>{phoneValidation.error}</Text> : null}

            <View style={styles.ctaWrap}>
              <Button label="Continue" fullWidth size="lg" disabled={!phoneValidation.valid || submitting} loading={submitting} onPress={sendOtp} testID="send-otp-btn" />
            </View>
            {!!error && <Text style={[styles.validation, { color: colors.error }]}>{error}</Text>}
          </View>

          <Pressable onPress={() => router.push(loginType === "student" ? "/(auth)/signup" : "/(auth)/register-institution")} style={styles.footerLink}>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: 14 }}>
              New to OnCampus?{" "}
              <Text style={{ color: colors.luxuryGold, fontWeight: "800" }}>{loginType === "student" ? "Create account" : "Register institution"}</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  flex: { flex: 1 },
  wrap: { flexGrow: 1, paddingHorizontal: 22 },
  glow: { position: "absolute", width: 280, height: 280, borderRadius: 140, top: -120, right: -90, opacity: 0.34 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 42, height: 42, borderRadius: 21, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  backButtonPlaceholder: { width: 42, height: 42 },
  brandWord: { fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  heroArea: { alignItems: "center", paddingTop: 58 },
  logoFrame: { width: 86, height: 86, borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, padding: 7, shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 9 } },
  logo: { width: "100%", height: "100%", borderRadius: 20 },
  h1: { fontSize: 34, fontWeight: "900", marginTop: 24, letterSpacing: -1.1, textAlign: "center" },
  h2: { fontSize: 14.5, marginTop: 10, lineHeight: 21, textAlign: "center", maxWidth: 330 },
  modeSwitch: { flexDirection: "row", borderRadius: radius.pill, padding: 4, borderWidth: StyleSheet.hairlineWidth, marginTop: 38 },
  modeButton: { flex: 1, minHeight: 42, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  modeText: { fontSize: 13.5, fontWeight: "700" },
  form: { marginTop: 30 },
  label: { fontSize: 12.5, fontWeight: "700", marginBottom: 9 },
  phoneRow: { flexDirection: "row", alignItems: "center", height: 58, borderRadius: 18, borderWidth: 1, paddingHorizontal: 15 },
  countryCode: { fontSize: 16, fontWeight: "700" },
  divider: { width: StyleSheet.hairlineWidth, height: 25, marginHorizontal: 14 },
  phoneInput: { flex: 1, fontSize: 16, fontWeight: "600", letterSpacing: 0.2 },
  validation: { fontSize: 12, marginTop: 8, lineHeight: 17 },
  ctaWrap: { marginTop: 24 },
  footerLink: { marginTop: "auto", alignItems: "center", paddingTop: 34, paddingBottom: 8 },
});
