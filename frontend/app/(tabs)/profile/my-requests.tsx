import React, { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { spacing } from "@/src/theme/colors";

export default function RetiredStudentPostRequests() {
  const router = useRouter();
  const { colors } = useTheme();
  useEffect(() => {
    const timer = setTimeout(() => router.replace("/(tabs)/profile" as any), 0);
    return () => clearTimeout(timer);
  }, [router]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.brandPrimary} />
      <Text style={{ color: colors.onSurfaceTertiary, marginTop: spacing.md }}>Post requests are managed by institutions.</Text>
    </SafeAreaView>
  );
}
