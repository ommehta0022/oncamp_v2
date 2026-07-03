import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";

export default function Help() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Help & support" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[styles.hero, { backgroundColor: colors.brandTertiary }]}>
          <Ionicons name="help-buoy" size={32} color={colors.onBrandTertiary} />
          <Text style={{ color: colors.onBrandTertiary, fontSize: font.xl, fontWeight: "500", marginTop: spacing.sm }}>
            Help & support
          </Text>
          <Text style={{ color: colors.onBrandTertiary, fontSize: font.base, marginTop: 4, opacity: 0.8, lineHeight: 22 }}>
            Your institution administrator can help with account, group, and verification issues.
          </Text>
        </View>

        <Section title="Account support">
          <View style={{ padding: spacing.lg }}>
            <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>Institution support</Text>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 4, lineHeight: 20 }}>
              Contact your campus or organization admin for help with your OnCampus account.
            </Text>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "500", paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</Text>
      <View style={{ marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, overflow: "hidden" }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { margin: spacing.lg, padding: spacing.xl, borderRadius: radius.md, alignItems: "flex-start" },
});
