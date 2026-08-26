import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";

import { useTheme } from "@/src/theme/ThemeProvider";
import { font, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import SettingsRow from "@/src/components/SettingsRow";
import Avatar from "@/src/components/Avatar";
import Button from "@/src/components/Button";
import { checkForAppUpdate } from "@/src/components/AppUpdateGate";
import { useRole } from "@/src/context/RoleProvider";
import { useLanguage } from "@/src/context/LanguageProvider";
import { clearSession } from "@/src/lib/api";

const APP_ICON = require("../../assets/images/icon.png");

export default function Settings() {
  const { colors, mode } = useTheme();
  const { user } = useRole();
  const { t } = useLanguage();
  const router = useRouter();
  const version = String(Constants.expoConfig?.version || "");

  const logout = async () => {
    if (Platform.OS === "ios") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await clearSession(false);
    router.replace("/(auth)/welcome");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="settings-screen">
      <Header title={t("settings.title")} onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Pressable onPress={() => router.push("/settings/edit-profile")} style={({ pressed }) => [styles.profileRow, { backgroundColor: pressed ? colors.surfaceTertiary : "transparent", borderBottomColor: colors.divider }]} accessibilityRole="button" accessibilityLabel="Edit profile">
          <Avatar uri={user?.avatarUrl} name={user?.name || "You"} size={58} verified={user?.verified} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "800", letterSpacing: -0.25 }}>{user?.name || "Your profile"}</Text>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 3 }}>{user?.course || "Profile and account identity"}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
        </Pressable>

        <Section title={t("settings.preferences")}>
          <SettingsRow icon="contrast-outline" title={t("settings.appearance")} value={mode === "dark" ? "Dark" : "Light"} subtitle="Light or dark appearance" onPress={() => router.push("/settings/theme")} />
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
          <SettingsRow icon="flag-outline" title={t("settings.report")} onPress={() => router.push("/settings/report")} />
        </Section>

        <Section title={t("settings.yourCampus")}>
          <SettingsRow icon="bookmark-outline" title={t("settings.saved")} onPress={() => router.push("/saved")} />
          <Divider />
          <SettingsRow icon="time-outline" title={t("settings.activity")} onPress={() => router.push("/settings/activity")} />
          <Divider />
          <SettingsRow icon="cloud-download-outline" title={t("settings.storage")} onPress={() => router.push("/settings/storage")} />
          <Divider />
          <SettingsRow icon="gift-outline" title={t("settings.whatsNew")} onPress={() => router.push("/settings/changelog" as any)} />
        </Section>

        <Section title={t("settings.support")}>
          <SettingsRow icon="download-outline" title={t("settings.checkUpdates")} subtitle="Check OTA and Android updates" value={version ? `v${version}` : undefined} onPress={() => void checkForAppUpdate("manual", true, true)} />
          <Divider />
          <SettingsRow icon="help-circle-outline" title={t("settings.help")} onPress={() => router.push("/settings/help")} />
          <Divider />
          <SettingsRow icon="information-circle-outline" title={t("settings.about")} onPress={() => router.push("/settings/about")} />
        </Section>

        <View style={styles.appIdentity}>
          <Image source={APP_ICON} style={styles.appIcon} contentFit="cover" />
          <Text style={{ color: colors.onSurface, fontWeight: "800", fontSize: 14 }}>OnCampus</Text>
          {version ? <Text style={{ color: colors.onSurfaceTertiary, fontSize: 11 }}>Version {version}</Text> : null}
        </View>

        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
          <Button label={t("settings.logout")} variant="outline" onPress={logout} style={{ borderColor: colors.error }} textStyle={{ color: colors.error }} leftIcon={<Ionicons name="log-out-outline" size={20} color={colors.error} />} testID="logout-btn" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionWrap}>
      <Text style={[styles.sectionTitle, { color: colors.onSurfaceTertiary }]}>{title}</Text>
      <View style={[styles.section, { borderTopColor: colors.divider, borderBottomColor: colors.divider }]}>{children}</View>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 62 }} />;
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 70 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionWrap: { marginTop: 26 },
  sectionTitle: { paddingHorizontal: spacing.xl, marginBottom: 9, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.85 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  appIdentity: { alignItems: "center", gap: 5, paddingTop: 34 },
  appIcon: { width: 42, height: 42, borderRadius: 13, marginBottom: 2 },
});
