import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Button from "@/src/components/Button";
import Header from "@/src/components/Header";
import { AccountRole, api, getUserErrorMessage, saveSession } from "@/src/lib/api";
import { digitsOnly, validateIndianPhone } from "@/src/utils/validation";
import { useRole } from "@/src/context/RoleProvider";

function resolveRole(accountType?: AccountRole, roles: AccountRole[] = []) {
  if (roles.includes("platform_admin")) return "platform_admin";
  if (roles.includes("institution_admin") || accountType === "institution_admin") return "institution_admin";
  if (roles.includes("group_owner")) return "group_owner";
  if (roles.includes("group_admin")) return "group_admin";
  if (roles.includes("moderator")) return "moderator";
  return "normal_user";
}

export default function Login() {
  const { colors } = useTheme();
  const router = useRouter();
  const { refreshUser } = useRole();
  const [loginType, setLoginType] = useState<"student" | "institution">("student");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const phoneValidation = validateIndianPhone(phone);

  const handlePhoneChange = (value: string) => {
    // Only allow digits, max 10
    const cleaned = digitsOnly(value, 10);
    setPhone(cleaned);
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
    
    // Backend will handle adding +91
    const fullPhone = `+91${phone}`;
    
    try {
      let otp;
      if (loginType === "institution") {
        otp = await api.auth.startInstitutionOtp(fullPhone);
      } else {
        otp = await api.auth.startOtp(fullPhone, 'login');
      }
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
            {loginType === "student" ? "Log in to your campus network. We'll send you a code." : "Log in to your institution admin panel."}
          </Text>

          <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
            <Pressable
              style={[styles.tab, loginType === "student" && { borderBottomColor: colors.brandPrimary, borderBottomWidth: 2 }]}
              onPress={() => { setLoginType("student"); setError(""); }}
            >
              <Text style={[styles.tabText, { color: loginType === "student" ? colors.brandPrimary : colors.muted }]}>Student</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, loginType === "institution" && { borderBottomColor: colors.brandPrimary, borderBottomWidth: 2 }]}
              onPress={() => { setLoginType("institution"); setError(""); }}
            >
              <Text style={[styles.tabText, { color: loginType === "institution" ? colors.brandPrimary : colors.muted }]}>Institution</Text>
            </Pressable>
          </View>

          <View style={{ marginTop: spacing["2xl"] }}>
            <Text style={[styles.label, { color: colors.onSurfaceTertiary }]}>{loginType === "institution" ? "Admin Phone number" : "Phone number"}</Text>
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
                textContentType="telephoneNumber"
                autoComplete="tel"
                accessibilityLabel="Phone number"
                style={{ flex: 1, color: colors.onSurface, fontSize: font.lg, paddingHorizontal: spacing.md }}
                maxLength={10}
                autoFocus
              />
            </View>
            {phone.length > 0 && !phoneValidation.valid && (
              <Text style={{ color: colors.error, fontSize: font.sm, marginTop: spacing.xs }}>
                {phoneValidation.error}
              </Text>
            )}

            <View style={{ marginTop: spacing["2xl"] }}>
              <Button
                label="Send OTP"
                fullWidth
                size="lg"
                disabled={!phoneValidation.valid || submitting}
                loading={submitting}
                onPress={sendOtp}
                testID="send-otp-btn"
              />
            </View>
          </View>

          {!!error && (
            <Text style={{ color: colors.error, fontSize: font.sm, marginTop: spacing.sm }}>
              {error}
            </Text>
          )}

          <Pressable onPress={() => router.push(loginType === "student" ? "/(auth)/signup" : "/(auth)/register-institution")} style={{ marginTop: spacing.xl, alignItems: "center", marginBottom: spacing["2xl"] }}>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base }}>
              New here?{" "}
              <Text style={{ color: colors.brandPrimary, fontWeight: "500" }}>{loginType === "student" ? "Create an account" : "Register your institution"}</Text>
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
  tabContainer: { flexDirection: "row", marginTop: spacing.xl, borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: "center" },
  tabText: { fontSize: font.base, fontWeight: "500" },
  input: { height: 56, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontSize: font.lg },
});
