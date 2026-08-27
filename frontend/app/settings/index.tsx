import React, { useRef } from "react";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import SettingsRow from "@/src/components/SettingsRow";
import Avatar from "@/src/components/Avatar";
import Button from "@/src/components/Button";
import { checkForAppUpdate } from "@/src/components/AppUpdateGate";
import { useRole } from "@/src/context/RoleProvider";
import { useLanguage } from "@/src/context/LanguageProvider";
import { clearSession } from "@/src/lib/api";

export default function Settings() {
  const { colors, mode } = useTheme();
  const { user } = useRole();
  const { t } = useLanguage();
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const version = Constants.expoConfig?.version || "1.0.0";

  const logout = async () => {
    if (Platform.OS === "ios") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await clearSession(false);
    router.replace("/(auth)/welcome");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]} testID="settings-screen">
      <Header title={t("settings.title")} onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 64 }}>
        <Pressable
          onPress={() => router.push("/settings/edit-profile")}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start()}
          onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
        >
          <Animated.View style={[
            styles.profileCard,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.border,
              transform: [{ scale: scaleAnim }],
              shadowColor: colors.shadow,
              shadowOpacity: 0.05,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 2,
            },
          ]}>
            <Avatar uri={user?.avatarUrl} name={user?.name || "You"} size={62} verified={user?.verified} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "700", letterSpacing: -0.3 }}>{user?.name || "Complete your profile"}</Text>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 4, fontWeight: "500" }}>{user?.course || "Tap to view and edit profile"}</Text>
            </View>
            <View style={[styles.editIcon, { backgroundColor: colors.surfaceTertiary }]}>
              <Ionicons name="pencil" size={16} color={colors.onSurfaceTertiary} />
            </View>
          </Animated.View>
        </Pressable>

        <Section title={t("settings.preferences")}>
          <SettingsRow icon="color-palette-outline" title={t("settings.appearance")} value={mode === "system" ? "Auto" : mode === "dark" ? "Dark" : "Light"} onPress={() => router.push("/settings/theme")} />
          <Divider />
          <SettingsRow icon="notifications-outline" title={t("settings.notifications")} subtitle="Campus, community and device alerts" onPress={() => router.push("/settings/notifications")} />
          <Divider />
          <SettingsRow icon="language-outline" title={t("settings.language")} onPress={() => router.push("/settings/language")} />
        </Section>

        <Section title={t("settings.privacySafety")}>
          <SettingsRow icon="lock-closed-outline" title={t("settings.privacy")} onPress={() => router.push("/settings/privacy")} />
          <Divider />
          <SettingsRow icon="shield-checkmark-outline" title={t("settings.blocked")} onPress={() => router.push("/settings/blocked")} />
          <Divider />
          <SettingsRow icon="bug-outline" title={t("settings.report")} onPress={() => router.push("/settings/report")} />
        </Section>

        <Section title={t("settings.yourCampus")}>
          <SettingsRow icon="bookmark-outline" title={t("settings.saved")} onPress={() => router.push("/saved")} />
          <Divider />
          <SettingsRow icon="time-outline" title={t("settings.activity")} onPress={() => router.push("/settings/activity")} />
          <Divider />
          <SettingsRow icon="cloud-download-outline" title={t("settings.storage")} onPress={() => router.push("/settings/storage")} />
          <Divider />
          <SettingsRow icon="sparkles-outline" title={t("settings.whatsNew")} onPress={() => router.push("/settings/changelog" as any)} />
        </Section>

        <Section title={t("settings.support")}>
          <SettingsRow icon="download-outline" title={t("settings.checkUpdates")} subtitle="Securely checks the production update channel" onPress={() => void checkForAppUpdate("manual")} />
          <Divider />
          <SettingsRow icon="help-circle-outline" title={t("settings.help")} onPress={() => router.push("/settings/help")} />
          <Divider />
          <SettingsRow icon="document-text-outline" title={t("settings.about")} onPress={() => router.push("/settings/about")} />
        </Section>

        <View style={styles.footer}>
          <Button
            label={t("settings.logout")}
            variant="outline"
            onPress={logout}
            style={{ borderColor: colors.error }}
            textStyle={{ color: colors.error }}
            leftIcon={<Ionicons name="log-out-outline" size={19} color={colors.error} />}
            testID="logout-btn"
          />
          <Text style={[styles.version, { color: colors.onSurfaceTertiary }]}>ONCAMPUS v{version}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={[styles.sectionTitle, { color: colors.onSurfaceTertiary }]}>{title}</Text>
      <View style={[styles.section, { backgroundColor: colors.surfaceSecondary }]}>{children}</View>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 56 }} />;
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  editIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  section: {
    marginHorizontal: spacing.xl,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  footer: { padding: spacing.xl, marginTop: spacing.lg },
  version: { fontSize: 12, fontWeight: "600", textAlign: "center", marginTop: spacing.xl, letterSpacing: 0.5 },
});
