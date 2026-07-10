import React from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";

export default function ActivityLog() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Activity log" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ flex: 1, padding: spacing.lg }}>
        <EmptyState
          icon="time-outline"
          title="Activity log"
          message="Your activity history will appear here. This feature is coming soon."
        />
      </ScrollView>
    </SafeAreaView>
  );
}
