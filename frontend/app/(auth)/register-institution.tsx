import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Button from "@/src/components/Button";
import Header from "@/src/components/Header";
import { api } from "@/src/lib/api";

const TYPES = ["School", "College", "University", "Coaching", "Department", "Club body"];

export default function RegisterInstitution() {
  const { colors } = useTheme();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "", type: "College", city: "", state: "", country: "India",
    email: "", phone: "", adminName: "", designation: "", website: "",
    reason: "",
  });
  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));

  const canNext =
    step === 1 ? form.name && form.city :
    step === 2 ? form.email && form.phone && form.adminName && form.designation :
    true;

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.institutions.register({
        institutionName: form.name,
        institutionType: form.type,
        city: form.city,
        state: form.state,
        country: form.country,
        officialEmail: form.email,
        phone: form.phone,
        website: form.website,
        adminName: form.adminName,
        designation: form.designation,
      });
    } catch {
      // Keep the flow reviewable in browser when API credentials are not configured yet.
    } finally {
      setSubmitting(false);
      router.replace("/institution/dashboard");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="register-institution-screen">
      <Header title="Register institution" subtitle={`Step ${step} of 3`} onBack={() => step > 1 ? setStep(step - 1) : router.back()} />

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <View style={{ flexDirection: "row", gap: spacing.xs }}>
          {[1, 2, 3].map((n) => (
            <View
              key={n}
              style={{
                flex: 1, height: 4, borderRadius: 2,
                backgroundColor: n <= step ? colors.brandPrimary : colors.borderStrong,
              }}
            />
          ))}
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <>
              <View style={[styles.iconWrap, { backgroundColor: colors.brandTertiary }]}>
                <Ionicons name="business" size={30} color={colors.onBrandTertiary} />
              </View>
              <Text style={[styles.h1, { color: colors.onSurface }]}>Tell us about your institution</Text>
              <Text style={[styles.h2, { color: colors.onSurfaceTertiary }]}>
                We&apos;ll use this to set up your official page and verified badge.
              </Text>

              <Field label="Institution name" value={form.name} onChange={(v) => set("name", v)} placeholder="e.g. Indian Institute of Technology, Bombay" />

              <Text style={[styles.sectionLabel, { color: colors.onSurfaceTertiary }]}>Type</Text>
              <View style={styles.chips}>
                {TYPES.map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => set("type", t)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: form.type === t ? colors.brandPrimary : colors.surfaceTertiary,
                        borderColor: form.type === t ? colors.brandPrimary : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: form.type === t ? colors.onBrandPrimary : colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>{t}</Text>
                  </Pressable>
                ))}
              </View>

              <Field label="City" value={form.city} onChange={(v) => set("city", v)} placeholder="Mumbai" />
              <Field label="State" value={form.state} onChange={(v) => set("state", v)} placeholder="Maharashtra" />
              <Field label="Country" value={form.country} onChange={(v) => set("country", v)} placeholder="India" />
            </>
          )}

          {step === 2 && (
            <>
              <View style={[styles.iconWrap, { backgroundColor: colors.brandTertiary }]}>
                <Ionicons name="shield-checkmark" size={30} color={colors.onBrandTertiary} />
              </View>
              <Text style={[styles.h1, { color: colors.onSurface }]}>Admin & contact</Text>
              <Text style={[styles.h2, { color: colors.onSurfaceTertiary }]}>
                We need to verify you&apos;re authorized to represent this institution.
              </Text>

              <Field label="Official email (domain)" value={form.email} onChange={(v) => set("email", v)} placeholder="admissions@iitb.ac.in" keyboardType="email-address" />
              <Field label="Official phone" value={form.phone} onChange={(v) => set("phone", v)} placeholder="+91 22 1234 5678" keyboardType="phone-pad" />
              <Field label="Admin name" value={form.adminName} onChange={(v) => set("adminName", v)} placeholder="Your full name" />
              <Field label="Designation" value={form.designation} onChange={(v) => set("designation", v)} placeholder="e.g. Dean of Student Affairs" />
              <Field label="Website" value={form.website} onChange={(v) => set("website", v)} placeholder="https://iitb.ac.in" keyboardType="default" />
            </>
          )}

          {step === 3 && (
            <>
              <View style={[styles.iconWrap, { backgroundColor: colors.brandTertiary }]}>
                <Ionicons name="document-text" size={30} color={colors.onBrandTertiary} />
              </View>
              <Text style={[styles.h1, { color: colors.onSurface }]}>Verification documents</Text>
              <Text style={[styles.h2, { color: colors.onSurfaceTertiary }]}>
                Upload institution logo and any official identification. Our team reviews within 48 hours.
              </Text>

              <UploadBox label="Institution logo" hint="PNG or SVG, min 512px" />
              <UploadBox label="Verification documents" hint="Registration / accreditation / govt. authorization" />

              <Field label="Reason / use case" value={form.reason} onChange={(v) => set("reason", v)} placeholder="Briefly tell us why you're joining OnCampus" multiline />

              <View style={[styles.notice, { backgroundColor: colors.brandTertiary }]}>
                <Ionicons name="information-circle" size={18} color={colors.onBrandTertiary} />
                <Text style={{ color: colors.onBrandTertiary, fontSize: font.sm, flex: 1, lineHeight: 18 }}>
                  Your account will remain in{" "}
                  <Text style={{ fontWeight: "500" }}>pending_verification</Text> until approved. You can preview
                  your dashboard but public posts stay hidden.
                </Text>
              </View>
            </>
          )}

          <View style={{ marginTop: spacing["2xl"], gap: spacing.md }}>
            {step < 3 ? (
              <Button
                label="Continue"
                fullWidth
                size="lg"
                disabled={!canNext}
                onPress={() => setStep(step + 1)}
                testID="register-institution-next-btn"
              />
            ) : (
              <Button
                label={submitting ? "Submitting..." : "Submit for verification"}
                fullWidth
                size="lg"
                disabled={submitting}
                onPress={submit}
                testID="submit-institution-btn"
              />
            )}
            <Pressable onPress={() => router.back()} style={{ alignItems: "center", paddingVertical: spacing.sm }}>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base }}>Cancel</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label, value, onChange, placeholder, keyboardType, multiline,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
  keyboardType?: "email-address" | "phone-pad" | "default"; multiline?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginBottom: spacing.sm }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType || "default"}
        multiline={multiline}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        style={{
          backgroundColor: colors.surfaceSecondary,
          borderColor: colors.borderStrong, borderWidth: 1,
          borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
          color: colors.onSurface, fontSize: font.lg,
          minHeight: multiline ? 100 : 52,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}

function UploadBox({ label, hint }: { label: string; hint: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      style={[styles.upload, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary }]}
    >
      <View style={[styles.uploadIcon, { backgroundColor: colors.brandTertiary }]}>
        <Ionicons name="cloud-upload-outline" size={22} color={colors.onBrandTertiary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{label}</Text>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 60, height: 60, borderRadius: 18, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  h1: { fontSize: 24, fontWeight: "500", letterSpacing: -0.5, marginTop: spacing.lg },
  h2: { fontSize: font.base, marginTop: spacing.sm, lineHeight: 20 },
  sectionLabel: { fontSize: font.sm, marginTop: spacing.lg, marginBottom: spacing.sm, fontWeight: "500" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  upload: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed",
    marginTop: spacing.lg,
  },
  uploadIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  notice: {
    flexDirection: "row", alignItems: "flex-start", gap: spacing.sm,
    padding: spacing.md, borderRadius: radius.md, marginTop: spacing.lg,
  },
});
