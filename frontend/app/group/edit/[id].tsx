import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import Button from "@/src/components/Button";
import { api } from "@/src/lib/api";
import { useToast } from "@/src/components/Toast";

const CATS = ["Batch", "Clubs", "Study", "Events", "Sports", "Tech", "Arts", "Career"];
type Visibility = "public" | "private" | "official";

export default function EditGroup() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [city, setCity] = useState("");
  const [cat, setCat] = useState("Clubs");
  const [vis, setVis] = useState<Visibility>("public");
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    api.groups.get(id)
      .then((g: any) => {
        setName(g.name || "");
        setDesc(g.description || "");
        setCity(g.city || "");
        setCat(g.category || "Clubs");
        if (g.official) {
          setVis("official");
        } else if (g.visibility === "secret" || g.visibility === "private") {
          setVis("private");
        } else {
          setVis("public");
        }
        setLoading(false);
      })
      .catch((err: any) => {
        console.error("Failed to fetch group", err);
        setError("Failed to load group");
        setLoading(false);
      });
  }, [id]);

  const submit = async () => {
    if (!name.trim() || !desc.trim() || !city.trim() || submitting || !id) return;
    setSubmitting(true);
    setError("");
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const isOfficial = vis === "official";
      await api.groups.update(id, {
        name: name.trim(),
        description: desc.trim(),
        city: city.trim(),
        category: cat,
        visibility: isOfficial ? "public" : vis,
        official: isOfficial,
        joinPolicy: isOfficial || vis === "public" ? "auto_approve_verified" : "request_to_join",
        postingMode: isOfficial ? "institution_only" : "members_can_request",
      });
      
      if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({ message: "Group updated successfully", variant: "success" });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update group");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
        <Header title="Edit Group" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Edit Group" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Field label="Group name" value={name} onChange={setName} placeholder="Group name" />
          <Field label="Description" value={desc} onChange={setDesc} placeholder="What's this group about?" multiline />
          <Field label="City" value={city} onChange={setCity} placeholder="City" />

          <Text style={[styles.sectionLabel, { color: colors.onSurfaceTertiary }]}>Category</Text>
          <View style={styles.chips}>
            {CATS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setCat(c)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: cat === c ? colors.brandPrimary : colors.surfaceTertiary,
                    borderColor: cat === c ? colors.brandPrimary : colors.border,
                  },
                ]}
              >
                <Text style={{ color: cat === c ? (colors.onBrandPrimary || "#fff") : colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>{c}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.onSurfaceTertiary }]}>Visibility</Text>
          <View style={{ gap: spacing.sm }}>
            <VisOption label="Public" desc="Anyone can find and join" icon="globe-outline" selected={vis === "public"} onPress={() => setVis("public")} />
            <VisOption label="Private" desc="Requires approval from admins" icon="lock-closed-outline" selected={vis === "private"} onPress={() => setVis("private")} />
            <VisOption label="Official (institution only)" desc="Verified institution channel" icon="ribbon-outline" selected={vis === "official"} onPress={() => setVis("official")} />
          </View>

          <View style={{ marginTop: spacing["2xl"] }}>
            <Button
              label={submitting ? "Saving..." : "Save Changes"}
              fullWidth
              size="lg"
              disabled={submitting || !name.trim() || !desc.trim() || !city.trim()}
              onPress={submit}
            />
            {!!error && <Text style={{ color: colors.error, fontSize: font.sm, marginTop: spacing.md, textAlign: "center" }}>{error}</Text>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, placeholder, multiline }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; multiline?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginBottom: spacing.sm, fontWeight: "500" }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        style={{
          backgroundColor: colors.surfaceSecondary,
          borderColor: colors.borderStrong, borderWidth: 1,
          borderRadius: radius.md, paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          color: colors.onSurface, fontSize: font.lg,
          minHeight: multiline ? 90 : 52,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}

function VisOption({ label, desc, icon, selected, onPress }: { label: string; desc: string; icon: any; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.visOpt,
        {
          backgroundColor: selected ? (colors.brandTertiary || colors.surfaceTertiary) : colors.surfaceSecondary,
          borderColor: selected ? colors.brandPrimary : colors.border,
        },
      ]}
    >
      <View style={[styles.visIcon, { backgroundColor: selected ? colors.brandPrimary : colors.surfaceTertiary }]}>
        <Ionicons name={icon} size={18} color={selected ? (colors.onBrandPrimary || "#fff") : colors.onSurface} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "600" }}>{label}</Text>
        <Text style={{ color: colors.textSecondary || colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{desc}</Text>
      </View>
      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={22} color={selected ? colors.brandPrimary : colors.borderStrong} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: font.base, marginTop: spacing.xl, marginBottom: spacing.md, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { height: 38, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  visOpt: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, borderRadius: radius.lg, borderWidth: 1,
  },
  visIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
