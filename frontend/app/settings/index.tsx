import React, { useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, Platform } from "react-native";
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
import { clearSession } from "@/src/lib/api";

export default function Settings() {
  const { colors, mode } = useTheme();
  const { user } = useRole();
  const router = useRouter();
  const version = Constants.expoConfig?.version || "1.0.0";
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const logout = async () => {
    if (Platform.OS === "ios") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await clearSession(false);
    router.replace("/(auth)/welcome");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background || colors.surface }} edges={["top"]} testID="settings-screen">
      <Header title="Settings" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 70 }}>
        <Pressable onPress={() => router.push("/settings/edit-profile")} onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start()} onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}>
          <Animated.View style={[styles.profileCard, { backgroundColor: colors.surfaceSecondary || colors.surface, borderColor: colors.border, transform: [{ scale: scaleAnim }] }]}>
            <Avatar uri={user?.avatarUrl} name={user?.name || "You"} size={60} verified={user?.verified} />
            <View style={{ flex: 1 }}><Text style={{ color: colors.textPrimary || colors.onSurface, fontSize: 18, fontWeight: "700" }}>{user?.name || "Complete your profile"}</Text><Text style={{ color: colors.textSecondary || colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 4 }}>{user?.course || user?.bio || "Essential profile details"}</Text></View>
            <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceTertiary} />
          </Animated.View>
        </Pressable>

        <Section title="Preferences">
          <SettingsRow icon="color-palette" title="Appearance" value={mode === "system" ? "Auto" : mode === "dark" ? "Dark" : "Light"} onPress={() => router.push("/settings/theme")} />
          <Divider />
          <SettingsRow icon="notifications" title="Notifications" subtitle="Simple notification categories" onPress={() => router.push("/settings/notifications")} />
          <Divider />
          <SettingsRow icon="language" title="Language" value="English" onPress={() => router.push("/settings/language")} />
        </Section>

        <Section title="Privacy & safety">
          <SettingsRow icon="lock-closed" title="Privacy" onPress={() => router.push("/settings/privacy")} />
          <Divider />
          <SettingsRow icon="shield-checkmark" title="Blocked users" onPress={() => router.push("/settings/blocked")} />
          <Divider />
          <SettingsRow icon="bug" title="Report a problem" onPress={() => router.push("/settings/report")} />
        </Section>

        <Section title="Your OnCampus">
          <SettingsRow icon="bookmark" title="Saved posts" onPress={() => router.push("/saved")} />
          <Divider />
          <SettingsRow icon="time" title="Recent activity" onPress={() => router.push("/settings/activity")} />
          <Divider />
          <SettingsRow icon="cloud-download" title="Storage & data" onPress={() => router.push("/settings/storage")} />
          <Divider />
          <SettingsRow icon="sparkles" title="What’s new" onPress={() => router.push("/settings/changelog" as any)} />
        </Section>

        <Section title="App">
          <SettingsRow icon="download-outline" title="Check for updates" value={`v${version}`} onPress={() => void checkForAppUpdate(true)} />
          <Divider />
          <SettingsRow icon="help-circle" title="Help center" onPress={() => router.push("/settings/help")} />
          <Divider />
          <SettingsRow icon="document-text" title="About & policies" onPress={() => router.push("/settings/about")} />
        </Section>

        <View style={{ padding: spacing.xl, marginTop: spacing.lg }}>
          <Button label="Log Out" variant="outline" onPress={logout} style={{ borderColor: colors.error || "#ef4444" }} textStyle={{ color: colors.error || "#ef4444" }} leftIcon={<Ionicons name="log-out-outline" size={20} color={colors.error || "#ef4444"} />} testID="logout-btn" />
          <Text style={{ color: colors.textSecondary || colors.muted, fontSize: 11, fontWeight: "600", textAlign: "center", marginTop: spacing.xl }}>ONCAMPUS v{version}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={{ marginTop: spacing.md }}><Text style={{ color: colors.textSecondary || colors.onSurfaceTertiary, fontSize: 12, fontWeight: "700", paddingHorizontal: spacing.xl, marginTop: spacing.md, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 1 }}>{title}</Text><View style={[styles.section, { backgroundColor: colors.surfaceSecondary || colors.surface }]}>{children}</View></View>;
}
function Divider() { const { colors } = useTheme(); return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border || colors.divider, marginLeft: 56 }} />; }
const styles = StyleSheet.create({
  profileCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.xl, marginTop: spacing.lg, marginBottom: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  section: { marginHorizontal: spacing.xl, borderRadius: radius.lg, overflow: "hidden" },
});
