import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import { blockedUsers } from "@/src/data/mock";

export default function Blocked() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Blocked users" onBack={() => router.back()} />
      {blockedUsers.length === 0 ? (
        <EmptyState icon="shield-checkmark-outline" title="No blocked users" message="Users you block won't be able to see your posts or interact with you in groups." />
      ) : null}
    </SafeAreaView>
  );
}
