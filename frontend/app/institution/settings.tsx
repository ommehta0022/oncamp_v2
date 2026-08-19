import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import SettingsRow from "@/src/components/SettingsRow";
import { api, clearSession, getUserErrorMessage } from "@/src/lib/api";
import { DEFAULT_POLICY, getPalette, type InstitutionPolicy, type InstitutionSettingsData } from "@/src/lib/institution";

export default function InstitutionSettings() {
  const { colors } = useTheme();
  const router = useRouter();
  const [data, setData] = useState<InstitutionSettingsData | null>(null);
  const [policy, setPolicy] = useState<InstitutionPolicy>({ ...DEFAULT_POLICY });
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const next = (await api.institutions.settings()) as InstitutionSettingsData;
      setData(next);
      setPolicy({ ...DEFAULT_POLICY, ...(next.policy || {}) });
    } catch (error) {
      Alert.alert("Settings unavailable", getUserErrorMessage(error, "Could not load institution settings."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const institution = data?.institution || null;
  const counts = data?.counts || {};
  const palette = getPalette(institution);

  const updatePolicy = async (key: keyof InstitutionPolicy, value: any) => {
    if (savingKey) return;
    const previous = policy;
    const next = { ...policy, [key]: value } as InstitutionPolicy;
    setPolicy(next);
    setSavingKey(String(key));
    try {
      const result = (await api.institutions.updateSettings({ policy: { [key]: value } })) as any;
      if (result?.policy) setPolicy({ ...DEFAULT_POLICY, ...result.policy });
    } catch (error) {
      setPolicy(previous);
      Alert.alert("Save failed", getUserErrorMessage(error, "Could not update this institution setting."));
    } finally {
      setSavingKey(null);
    }
  };

  const toggleExternalRequests = () => void updatePolicy("allowExternalRequests", !policy.allowExternalRequests);

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
          <SettingsRow
            icon="location-outline"
            title="Location"
            subtitle={[institution?.city, institution?.state, institution?.country].filter(Boolean).join(", ") || "Not set"}
            onPress={() => detail("locations")}
          />
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
          <SettingsRow icon="time-outline" title="Admin activity" subtitle="Audited institution actions" onPress={() => detail("activity")} />
        </Section>

        <Section title="Community controls">
          <SettingsRow
            icon="clipboard-outline"
            title="Allow external post requests"
            subtitle={policy.allowExternalRequests ? "Members can submit post requests" : "External requests are blocked"}
            right={
              <Switch
                value={!!policy.allowExternalRequests}
                disabled={savingKey === "allowExternalRequests" || loading}
                onValueChange={toggleExternalRequests}
                trackColor={{ true: palette.primary, false: colors.borderStrong }}
                thumbColor="#fff"
              />
            }
          />
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
          <SettingsRow icon="download-outline" title="Export institution data" subtitle="Generate the current JSON export" onPress={() => detail("export")} />
        </Section>

        <Text style={[styles.note, { color: colors.onSurfaceTertiary }]}>
          Only controls that are enforced by the current backend are shown here. Unsupported placeholder switches have been removed until their backend enforcement is implemented.
        </Text>

        <Section title="Account">
          <Pressable onPress={confirmLogout} disabled={loggingOut} style={styles.logoutRow}>
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
