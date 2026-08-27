import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing, lightColors, darkColors } from "@/src/theme/colors";
import Header from "@/src/components/Header";

type Mode = "light" | "dark" | "system";
const OPTS: { key: Mode; label: string; desc: string; icon: any }[] = [
  { key: "light", label: "Light", desc: "Bright surfaces, sharp contrast", icon: "sunny-outline" },
  { key: "dark", label: "Dark", desc: "Easier on the eyes at night", icon: "moon-outline" },
  { key: "system", label: "System", desc: "Follows your device setting", icon: "phone-portrait-outline" },
];

export default function ThemeSettings() {
  const { colors, mode, setMode } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="theme-settings-screen">
      <Header title="Theme" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg }}>
        <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.xl }}>
          <ThemePreview label="Light" c={lightColors} active={mode === "light"} onPress={() => setMode("light")} />
          <ThemePreview label="Dark" c={darkColors} active={mode === "dark"} onPress={() => setMode("dark")} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          {OPTS.map((o, i) => (
            <React.Fragment key={o.key}>
              {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 60 }} />}
              <Pressable
                onPress={() => setMode(o.key)}
                style={styles.row}
                testID={`theme-${o.key}-btn`}
              >
                <View style={[styles.icon, { backgroundColor: colors.brandTertiary }]}>
                  <Ionicons name={o.icon} size={18} color={colors.onBrandTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }}>{o.label}</Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{o.desc}</Text>
                </View>
                <Ionicons
                  name={mode === o.key ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={mode === o.key ? colors.brandPrimary : colors.borderStrong}
                />
              </Pressable>
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ThemePreview({ label, c, active, onPress }: { label: string; c: any; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.preview, { backgroundColor: c.surface, borderColor: active ? colors.brandPrimary : c.border, borderWidth: active ? 2 : 1 }]}
    >
      <View style={{ flexDirection: "row", gap: 4, marginBottom: spacing.md }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.brandPrimary }} />
        <View style={{ flex: 1, height: 24, borderRadius: 6, backgroundColor: c.surfaceTertiary }} />
      </View>
      <View style={{ height: 6, backgroundColor: c.brandPrimary, borderRadius: 3, width: "60%" }} />
      <View style={{ height: 6, backgroundColor: c.surfaceTertiary, borderRadius: 3, width: "80%", marginTop: 6 }} />
      <View style={{ height: 6, backgroundColor: c.surfaceTertiary, borderRadius: 3, width: "70%", marginTop: 6 }} />
      <Text style={{ color: c.onSurface, marginTop: spacing.md, fontSize: font.sm, fontWeight: "500" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  preview: {
    flex: 1, borderRadius: radius.md, padding: spacing.md, height: 130,
  },
  card: { borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 64,
  },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
