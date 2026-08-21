import React, { useEffect } from "react";
import { ActivityIndicator, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { spacing } from "@/src/theme/colors";

export default function RetiredGroupPostRequestsInbox() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace((id ? `/group/admin/${id}` : "/(tabs)/groups") as any);
    }, 0);
    return () => clearTimeout(timer);
  }, [id, router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.brandPrimary} />
      <Text style={{ color: colors.onSurfaceTertiary, marginTop: spacing.md }}>
        Student post requests are retired.
      </Text>
    </SafeAreaView>
  );
}
