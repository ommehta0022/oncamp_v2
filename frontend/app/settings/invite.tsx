import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Share, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import { useRole } from "@/src/context/RoleProvider";

export default function Invite() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useRole();

  const shareInvite = async () => {
    try {
      await Share.share({
        title: "Join me on OnCampus",
        message: `Join me on OnCampus${user?.name ? ` with ${user.name}` : ""}. Download the app and search for your institution to connect with campus groups, posts, and requests.`,
      });
    } catch (error) {
      Alert.alert("Share failed", error instanceof Error ? error.message : "Could not open sharing.");
    }
  };

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
            Share OnCampus with classmates and invite them to join your real campus groups.
          </Text>
          <Pressable onPress={shareInvite} style={styles.shareBtn} testID="share-invite-btn">
            <Ionicons name="share-social" size={18} color={colors.brandPrimary} />
            <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "600" }}>Share invite</Text>
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>Your account</Text>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 4, lineHeight: 20 }}>
            {user?.name || "Your profile"} can invite people without waiting for a referral campaign.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { padding: spacing.xl, borderRadius: radius.md, alignItems: "flex-start" },
  shareBtn: { marginTop: spacing.lg, height: 44, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", gap: spacing.sm },
  card: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, marginTop: spacing.lg },
});
