import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import SettingsRow from "@/src/components/SettingsRow";
import { api } from "@/src/lib/api";

const defaults = {
  publicPage: true,
  autoApproveStudents: false,
  allowExternalRequests: true,
  membersCanCreateGroups: false,
  verifiedBadgeVisible: true,
  weeklyDigest: true,
};

export default function InstitutionSettings() {
  const { colors } = useTheme();
  const router = useRouter();
  const [institution, setInstitution] = useState<any>(null);
  const [counts, setCounts] = useState<any>({});
  const [state, setState] = useState(defaults);

  useEffect(() => {
    api.institutions.dashboard()
      .then((data: any) => {
        setInstitution(data.institution || null);
        setCounts(data.counts || {});
        setState({ ...defaults, ...(data.institution?.verification_policy || {}) });
      })
      .catch(() => {});
  }, []);

  const toggle = (key: keyof typeof state) => {
    const next = { ...state, [key]: !state[key] };
    setState(next);
    api.institutions.updateMe({ verificationPolicy: next }).catch(() => {});
  };

  const Sw = (key: keyof typeof state) => (
    <Switch value={state[key]} onValueChange={() => toggle(key)} trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }} thumbColor="#fff" />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="institution-settings-screen">
      <Header title="Institution settings" subtitle={institution?.name || "Institution"} onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <Section title="Institution profile">
          <SettingsRow icon="business-outline" title="Basic info" subtitle={institution?.name || "Not set"} onPress={() => router.push("/institution/branding")} />
          <Divider />
          <SettingsRow icon="color-palette-outline" title="Branding" subtitle="Logo, cover, public profile" onPress={() => router.push("/institution/branding")} />
          <Divider />
          <SettingsRow icon="location-outline" title="Location" subtitle={[institution?.city, institution?.state, institution?.country].filter(Boolean).join(", ") || "Not set"} onPress={() => router.push("/institution/branding")} />
          <Divider />
          <SettingsRow icon="link-outline" title="Website" subtitle={institution?.website || "Not set"} onPress={() => router.push("/institution/branding")} />
        </Section>

        <Section title="Verification">
          <SettingsRow icon="shield-checkmark" iconColor={institution?.verified_at ? colors.success : colors.warning} iconBg={(institution?.verified_at ? colors.success : colors.warning) + "22"} title="Verified status" subtitle={institution?.verified_at ? `Verified ${institution.verified_at}` : institution?.status || "Pending"} onPress={() => router.push("/institution/verification")} />
        </Section>

        <Section title="Administrators & roles">
          <SettingsRow icon="people-outline" title="Institution admins" subtitle="Fetched from institution_admins" onPress={() => router.push("/institution/admins")} />
        </Section>

        <Section title="Community controls">
          <SettingsRow icon="globe-outline" title="Public institution page" subtitle="Visible in Discover" right={Sw("publicPage")} />
          <Divider />
          <SettingsRow icon="shield-checkmark-outline" title="Auto-approve verified students" subtitle="Using approved verification policy" right={Sw("autoApproveStudents")} />
          <Divider />
          <SettingsRow icon="clipboard-outline" title="Allow external post requests" right={Sw("allowExternalRequests")} />
          <Divider />
          <SettingsRow icon="add-circle-outline" title="Members can create groups" right={Sw("membersCanCreateGroups")} />
          <Divider />
          <SettingsRow icon="ribbon-outline" title="Show verified badge" right={Sw("verifiedBadgeVisible")} />
        </Section>

        <Section title="Data">
          <SettingsRow icon="people-outline" title="Members" subtitle={`${counts.members || 0} real members`} />
          <Divider />
          <SettingsRow icon="people-circle-outline" title="Groups" subtitle={`${counts.groups || 0} real groups`} onPress={() => router.push("/(tabs)/groups")} />
          <Divider />
          <SettingsRow icon="document-text-outline" title="Posts" subtitle={`${counts.posts || 0} real posts`} onPress={() => router.push("/(tabs)/feed")} />
          <Divider />
          <SettingsRow icon="stats-chart-outline" title="Analytics" subtitle="Real Supabase metrics" onPress={() => router.push("/institution/analytics")} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "500", paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</Text>
      <View style={{ marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, overflow: "hidden" }}>{children}</View>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 68 }} />;
}
