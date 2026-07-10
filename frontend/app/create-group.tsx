import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import Button from "@/src/components/Button";
import { api } from "@/src/lib/api";
import { showImagePicker, uploadGroupAvatar } from "@/src/lib/imageUpload";
import { Image } from "expo-image";

const CATS = ["Batch", "Clubs", "Study", "Events", "Sports", "Tech", "Arts", "Career"];
type Visibility = "public" | "private" | "official";

export default function CreateGroup() {
  const { colors } = useTheme();
  const router = useRouter();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("Clubs");
  const [vis, setVis] = useState<Visibility>("public");
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCoverPick = async () => {
    const uri = await showImagePicker({ aspect: [16, 9], quality: 0.8 });
    if (uri) setCoverUri(uri);
  };

  const handleSubmit = async () => {
    if (!name || !desc || loading) return;
    setLoading(true);
    try {
      const newGroup = await api.groups.create({
        name,
        description: desc,
        category: cat,
        visibility: vis,
      });
      if (coverUri && newGroup && newGroup.id) {
        try {
          await uploadGroupAvatar(newGroup.id, coverUri);
        } catch (err) {
          console.error("Failed to upload group cover", err);
        }
      }
      router.replace("/(tabs)/groups");
    } catch (e) {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="create-group-screen">
      <Header title="New group" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Pressable onPress={handleCoverPick} style={[styles.imagePicker, { backgroundColor: colors.brandTertiary, borderColor: colors.border, overflow: "hidden" }]}>
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <>
                <Ionicons name="camera" size={28} color={colors.onBrandTertiary} />
                <Text style={{ color: colors.onBrandTertiary, fontSize: font.sm, fontWeight: "500", marginTop: 4 }}>Add cover</Text>
              </>
            )}
          </Pressable>

          <Field label="Group name" value={name} onChange={setName} placeholder="e.g. CSE Batch of 2026" />
          <Field label="Description" value={desc} onChange={setDesc} placeholder="What's this group about?" multiline />

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
                <Text style={{ color: cat === c ? colors.onBrandPrimary : colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>{c}</Text>
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
              label="Create group"
              fullWidth
              size="lg"
              disabled={!name || !desc || loading}
              onPress={handleSubmit}
              testID="create-group-submit-btn"
            />
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
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginBottom: spacing.sm }}>{label}</Text>
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
          backgroundColor: selected ? colors.brandTertiary : colors.surfaceSecondary,
          borderColor: selected ? colors.brandPrimary : colors.border,
        },
      ]}
    >
      <View style={[styles.visIcon, { backgroundColor: selected ? colors.brandPrimary : colors.surfaceTertiary }]}>
        <Ionicons name={icon} size={18} color={selected ? colors.onBrandPrimary : colors.onSurface} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{label}</Text>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{desc}</Text>
      </View>
      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={20} color={selected ? colors.brandPrimary : colors.borderStrong} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  imagePicker: {
    width: "100%", height: 140, borderRadius: radius.md,
    borderWidth: 1, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
  },
  sectionLabel: { fontSize: font.sm, marginTop: spacing.xl, marginBottom: spacing.md, fontWeight: "500" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  visOpt: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, borderRadius: radius.md, borderWidth: 1,
  },
  visIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
