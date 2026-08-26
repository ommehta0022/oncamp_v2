import React, { useRef } from "react";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";

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

const APP_ICON = require("../../assets/images/icon.png");

export default function Settings() {
  const { colors, mode } = useTheme();
  const { user } = useRole();
  const { t } = useLanguage();
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;
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
        <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.brandHero}>
          <View style={styles.brandTop}>
            <Image source={APP_ICON} style={styles.appIcon} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>YOUR ONCAMPUS</Text>
              <Text style={styles.heroTitle}>Refined around you.</Text>
            </View>
            <View style={styles.versionPill}><Text style={styles.versionText}>v{version}</Text></View>
          </View>
          <Text style={styles.heroBody}>Appearance, privacy, campus tools and updates — all in one calm, premium control center.</Text>
        </LinearGradient>

        <Pressable
          onPress={() => router.push("/settings/edit-profile")}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start()}
          onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
        >
          <Animated.View style={[styles.profileCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, shadowColor: colors.shadow, transform: [{ scale: scaleAnim }] }]}>
            <View style={[styles.avatarShell, { borderColor: colors.luxuryGold }]}><Avatar uri={user?.avatarUrl} name={user?.name || "You"} size={58} verified={user?.verified} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "900" }}>{user?.name || "Complete your profile"}</Text>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 4 }}>{user?.course || "Essential profile details"}</Text>
              <View style={[styles.profileBadge, { backgroundColor: colors.luxuryGoldSoft }]}><Ionicons name="sparkles" size={11} color={colors.luxuryGold} /><Text style={{ color: colors.luxuryGold, fontSize: 10, fontWeight: "900" }}>PROFILE & IDENTITY</Text></View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceTertiary} />
          </Animated.View>
        </Pressable>

        <Section title={t("settings.preferences")} icon="options-outline">
          <SettingsRow icon="color-palette" title={t("settings.appearance")} value={mode === "dark" ? "Obsidian" : "Pearl"} subtitle="Premium Light and Dark themes" onPress={() => router.push("/settings/theme")} />
          <Divider />
          <SettingsRow icon="notifications" title={t("settings.notifications")} subtitle="Campus, community and device alerts" onPress={() => router.push("/settings/notifications")} />
          <Divider />
          <SettingsRow icon="language" title={t("settings.language")} onPress={() => router.push("/settings/language")} />
        </Section>

        <Section title={t("settings.privacySafety")} icon="shield-checkmark-outline">
          <SettingsRow icon="lock-closed" title={t("settings.privacy")} onPress={() => router.push("/settings/privacy")} />
          <Divider />
          <SettingsRow icon="shield-checkmark" title={t("settings.blocked")} onPress={() => router.push("/settings/blocked")} />
          <Divider />
          <SettingsRow icon="bug" title={t("settings.report")} onPress={() => router.push("/settings/report")} />
        </Section>

        <Section title={t("settings.yourCampus")} icon="school-outline">
          <SettingsRow icon="bookmark" title={t("settings.saved")} onPress={() => router.push("/saved")} />
          <Divider />
          <SettingsRow icon="time" title={t("settings.activity")} onPress={() => router.push("/settings/activity")} />
          <Divider />
          <SettingsRow icon="cloud-download" title={t("settings.storage")} onPress={() => router.push("/settings/storage")} />
          <Divider />
          <SettingsRow icon="sparkles" title={t("settings.whatsNew")} onPress={() => router.push("/settings/changelog" as any)} />
        </Section>

        <Section title={t("settings.support")} icon="sparkles-outline">
          <SettingsRow icon="download-outline" title={t("settings.checkUpdates")} subtitle="One secure check for OTA and Android updates" value={version ? `v${version}` : undefined} onPress={() => void checkForAppUpdate("manual", true, true)} />
          <Divider />
          <SettingsRow icon="help-circle" title={t("settings.help")} onPress={() => router.push("/settings/help")} />
          <Divider />
          <SettingsRow icon="document-text" title={t("settings.about")} onPress={() => router.push("/settings/about")} />
        </Section>

        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl }}>
          <Button label={t("settings.logout")} variant="outline" onPress={logout} style={{ borderColor: colors.error }} textStyle={{ color: colors.error }} leftIcon={<Ionicons name="log-out-outline" size={20} color={colors.error} />} testID="logout-btn" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: spacing.lg }}>
      <View style={styles.sectionTitleRow}>
        <View style={[styles.sectionIcon, { backgroundColor: colors.luxuryGoldSoft }]}><Ionicons name={icon} size={13} color={colors.luxuryGold} /></View>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 }}>{title}</Text>
      </View>
      <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, shadowColor: colors.shadow }]}>{children}</View>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 58 }} />;
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 70 },
  brandHero: { marginHorizontal: spacing.xl, marginTop: spacing.md, padding: 20, borderRadius: 28, minHeight: 166 },
  brandTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  appIcon: { width: 50, height: 50, borderRadius: 16 },
  heroEyebrow: { color: "#D9C486", fontSize: 9, fontWeight: "900", letterSpacing: 1.3 },
  heroTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", letterSpacing: -0.5, marginTop: 3 },
  heroBody: { color: "rgba(255,255,255,0.76)", fontSize: 13, lineHeight: 19, marginTop: 20, maxWidth: 340 },
  versionPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.1)" },
  versionText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  profileCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.xl, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, shadowOpacity: 0.05, shadowRadius: 13, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  avatarShell: { padding: 2, borderRadius: 34, borderWidth: 1 },
  profileBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, marginTop: 8 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  sectionIcon: { width: 26, height: 26, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  section: { marginHorizontal: spacing.xl, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
});
