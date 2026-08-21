import React, { useEffect } from "react";
import { ActivityIndicator, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { spacing } from "@/src/theme/colors";

/**
 * Student post-request publishing was retired.
 * Institution-to-institution content collaboration lives in Content Studio.
 * Keep this route as a compatibility redirect for old deep links/bookmarks.
 */
export default function RetiredGroupPostRequest() {
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => router.replace("/(tabs)/feed" as any), 0);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ActivityIndicator color={colors.brandPrimary} />
      <Text style={{ color: colors.onSurfaceTertiary, marginTop: spacing.md, textAlign: "center", paddingHorizontal: spacing.xl }}>
        Publishing requests are managed by institution administrators.
      </Text>
    </SafeAreaView>
  );
}
