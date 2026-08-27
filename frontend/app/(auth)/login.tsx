import React, { useState } from "react";
import { Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Button from "@/src/components/Button";
import Header from "@/src/components/Header";
import { AccountRole, api, getUserErrorMessage } from "@/src/lib/api";
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

void resolveRole;

export default function Login() {
  const { colors } = useTheme();
  const router = useRouter();
  const { refreshUser } = useRole();
  void refreshUser;
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="login-screen">
      <Header title="" transparent />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.wrap}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.surfaceTertiary }]}>
            <Ionicons name="school-outline" size={30} color={colors.brandPrimary} />
          </View>

          <Text style={[styles.h1, { color: colors.onSurface }]}>Welcome back</Text>
          <Text style={[styles.h2, { color: colors.onSurfaceTertiary }]}>
            {loginType === "student"
              ? "Log in to your campus network. We’ll send a secure code to your phone."
              : "Log in with the phone number linked to your institution account."}
          </Text>

          <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
            {(["student", "institution"] as const).map((item) => {
              const active = loginType === item;
              return (
                <Pressable
                  key={item}
                  style={[styles.tab, active && { borderBottomColor: colors.brandPrimary, borderBottomWidth: 2 }]}
                  onPress={() => { setLoginType(item); setError(""); }}
                >
                  <Text style={[styles.tabText, { color: active ? colors.brandPrimary : colors.onSurfaceTertiary }]}>
                    {item === "student" ? "Student" : "Institution"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.onSurfaceTertiary }]}>{loginType === "institution" ? "Admin phone number" : "Phone number"}</Text>
            <View style={[styles.phoneRow, { borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}>
              <View style={styles.cc}><Text style={{ color: colors.onSurfaceTertiary, fontSize: font.lg, fontWeight: "600" }}>+91</Text></View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
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
                style={{ flex: 1, color: colors.onSurface, fontSize: font.lg, paddingHorizontal: spacing.md }}
                maxLength={10}
                autoFocus
              />
            </View>

            {phone.length > 0 && !phoneValidation.valid ? (
              <Text style={{ color: colors.error, fontSize: font.sm, marginTop: spacing.xs }}>{phoneValidation.error}</Text>
            ) : null}

            <View style={{ marginTop: spacing.xl }}>
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

          {!!error && <Text style={{ color: colors.error, fontSize: font.sm, marginTop: spacing.md }}>{error}</Text>}

          <Pressable
            onPress={() => router.push(loginType === "student" ? "/(auth)/signup" : "/(auth)/register-institution")}
            style={styles.createAccount}
          >
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base, textAlign: "center" }}>
              New here?{" "}
              <Text style={{ color: colors.link, fontWeight: "600" }}>{loginType === "student" ? "Create an account" : "Register your institution"}</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing["2xl"], flexGrow: 1 },
  iconWrap: { width: 60, height: 60, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  h1: { fontSize: 29, fontWeight: "700", marginTop: spacing.xl, letterSpacing: -0.6 },
  h2: { fontSize: font.base, marginTop: spacing.sm, lineHeight: 21, maxWidth: 420 },
  tabContainer: { flexDirection: "row", marginTop: spacing.xl, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: "center" },
  tabText: { fontSize: font.base, fontWeight: "600" },
  form: { marginTop: spacing["2xl"] },
  label: { fontSize: font.sm, fontWeight: "600", marginBottom: spacing.sm },
  phoneRow: { flexDirection: "row", alignItems: "center", height: 56, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md },
  cc: { flexDirection: "row", alignItems: "center" },
  divider: { width: StyleSheet.hairlineWidth, height: 24, marginHorizontal: spacing.md },
  createAccount: { marginTop: spacing.xl, alignItems: "center", paddingVertical: spacing.md },
});
