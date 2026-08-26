import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTheme, ThemeMode } from "@/src/theme/ThemeProvider";
import { font, radius, spacing, lightColors, darkColors } from "@/src/theme/colors";
import Header from "@/src/components/Header";

type Option = {
  key: ThemeMode;
  label: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const OPTIONS: Option[] = [
  { key: "light", label: "Pearl Light", desc: "Warm ivory, deep navy and refined gold accents.", icon: "sunny-outline" },
  { key: "dark", label: "Obsidian Dark", desc: "Midnight surfaces, luminous blue-teal and soft gold.", icon: "moon-outline" },
];

export default function ThemeSettings() {
  const { colors, mode, setMode } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="theme-settings-screen">
      <Header title="Appearance" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroIcon}><Ionicons name="diamond-outline" size={21} color="#FFF5D7" /></View>
          <Text style={styles.heroEyebrow}>SIGNATURE APPEARANCE</Text>
          <Text style={styles.heroTitle}>Two carefully crafted modes.</Text>
          <Text style={styles.heroBody}>Every surface, card, input and accent follows the same premium visual system for a consistent OnCampus experience.</Text>
        </LinearGradient>

        <View style={styles.previewRow}>
          <ThemePreview label="Pearl" c={lightColors} active={mode === "light"} onPress={() => setMode("light")} />
          <ThemePreview label="Obsidian" c={darkColors} active={mode === "dark"} onPress={() => setMode("dark")} />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurfaceTertiary }]}>CHOOSE YOUR MODE</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          {OPTIONS.map((option, index) => (
            <React.Fragment key={option.key}>
              {index > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 68 }} />}
              <Pressable
                onPress={() => setMode(option.key)}
                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.72 : 1 }]}
                testID={`theme-${option.key}-btn`}
                accessibilityRole="radio"
                accessibilityState={{ checked: mode === option.key }}
              >
                <LinearGradient
                  colors={option.key === "light" ? ["#F3E8D2", "#E7F4F1"] : ["#17324A", "#1C3533"]}
                  style={styles.icon}
                >
                  <Ionicons name={option.icon} size={20} color={option.key === "light" ? "#70521F" : "#F0D79B"} />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "800" }}>{option.label}</Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, lineHeight: 18, marginTop: 3 }}>{option.desc}</Text>
                </View>
                <Ionicons
                  name={mode === option.key ? "checkmark-circle" : "ellipse-outline"}
                  size={24}
                  color={mode === option.key ? colors.luxuryGold : colors.borderStrong}
                />
              </Pressable>
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ThemePreview({ label, c, active, onPress }: { label: string; c: typeof lightColors; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.preview,
        {
          backgroundColor: c.surface,
          borderColor: active ? colors.luxuryGold : c.border,
          borderWidth: active ? 2 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label} theme preview`}
    >
      <View style={styles.miniHeader}>
        <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: c.brandPrimary }} />
        <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: c.borderStrong }} />
      </View>
      <LinearGradient colors={[c.gradientStart, c.gradientEnd]} style={styles.miniHero} />
      <View style={[styles.miniCard, { backgroundColor: c.surfaceSecondary, borderColor: c.border }]}>
        <View style={{ height: 7, width: "74%", borderRadius: 4, backgroundColor: c.onSurface }} />
        <View style={{ height: 6, width: "92%", borderRadius: 4, backgroundColor: c.onSurfaceTertiary, marginTop: 7, opacity: 0.55 }} />
      </View>
      <Text style={{ color: c.onSurface, marginTop: spacing.sm, fontSize: font.sm, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 48 },
  hero: { borderRadius: 28, padding: 22, minHeight: 186, justifyContent: "flex-end" },
  heroIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 22 },
  heroEyebrow: { color: "#D9C486", fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  heroTitle: { color: "#FFFFFF", fontSize: 25, lineHeight: 30, fontWeight: "900", letterSpacing: -0.5, marginTop: 5 },
  heroBody: { color: "rgba(255,255,255,0.78)", fontSize: 13, lineHeight: 19, marginTop: 8, maxWidth: 350 },
  previewRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  preview: { flex: 1, borderRadius: radius.lg, padding: spacing.md, minHeight: 164 },
  miniHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  miniHero: { height: 34, borderRadius: 10, marginTop: 10 },
  miniCard: { borderWidth: 1, borderRadius: 10, padding: 9, marginTop: 8 },
  sectionTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 1.1, marginTop: spacing.xl, marginBottom: spacing.sm, paddingHorizontal: 4 },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, minHeight: 82 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
