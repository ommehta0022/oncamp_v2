import React, { useEffect } from "react";
import { ActivityIndicator, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { spacing } from "@/src/theme/colors";

export default function LegacyInstitutionPostRequestsRedirect() {
  const router = useRouter();
  const { colors } = useTheme();
  useEffect(() => {
    const timer = setTimeout(() => router.replace("/institution/content" as any), 0);
    return () => clearTimeout(timer);
  }, [router]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.brandPrimary} />
      <Text style={{ color: colors.onSurfaceTertiary, marginTop: spacing.md }}>Opening Content Studio…</Text>
    </SafeAreaView>
  );
}
