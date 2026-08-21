import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import SettingsRow from "@/src/components/SettingsRow";
import { api, clearSession, getUserErrorMessage } from "@/src/lib/api";
import { type InstitutionSettingsData } from "@/src/lib/institution";

export default function InstitutionSettings() {
  const { colors } = useTheme();
  const router = useRouter();
  const [data, setData] = useState<InstitutionSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setData((await api.institutions.settings()) as InstitutionSettingsData);
    } catch (error) {
      Alert.alert("Settings unavailable", getUserErrorMessage(error, "Could not load institution settings."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const institution = data?.institution || null;
  const counts = data?.counts || {};

  const confirmLogout = () => {
    if (loggingOut) return;
    Alert.alert("Log out?", "You can sign in again at any time.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => void logout() },
    ]);
  };

  const logout = async () => {
    setLoggingOut(true);
    try {
      await api.auth.logout().catch(() => undefined);
    } finally {
      await clearSession(false);
      setLoggingOut(false);
      router.replace("/(auth)/login" as any);
    }
  };

  const detail = (section: string) => router.push(`/institution/settings-detail?section=${section}` as any);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="institution-settings-screen">
      <Header title="Institution settings" subtitle={institution?.name || "Institution"} onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        <Section title="Institution profile">
          <SettingsRow icon="business-outline" title="Basic info" subtitle={institution?.name || "Not set"} onPress={() => detail("basic")} />
          <Divider />
          <SettingsRow icon="color-palette-outline" title="Branding" subtitle="Logo, cover and brand palette" onPress={() => router.push("/institution/branding")} />
          <Divider />
          <SettingsRow icon="location-outline" title="Location" subtitle={[institution?.city, institution?.state, institution?.country].filter(Boolean).join(", ") || "Not set"} onPress={() => detail("locations")} />
          <Divider />
          <SettingsRow icon="link-outline" title="Website & domain" subtitle={institution?.website || institution?.domain || "Not set"} onPress={() => detail("social")} />
        </Section>

        <Section title="Verification & access">
          <SettingsRow
            icon="shield-checkmark"
            iconColor={institution?.verified_at ? colors.success : colors.warning}
            iconBg={(institution?.verified_at ? colors.success : colors.warning) + "22"}
            title="Verification status"
            subtitle={institution?.verified_at ? "Verified institution" : institution?.status || "Pending"}
            onPress={() => router.push("/institution/verification")}
          />
          <Divider />
          <SettingsRow icon="people-outline" title="Institution admins" subtitle="Manage institution administrators" onPress={() => router.push("/institution/admins")} />
          <Divider />
          <SettingsRow icon="key-outline" title="Roles, permissions & audit" subtitle="Custom access, audit trail and secure reports" onPress={() => router.push("/institution/governance" as any)} />
        </Section>

        <Section title="Moderation">
          <SettingsRow icon="flag-outline" title="Report queue" subtitle={`${counts.reports || 0} open reports`} onPress={() => detail("reports")} />
          <Divider />
          <SettingsRow icon="ban-outline" title="Restricted users" subtitle="View institution restrictions" onPress={() => detail("banned")} />
        </Section>

        <Section title="Data & insights">
          <SettingsRow icon="people-outline" title="Members" subtitle={`${counts.members || 0} members`} />
          <Divider />
          <SettingsRow icon="people-circle-outline" title="Groups" subtitle={`${counts.groups || 0} groups`} onPress={() => router.push("/(tabs)/groups")} />
          <Divider />
          <SettingsRow icon="document-text-outline" title="Posts" subtitle={`${counts.posts || 0} posts`} onPress={() => router.push("/(tabs)/feed")} />
          <Divider />
          <SettingsRow icon="stats-chart-outline" title="Analytics" subtitle="Institution metrics" onPress={() => router.push("/institution/analytics")} />
          <Divider />
          <SettingsRow icon="download-outline" title="CSV / PDF exports" subtitle="Students, staff, events and analytics" onPress={() => router.push("/institution/governance" as any)} />
        </Section>

        <Text style={[styles.note, { color: colors.onSurfaceTertiary }]}>
          Student publishing requests and external post-sharing controls are intentionally not exposed. Institution publishing and collaboration are managed through Content Studio.
        </Text>

        <Section title="Account">
          <Pressable onPress={confirmLogout} disabled={loggingOut || loading} style={styles.logoutRow}>
            <View style={[styles.logoutIcon, { backgroundColor: colors.error + "18" }]}>
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.error, fontSize: font.base, fontWeight: "600" }}>{loggingOut ? "Logging out…" : "Log out"}</Text>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>Sign out of this institution account</Text>
            </View>
          </Pressable>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "600", paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</Text>
      <View style={{ marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, overflow: "hidden" }}>{children}</View>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 68 }} />;
}

const styles = StyleSheet.create({
  note: { fontSize: font.sm, lineHeight: 19, marginHorizontal: spacing.xl, marginTop: spacing.lg },
  logoutRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  logoutIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});
