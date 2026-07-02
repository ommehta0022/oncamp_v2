import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import SettingsRow from "@/src/components/SettingsRow";

export default function About() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="About" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.brandBlock}>
          <View style={[styles.logo, { backgroundColor: colors.brandPrimary }]}>
            <Ionicons name="school" size={40} color={colors.onBrandPrimary} />
          </View>
          <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "500", marginTop: spacing.md, letterSpacing: -0.5 }}>OnCampus</Text>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base, marginTop: 2 }}>Version 1.0.0 · Build 1024</Text>
          <Text style={{ color: colors.onSurface, fontSize: font.base, textAlign: "center", marginTop: spacing.lg, paddingHorizontal: spacing.xl, lineHeight: 22 }}>
            The mobile-first institutional communication platform. Group-first messaging for schools and colleges — no DMs, no calls, just what matters.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <SettingsRow icon="document-text-outline" title="Terms of Service" onPress={() => {}} />
          <Divider />
          <SettingsRow icon="shield-checkmark-outline" title="Privacy Policy" onPress={() => {}} />
          <Divider />
          <SettingsRow icon="code-slash-outline" title="Open source licenses" onPress={() => {}} />
          <Divider />
          <SettingsRow icon="star-outline" title="Rate OnCampus" onPress={() => {}} />
        </View>

        <Text style={{ color: colors.muted, fontSize: font.sm, textAlign: "center", marginTop: spacing.xl, paddingHorizontal: spacing.lg }}>
          Made with care in Mumbai · © 2026 OnCampus
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Divider() { const { colors } = useTheme(); return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 68 }} />; }
const styles = StyleSheet.create({
  brandBlock: { alignItems: "center", padding: spacing.xl },
  logo: { width: 88, height: 88, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  section: { marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
});
