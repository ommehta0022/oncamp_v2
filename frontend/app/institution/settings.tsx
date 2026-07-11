import React, { useEffect, useState } from "react";
import { Alert, View, Text, StyleSheet, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import SettingsRow from "@/src/components/SettingsRow";
import { api } from "@/src/lib/api";
import {
  DEFAULT_POLICY,
  formatDate,
  formatNumber,
  getInstitutionName,
  getInstitutionSubtitle,
  getPolicy,
  isVerified,
  type InstitutionDashboardData,
  type InstitutionRecord,
  type InstitutionSettingsData,
} from "@/src/lib/institution";

type PolicyKey = keyof typeof DEFAULT_POLICY;

export default function InstitutionSettings() {
  const { colors } = useTheme();
  const router = useRouter();
  const [institution, setInstitution] = useState<InstitutionRecord | null>(null);
  const [counts, setCounts] = useState<any>({});
  const [policy, setPolicy] = useState(DEFAULT_POLICY);
  const [verificationDocs, setVerificationDocs] = useState(0);
  const [adminsCount, setAdminsCount] = useState(0);

  useEffect(() => {
    api.institutions.settings()
      .then((data: any) => {
        const typed = data as InstitutionSettingsData;
        const request = typed.request;
        const displayInstitution = typed.institution || (request ? {
          name: request.institution_name,
          description: request.description,
          city: request.city,
          state: request.state,
          country: request.country,
          website: request.website,
          phone: request.phone,
          domain: request.domain,
          logo_url: request.logo_url,
          status: request.status || "pending",
        } as InstitutionRecord : null);
        setInstitution(displayInstitution);
        setCounts(typed.counts || {});
        setPolicy({ ...DEFAULT_POLICY, ...(typed.policy || {}) });
      })
      .catch(() => {});
    api.institutions.dashboard()
      .then((data: any) => {
        const typed = data as InstitutionDashboardData;
        if (typed.institution) {
          setInstitution(typed.institution);
          setPolicy((current) => ({ ...current, ...getPolicy(typed.institution) }));
        }
        setCounts((current: any) => Object.keys(current || {}).length ? current : typed.counts || {});
        setVerificationDocs((typed.verificationRequests || []).filter((request) => request.logo_url || request.document_url).length);
      })
      .catch(() => {});
    api.institutions.admins()
      .then((rows: any) => setAdminsCount(Array.isArray(rows) ? rows.length : 0))
      .catch(() => setAdminsCount(0));
  }, []);

  const toggle = async (key: PolicyKey) => {
    if (typeof policy[key] !== "boolean") return;
    const previous = policy;
    const next = { ...policy, [key]: !policy[key] };
    setPolicy(next);
    try {
      await api.institutions.updateSettings({ policy: { [key]: next[key] } });
    } catch {
      try {
        await api.institutions.updateMe({ verificationPolicy: next });
      } catch {
        setPolicy(previous);
        Alert.alert("Setting not saved", "Please check your connection and try again.");
      }
    }
  };

  const Sw = (key: PolicyKey) => (
    <Switch value={Boolean(policy[key])} onValueChange={() => toggle(key)} trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }} thumbColor="#fff" />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="institution-settings-screen">
      <Header title="Institution settings" subtitle={getInstitutionName(institution)} onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <Section title="Institution profile">
          <SettingsRow icon="business-outline" title="Basic info" subtitle={institution?.description || "Name, description, contact"} onPress={() => router.push("/institution/settings-detail?section=basic" as any)} />
          <Divider />
          <SettingsRow icon="color-palette-outline" title="Branding" subtitle="Logo, cover, brand colors" onPress={() => router.push("/institution/branding")} />
          <Divider />
          <SettingsRow icon="location-outline" title="Locations & campuses" subtitle={getInstitutionSubtitle(institution)} onPress={() => router.push("/institution/settings-detail?section=locations" as any)} />
          <Divider />
          <SettingsRow icon="link-outline" title="Website & social" subtitle={institution?.website || "Website not set"} onPress={() => router.push("/institution/settings-detail?section=social" as any)} />
        </Section>

        <Section title="Verification">
          <SettingsRow icon="shield-checkmark" iconColor={isVerified(institution) ? colors.success : colors.warning} iconBg={(isVerified(institution) ? colors.success : colors.warning) + "22"} title="Verified status" subtitle={isVerified(institution) ? `Approved - ${formatDate(institution?.verified_at || institution?.verifiedAt)}` : String(institution?.status || "Pending")} onPress={() => router.push("/institution/verification")} />
          <Divider />
          <SettingsRow icon="documents-outline" title="Verification documents" subtitle={`${formatNumber(verificationDocs)} documents on file`} onPress={() => router.push("/institution/verification")} />
        </Section>

        <Section title="Administrators & roles">
          <SettingsRow icon="people-outline" title="Institution admins" subtitle={`${formatNumber(adminsCount)} admins`} onPress={() => router.push("/institution/admins")} />
          <Divider />
          <SettingsRow icon="lock-closed-outline" title="Permissions" subtitle="Role-based access control" onPress={() => router.push("/institution/settings-detail?section=permissions" as any)} />
          <Divider />
          <SettingsRow icon="time-outline" title="Admin activity log" subtitle="Every action, audited" onPress={() => router.push("/institution/settings-detail?section=activity" as any)} />
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
          <SettingsRow icon="filter-outline" title="Content filters" subtitle="Managed by moderation rules" onPress={() => router.push("/institution/settings-detail?section=filters" as any)} />
          <Divider />
          <SettingsRow icon="flag-outline" title="Report queue" subtitle="Open reports from the moderation API" onPress={() => router.push("/institution/settings-detail?section=reports" as any)} />
          <Divider />
          <SettingsRow icon="ban-outline" title="Banned users" subtitle="Institution ban controls" onPress={() => router.push("/institution/settings-detail?section=banned" as any)} />
          <Divider />
          <SettingsRow icon="alert-circle-outline" title="Slow mode & rate limits" onPress={() => router.push("/institution/settings-detail?section=slowmode" as any)} />
        </Section>

        <Section title="Notifications & digests">
          <SettingsRow icon="mail-outline" title="Weekly admin digest" subtitle="Every Monday, 9 AM" right={Sw("weeklyDigest")} />
          <Divider />
          <SettingsRow icon="notifications-outline" title="Push notification channels" onPress={() => router.push("/institution/settings-detail?section=push" as any)} />
        </Section>

        <Section title="Data & compliance">
          <SettingsRow icon="download-outline" title="Export institution data" subtitle={`${formatNumber(counts.members)} members, ${formatNumber(counts.posts)} posts`} onPress={() => router.push("/institution/settings-detail?section=export" as any)} />
          <Divider />
          <SettingsRow icon="document-text-outline" title="Data processing agreement" onPress={() => router.push("/institution/settings-detail?section=dpa" as any)} />
          <Divider />
          <SettingsRow icon="lock-open-outline" title="Two-factor authentication" subtitle="Required for all admins" onPress={() => router.push("/institution/settings-detail?section=twofactor" as any)} />
        </Section>

        <Section title="Billing & plan">
          <SettingsRow icon="star" iconColor={colors.warning} iconBg={colors.warning + "22"} title="Current plan" subtitle="Verified - Free tier" value="Upgrade" onPress={() => router.push("/institution/settings-detail?section=plan" as any)} />
          <Divider />
          <SettingsRow icon="card-outline" title="Payment methods" onPress={() => router.push("/institution/settings-detail?section=payments" as any)} />
          <Divider />
          <SettingsRow icon="receipt-outline" title="Invoices" onPress={() => router.push("/institution/settings-detail?section=invoices" as any)} />
        </Section>

        <Section title="Danger zone">
          <SettingsRow icon="pause-circle-outline" title="Pause institution page" destructive onPress={() => router.push("/institution/settings-detail?section=pause" as any)} />
          <Divider />
          <SettingsRow icon="trash-outline" title="Delete institution account" destructive onPress={() => router.push("/institution/settings-detail?section=delete" as any)} />
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
