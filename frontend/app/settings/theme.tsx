import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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
  { key: "light", label: "Pearl Light", desc: "Warm campus surfaces with moss identity and terracotta engagement accents.", icon: "sunny-outline" },
  { key: "dark", label: "Obsidian Dark", desc: "Deep neutral surfaces with accessible moss identity and terracotta engagement accents.", icon: "moon-outline" },
];

export default function ThemeSettings() {
  const { colors, mode, setMode } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="theme-settings-screen">
      <Header title="Appearance" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={[styles.introTitle, { color: colors.onSurface }]}>Choose your appearance</Text>
        <Text style={[styles.introBody, { color: colors.onSurfaceTertiary }]}>Both modes use the same typography, spacing and interaction hierarchy. Only the surface treatment changes.</Text>

        <View style={styles.previewRow}>
          <ThemePreview label="Pearl" c={lightColors} active={mode === "light"} onPress={() => setMode("light")} />
          <ThemePreview label="Obsidian" c={darkColors} active={mode === "dark"} onPress={() => setMode("dark")} />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurfaceTertiary }]}>THEME</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.divider }]}>
          {OPTIONS.map((option, index) => {
            const selected = mode === option.key;
            return (
              <React.Fragment key={option.key}>
                {index > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 68 }} />}
                <Pressable
                  onPress={() => setMode(option.key)}
                  style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceTertiary : "transparent" }]}
                  testID={`theme-${option.key}-btn`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                >
                  <View style={[styles.icon, { backgroundColor: option.key === "light" ? lightColors.brandTertiary : darkColors.brandTertiary }]}> 
                    <Ionicons name={option.icon} size={20} color={option.key === "light" ? lightColors.onBrandTertiary : darkColors.onBrandTertiary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "800" }}>{option.label}</Text>
                    <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, lineHeight: 18, marginTop: 3 }}>{option.desc}</Text>
                  </View>
                  <View style={[styles.radio, { borderColor: selected ? colors.actionPrimary : colors.borderStrong }]}>
                    {selected ? <View style={[styles.radioDot, { backgroundColor: colors.actionPrimary }]} /> : null}
                  </View>
                </Pressable>
              </React.Fragment>
            );
          })}
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
          borderColor: active ? colors.actionPrimary : c.border,
          borderWidth: active ? 2 : StyleSheet.hairlineWidth,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label} theme preview`}
    >
      <View style={styles.miniHeader}>
        <View style={{ width: 25, height: 25, borderRadius: 8, backgroundColor: c.brandTertiary, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border }} />
        <View style={{ flex: 1, height: 7, borderRadius: 4, backgroundColor: c.borderStrong }} />
      </View>
      <View style={[styles.miniFeed, { borderColor: c.border, backgroundColor: c.surfaceSecondary }]}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.surfaceTertiary }} />
        <View style={{ flex: 1 }}>
          <View style={{ height: 7, width: "70%", borderRadius: 4, backgroundColor: c.onSurface }} />
          <View style={{ height: 6, width: "92%", borderRadius: 4, backgroundColor: c.onSurfaceTertiary, marginTop: 7, opacity: 0.5 }} />
        </View>
      </View>
      <View style={[styles.miniNav, { borderTopColor: c.divider }]}>
        {[0, 1, 2, 3].map((item) => <View key={item} style={{ width: item === 0 ? 18 : 14, height: item === 0 ? 4 : 3, borderRadius: 3, backgroundColor: item === 0 ? c.tabActive : c.muted, opacity: item === 0 ? 1 : 0.5 }} />)}
      </View>
      <Text style={{ color: c.onSurface, marginTop: spacing.sm, fontSize: font.sm, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 48 },
  introTitle: { fontSize: 23, fontWeight: "900", letterSpacing: -0.55, marginTop: 6 },
  introBody: { fontSize: 13, lineHeight: 19, marginTop: 7, maxWidth: 360 },
  previewRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
  preview: { flex: 1, borderRadius: radius.lg, padding: spacing.md, minHeight: 160 },
  miniHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  miniFeed: { height: 64, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, marginTop: 12, padding: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  miniNav: { height: 24, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  sectionTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 1.1, marginTop: spacing.xl, marginBottom: spacing.sm, paddingHorizontal: 4 },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, minHeight: 82 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
