import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import SettingsRow from "@/src/components/SettingsRow";

export default function InstitutionSettings() {
  const { colors } = useTheme();
  const router = useRouter();
  const [state, setState] = useState({
    publicPage: true, autoApproveStudents: false, allowExternalRequests: true,
    membersCanCreateGroups: false, verifiedBadgeVisible: true, weeklyDigest: true,
  });
  const toggle = (k: keyof typeof state) => setState((s) => ({ ...s, [k]: !s[k] }));
  const Sw = (k: keyof typeof state) => (
    <Switch value={state[k]} onValueChange={() => toggle(k)} trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }} thumbColor="#fff" />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="institution-settings-screen">
      <Header title="Institution settings" subtitle="IIT Bombay" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <Section title="Institution profile">
          <SettingsRow icon="business-outline" title="Basic info" subtitle="Name, description, contact" onPress={() => {}} />
          <Divider />
          <SettingsRow icon="color-palette-outline" title="Branding" subtitle="Logo, cover, brand colors" onPress={() => router.push("/institution/branding")} />
          <Divider />
          <SettingsRow icon="location-outline" title="Locations & campuses" subtitle="1 campus configured" onPress={() => {}} />
          <Divider />
          <SettingsRow icon="link-outline" title="Website & social" subtitle="iitb.ac.in · 4 links" onPress={() => {}} />
        </Section>

        <Section title="Verification">
          <SettingsRow
            icon="shield-checkmark"
            iconColor={colors.success}
            iconBg={colors.success + "22"}
            title="Verified status"
            subtitle="Approved · Nov 12, 2025"
            onPress={() => router.push("/institution/verification")}
          />
          <Divider />
          <SettingsRow icon="documents-outline" title="Verification documents" subtitle="3 documents on file" onPress={() => {}} />
        </Section>

        <Section title="Administrators & roles">
          <SettingsRow icon="people-outline" title="Institution admins" subtitle="4 admins" onPress={() => router.push("/institution/admins")} />
          <Divider />
          <SettingsRow icon="lock-closed-outline" title="Permissions" subtitle="Role-based access control" onPress={() => {}} />
          <Divider />
          <SettingsRow icon="time-outline" title="Admin activity log" subtitle="Every action, audited" onPress={() => {}} />
        </Section>

        <Section title="Community controls">
          <SettingsRow icon="globe-outline" title="Public institution page" subtitle="Visible in Discover" right={Sw("publicPage")} />
          <Divider />
          <SettingsRow icon="checkmark-done-outline" title="Auto-approve verified students" subtitle="Using domain email match" right={Sw("autoApproveStudents")} />
          <Divider />
          <SettingsRow icon="clipboard-outline" title="Allow external post requests" subtitle="Non-members can submit posters" right={Sw("allowExternalRequests")} />
          <Divider />
          <SettingsRow icon="add-circle-outline" title="Members can create groups" right={Sw("membersCanCreateGroups")} />
          <Divider />
          <SettingsRow icon="ribbon-outline" title="Show verified badge everywhere" right={Sw("verifiedBadgeVisible")} />
        </Section>

        <Section title="Content moderation">
          <SettingsRow icon="filter-outline" title="Content filters" subtitle="12 blocked keywords" onPress={() => {}} />
          <Divider />
          <SettingsRow icon="flag-outline" title="Report queue" subtitle="0 open reports" onPress={() => {}} />
          <Divider />
          <SettingsRow icon="ban-outline" title="Banned users" subtitle="2 users banned" onPress={() => {}} />
          <Divider />
          <SettingsRow icon="alert-circle-outline" title="Slow mode & rate limits" onPress={() => {}} />
        </Section>

        <Section title="Notifications & digests">
          <SettingsRow icon="mail-outline" title="Weekly admin digest" subtitle="Every Monday, 9 AM" right={Sw("weeklyDigest")} />
          <Divider />
          <SettingsRow icon="notifications-outline" title="Push notification channels" onPress={() => {}} />
        </Section>

        <Section title="Data & compliance">
          <SettingsRow icon="download-outline" title="Export institution data" subtitle="Members, posts, analytics" onPress={() => {}} />
          <Divider />
          <SettingsRow icon="document-text-outline" title="Data processing agreement" onPress={() => {}} />
          <Divider />
          <SettingsRow icon="lock-open-outline" title="Two-factor authentication" subtitle="Required for all admins" onPress={() => {}} />
        </Section>

        <Section title="Billing & plan">
          <SettingsRow
            icon="star"
            iconColor={colors.warning}
            iconBg={colors.warning + "22"}
            title="Current plan"
            subtitle="Verified · Free tier"
            value="Upgrade"
            onPress={() => {}}
          />
          <Divider />
          <SettingsRow icon="card-outline" title="Payment methods" onPress={() => {}} />
          <Divider />
          <SettingsRow icon="receipt-outline" title="Invoices" onPress={() => {}} />
        </Section>

        <Section title="Danger zone">
          <SettingsRow icon="pause-circle-outline" title="Pause institution page" destructive onPress={() => {}} />
          <Divider />
          <SettingsRow icon="trash-outline" title="Delete institution account" destructive onPress={() => {}} />
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
function Divider() { const { colors } = useTheme(); return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 68 }} />; }
