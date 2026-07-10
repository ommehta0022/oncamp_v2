import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";

export default function Invite() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Invite friends" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg }}>
        <View style={[styles.hero, { backgroundColor: colors.brandPrimary }]}>
          <Ionicons name="gift" size={40} color={colors.onBrandPrimary} />
          <Text style={{ color: colors.onBrandPrimary, fontSize: 22, fontWeight: "500", marginTop: spacing.md }}>
            Campus referrals
          </Text>
          <Text style={{ color: colors.onBrandPrimary, opacity: 0.85, fontSize: font.base, marginTop: 6, lineHeight: 20 }}>
            Invite links will be available when your institution enables referrals.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>Referral access</Text>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 4, lineHeight: 20 }}>
            Your account is ready to use without referral data.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { padding: spacing.xl, borderRadius: radius.md, alignItems: "flex-start" },
  card: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, marginTop: spacing.lg },
});
