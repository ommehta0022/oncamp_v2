import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";

export default function About() {
  const { colors } = useTheme();
  const router = useRouter();
  const version = Constants.expoConfig?.version || "1.0.0";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="About" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.brandBlock}>
          <View style={[styles.logo, { backgroundColor: colors.brandPrimary }]}>
            <Ionicons name="school" size={40} color={colors.onBrandPrimary} />
          </View>
          <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "500", marginTop: spacing.md }}>OnCampus</Text>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base, marginTop: 2 }}>Version {version}</Text>
          <Text style={{ color: colors.onSurface, fontSize: font.base, textAlign: "center", marginTop: spacing.lg, paddingHorizontal: spacing.xl, lineHeight: 22 }}>
            Institutional groups, posts, requests, and notifications for real campus communities.
          </Text>
        </View>

        <Text style={{ color: colors.muted, fontSize: font.sm, textAlign: "center", marginTop: spacing.xl, paddingHorizontal: spacing.lg }}>
          Copyright 2026 OnCampus
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  brandBlock: { alignItems: "center", padding: spacing.xl },
  logo: { width: 88, height: 88, borderRadius: 24, alignItems: "center", justifyContent: "center" },
});
