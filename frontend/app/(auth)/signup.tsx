import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Button from "@/src/components/Button";
import Header from "@/src/components/Header";
import { api } from "@/src/lib/api";

export default function Signup() {
  const { colors } = useTheme();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({ name: "", email: "", phone: "" });

  // Validation functions
  const validateName = (value: string): boolean => {
    return value.trim().length >= 2;
  };

  const validateEmail = (value: string): boolean => {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value.trim());
  };

  const validatePhone = (value: string): boolean => {
    const cleaned = value.replace(/\D/g, "");
    return cleaned.length === 10;
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (value.length > 0 && !validateName(value)) {
      setErrors(prev => ({ ...prev, name: "Name must be at least 2 characters" }));
    } else {
      setErrors(prev => ({ ...prev, name: "" }));
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (value.length > 0 && !validateEmail(value)) {
      setErrors(prev => ({ ...prev, email: "Please enter a valid email address" }));
    } else {
      setErrors(prev => ({ ...prev, email: "" }));
    }
  };

  const handlePhoneChange = (value: string) => {
    // Only allow digits, max 10
    const cleaned = value.replace(/\D/g, "").slice(0, 10);
    setPhone(cleaned);
    if (cleaned.length > 0 && cleaned.length < 10) {
      setErrors(prev => ({ ...prev, phone: "Phone number must be 10 digits" }));
    } else {
      setErrors(prev => ({ ...prev, phone: "" }));
    }
  };

  const valid = validateName(name) && validateEmail(email) && validatePhone(phone);

  const sendOtp = async () => {
    if (!valid || submitting) return;
    
    setSubmitting(true);
    setError("");
    
    // Backend will handle adding +91
    const fullPhone = `+91${phone}`;
    
    try {
      const otp = await api.auth.startOtp(fullPhone);
      router.push({
        pathname: "/(auth)/otp",
        params: {
          phone: fullPhone,
          challengeId: otp.challengeId || "",
          from: "signup",
          name,
          email,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send OTP. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} testID="signup-screen">
      <Header title="" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={[styles.iconWrap, { backgroundColor: colors.brandTertiary }]}>
            <Ionicons name="person-add" size={30} color={colors.onBrandTertiary} />
          </View>
          <Text style={[styles.h1, { color: colors.onSurface }]}>Create your account</Text>
          <Text style={[styles.h2, { color: colors.onSurfaceTertiary }]}>
            Join your campus and connect with classmates, clubs, and faculty.
          </Text>

          <Field 
            label="Full name" 
            value={name} 
            onChange={handleNameChange} 
            placeholder="Your full name" 
            icon="person-outline"
            error={errors.name}
          />
          <Field 
            label="Email (student ID email)" 
            value={email} 
            onChange={handleEmailChange} 
            placeholder="you@institution.edu" 
            icon="mail-outline" 
            keyboardType="email-address"
            error={errors.email}
          />
          <Field 
            label="Phone number" 
            value={phone} 
            onChange={handlePhoneChange} 
            placeholder="10-digit mobile number" 
            icon="call-outline" 
            keyboardType="phone-pad"
            maxLength={10}
            prefix="+91"
            error={errors.phone}
          />

          <View style={{ marginTop: spacing.xl }}>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, lineHeight: 18 }}>
              By continuing you agree to our <Text style={{ color: colors.brandPrimary, fontWeight: "500" }}>Terms</Text> and{" "}
              <Text style={{ color: colors.brandPrimary, fontWeight: "500" }}>Privacy Policy</Text>. OnCampus is group-only -
              there is no private messaging.
            </Text>
          </View>

          <View style={{ marginTop: spacing.xl }}>
            <Button
              label="Send OTP"
              fullWidth
              size="lg"
              disabled={!valid || submitting}
              onPress={sendOtp}
              testID="signup-continue-btn"
            />
          </View>
          {!!error && (
            <Text style={{ color: colors.error, fontSize: font.sm, marginTop: spacing.sm, textAlign: "center" }}>
              {error}
            </Text>
          )}

          <Pressable onPress={() => router.push("/(auth)/login")} style={{ marginTop: spacing.xl, alignItems: "center" }}>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base }}>
              Already have an account?{" "}
              <Text style={{ color: colors.brandPrimary, fontWeight: "500" }}>Log in</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label, value, onChange, placeholder, icon, keyboardType, maxLength, prefix, error,
}: {
  label: string; 
  value: string; 
  onChange: (v: string) => void; 
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap; 
  keyboardType?: "email-address" | "phone-pad" | "default";
  maxLength?: number;
  prefix?: string;
  error?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginBottom: spacing.sm }}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          { 
            borderColor: error ? colors.error : colors.borderStrong, 
            backgroundColor: colors.surfaceSecondary 
          },
        ]}
      >
        <Ionicons name={icon} size={18} color={colors.onSurfaceTertiary} />
        {prefix && (
          <>
            <Text style={{ color: colors.muted, fontSize: font.lg, marginLeft: spacing.sm, fontWeight: "500" }}>
              {prefix}
            </Text>
            <View style={{ width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: spacing.sm }} />
          </>
        )}
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          keyboardType={keyboardType || "default"}
          autoCapitalize={keyboardType === "email-address" ? "none" : "words"}
          maxLength={maxLength}
          style={{ flex: 1, color: colors.onSurface, fontSize: font.lg, marginLeft: prefix ? 0 : spacing.sm }}
        />
      </View>
      {!!error && (
        <Text style={{ color: colors.error, fontSize: font.sm, marginTop: spacing.xs }}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, paddingBottom: spacing["3xl"] },
  iconWrap: { width: 60, height: 60, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  h1: { fontSize: 26, fontWeight: "500", marginTop: spacing.lg, letterSpacing: -0.5 },
  h2: { fontSize: font.base, marginTop: spacing.sm, lineHeight: 20 },
  inputRow: {
    flexDirection: "row", alignItems: "center", height: 52,
    borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md,
  },
});
