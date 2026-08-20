import React, { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { spacing } from "@/src/theme/colors";
import { useRole } from "@/src/context/RoleProvider";

export default function LegacyCreatePostRedirect() {
  const router = useRouter();
  const { colors } = useTheme();
  const { canManageInstitution } = useRole();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace(canManageInstitution ? "/institution/content-create" as any : "/(tabs)/feed" as any);
    }, 0);
    return () => clearTimeout(timer);
  }, [canManageInstitution, router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.brandPrimary} />
      <Text style={{ color: colors.onSurfaceTertiary, marginTop: spacing.md }}>
        {canManageInstitution ? "Opening Content Studio…" : "Returning to feed…"}
      </Text>
    </SafeAreaView>
  );
}
