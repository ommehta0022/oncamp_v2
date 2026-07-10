import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import Button from "@/src/components/Button";
import EmptyState from "@/src/components/EmptyState";
import { api, GroupDto } from "@/src/lib/api";

const CATEGORIES = ["Event", "Announcement", "Contest", "Notice", "Fundraiser", "Recruitment"];

export default function GroupPostRequest() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<GroupDto | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", category: "Event",
    publishDate: "", expiryDate: "",
    contactName: "", contactPhone: "", contactEmail: "",
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));

  const canSubmit = form.title && form.description && form.contactName && form.contactPhone;

  useEffect(() => {
    if (!id) return;
    api.groups.get(id).then(setGroup).catch(() => setGroup(null));
  }, [id]);

  const submit = async () => {
    if (!canSubmit || submitting || !group) return;
    setSubmitting(true);
    setError("");
    try {
      await api.groups.postRequest(group.id, {
        title: form.title,
        description: form.description,
        category: form.category,
        requestedPublishAt: form.publishDate || undefined,
        expiresAt: form.expiryDate || undefined,
        contactName: form.contactName,
        contactPhone: form.contactPhone,
        contactEmail: form.contactEmail || undefined,
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit request");
    } finally {
      setSubmitting(false);
    }
  };

  if (!group) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
        <Header title="Submit post request" onBack={() => router.back()} />
        <EmptyState icon="people-outline" title="Group not found" message="This request needs a real group from the database." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="post-request-screen">
      <Header title="Submit post request" subtitle={`to ${group.name}`} onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={[styles.notice, { backgroundColor: colors.brandTertiary }]}>
            <Ionicons name="information-circle" size={18} color={colors.onBrandTertiary} />
            <Text style={{ color: colors.onBrandTertiary, fontSize: font.sm, flex: 1, lineHeight: 18 }}>
              Group admins will review your request. You&apos;ll be notified once it&apos;s approved, needs changes, or rejected.
            </Text>
          </View>

          <Field label="Title" value={form.title} onChange={(v) => set("title", v)} placeholder="Post title" />
          <Field label="Description" value={form.description} onChange={(v) => set("description", v)} placeholder="What's this about? Why should members care?" multiline />

          <Text style={[styles.sectionLabel, { color: colors.onSurfaceTertiary }]}>Category</Text>
          <View style={styles.chips}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c}
                onPress={() => set("category", c)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: form.category === c ? colors.brandPrimary : colors.surfaceTertiary,
                    borderColor: form.category === c ? colors.brandPrimary : colors.border,
                  },
                ]}
              >
                <Text style={{ color: form.category === c ? colors.onBrandPrimary : colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>{c}</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Field label="Publish date" value={form.publishDate} onChange={(v) => set("publishDate", v)} placeholder="YYYY-MM-DD" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Expiry date" value={form.expiryDate} onChange={(v) => set("expiryDate", v)} placeholder="YYYY-MM-DD" />
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.onSurfaceTertiary }]}>Contact for coordination</Text>
          <Field label="Contact name" value={form.contactName} onChange={(v) => set("contactName", v)} placeholder="Your name" />
          <Field label="Phone" value={form.contactPhone} onChange={(v) => set("contactPhone", v)} placeholder="Phone number" keyboardType="phone-pad" />
          <Field label="Email" value={form.contactEmail} onChange={(v) => set("contactEmail", v)} placeholder="you@institution.edu" keyboardType="email-address" />

          <Field label="Reason (optional)" value={form.reason} onChange={(v) => set("reason", v)} placeholder="Anything else admins should know?" multiline />

          <View style={{ marginTop: spacing["2xl"] }}>
            <Button
              label={submitting ? "Submitting..." : "Submit request"}
              fullWidth
              size="lg"
              disabled={!canSubmit || submitting}
              onPress={submit}
              testID="submit-post-request-btn"
            />
            {!!error && <Text style={{ color: colors.error, fontSize: font.sm, marginTop: spacing.md, textAlign: "center" }}>{error}</Text>}
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
          minHeight: multiline ? 90 : 52,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: "row", alignItems: "flex-start", gap: spacing.sm,
    padding: spacing.md, borderRadius: radius.md,
  },
  sectionLabel: { fontSize: font.sm, marginTop: spacing.xl, marginBottom: spacing.md, fontWeight: "500" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
