import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import { api } from "@/src/lib/api";

export default function Branding() {
  const { colors } = useTheme();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", description: "", website: "", logoUrl: "", coverUrl: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.institutions.dashboard()
      .then((data: any) => {
        const institution = data.institution || {};
        setForm({
          name: institution.name || "",
          description: institution.description || "",
          website: institution.website || "",
          logoUrl: institution.logo_url || "",
          coverUrl: institution.cover_url || "",
        });
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await api.institutions.updateMe(form);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="branding-screen">
      <Header
        title="Branding"
        subtitle="Institution profile"
        onBack={() => router.back()}
        right={
          <Pressable onPress={save} disabled={saving}>
            <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "500" }}>{saving ? "Saving" : "Save"}</Text>
          </Pressable>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <Text style={[styles.section, { color: colors.onSurfaceTertiary }]}>COVER IMAGE URL</Text>
        <View style={[styles.coverWrap, { backgroundColor: colors.brandPrimary }]}>
          {form.coverUrl ? <Image source={{ uri: form.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        </View>
        <Field label="Cover URL" value={form.coverUrl} onChange={(v) => set("coverUrl", v)} placeholder="https://..." />

        <Text style={[styles.section, { color: colors.onSurfaceTertiary }]}>LOGO URL</Text>
        <View style={styles.logoRow}>
          <View style={[styles.logo, { backgroundColor: colors.brandPrimary }]}>
            {form.logoUrl ? <Image source={{ uri: form.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="school" size={32} color="#fff" />}
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Logo URL" value={form.logoUrl} onChange={(v) => set("logoUrl", v)} placeholder="https://..." compact />
          </View>
        </View>

        <Text style={[styles.section, { color: colors.onSurfaceTertiary }]}>PUBLIC PROFILE</Text>
        <Field label="Institution name" value={form.name} onChange={(v) => set("name", v)} placeholder="Institution name" />
        <Field label="Description" value={form.description} onChange={(v) => set("description", v)} placeholder="Short institution description" multiline />
        <Field label="Website" value={form.website} onChange={(v) => set("website", v)} placeholder="https://institution.edu" />
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, placeholder, multiline, compact }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; multiline?: boolean; compact?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginHorizontal: compact ? 0 : spacing.lg, marginTop: compact ? 0 : spacing.sm }}>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginBottom: spacing.sm }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        style={{
          backgroundColor: colors.surfaceSecondary,
          borderColor: colors.borderStrong,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          color: colors.onSurface,
          fontSize: font.base,
          minHeight: multiline ? 100 : 48,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: font.sm, fontWeight: "500", letterSpacing: 0.5, paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.sm },
  coverWrap: { height: 140, marginHorizontal: spacing.lg, borderRadius: radius.md, overflow: "hidden" },
  logoRow: { flexDirection: "row", gap: spacing.md, alignItems: "center", marginHorizontal: spacing.lg, paddingVertical: spacing.md },
  logo: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
