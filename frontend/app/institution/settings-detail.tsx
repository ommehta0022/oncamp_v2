import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import Header from "@/src/components/Header";
import SettingsRow from "@/src/components/SettingsRow";
import { api, getUserErrorMessage } from "@/src/lib/api";
import {
  DEFAULT_POLICY,
  formatAgo,
  formatDate,
  formatNumber,
  getInstitutionName,
  type InstitutionPolicy,
  type InstitutionRecord,
  type InstitutionSettingsData,
} from "@/src/lib/institution";
import { font, radius, spacing } from "@/src/theme/colors";

const SECTIONS: Record<string, { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }> = {
  basic: { title: "Basic info", subtitle: "Name, description, contact", icon: "business-outline" },
  locations: { title: "Locations & campuses", subtitle: "City, state, country", icon: "location-outline" },
  social: { title: "Website & social", subtitle: "Website and domain", icon: "link-outline" },
  permissions: { title: "Permissions", subtitle: "Role-based access control", icon: "lock-closed-outline" },
  activity: { title: "Admin activity log", subtitle: "Every action, audited", icon: "time-outline" },
  filters: { title: "Content filters", subtitle: "Blocked words and moderation rules", icon: "filter-outline" },
  reports: { title: "Report queue", subtitle: "Open reports from members", icon: "flag-outline" },
  banned: { title: "Banned users", subtitle: "Restricted users", icon: "ban-outline" },
  slowmode: { title: "Slow mode & rate limits", subtitle: "Posting cooldown controls", icon: "alert-circle-outline" },
  push: { title: "Push notification channels", subtitle: "Admin alert routing", icon: "notifications-outline" },
  export: { title: "Export institution data", subtitle: "Members, posts, groups, admins", icon: "download-outline" },
  dpa: { title: "Data processing agreement", subtitle: "Compliance acceptance", icon: "document-text-outline" },
  twofactor: { title: "Two-factor authentication", subtitle: "Require all admins to use 2FA", icon: "lock-open-outline" },
  plan: { title: "Current plan", subtitle: "Billing tier", icon: "star" },
  payments: { title: "Payment methods", subtitle: "Billing contact details", icon: "card-outline" },
  invoices: { title: "Invoices", subtitle: "Billing history", icon: "receipt-outline" },
  pause: { title: "Pause institution page", subtitle: "Hide public discovery", icon: "pause-circle-outline" },
  delete: { title: "Delete institution account", subtitle: "Request permanent removal", icon: "trash-outline" },
};

const PERMISSIONS = [
  { key: "manage_profile", label: "Manage profile" },
  { key: "manage_admins", label: "Manage admins" },
  { key: "moderation", label: "Moderation" },
  { key: "analytics", label: "Analytics" },
  { key: "billing", label: "Billing" },
];

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  content_admin: "Content admin",
  moderator: "Moderator",
};

export default function InstitutionSettingsDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
  const section = String(params.section || "basic");
  const meta = SECTIONS[section] || SECTIONS.basic;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<InstitutionSettingsData | null>(null);
  const [policy, setPolicy] = useState<InstitutionPolicy>({ ...DEFAULT_POLICY });
  const [profile, setProfile] = useState({
    name: "",
    description: "",
    phone: "",
    city: "",
    state: "",
    country: "",
    website: "",
    domain: "",
  });
  const [newFilter, setNewFilter] = useState("");
  const [slowSeconds, setSlowSeconds] = useState("30");

  const institution = data?.institution || null;
  const request = data?.request;
  const displayName = getInstitutionName(institution as InstitutionRecord | null, request ? [request] : []);

  const load = async () => {
    try {
      setLoading(true);
      const next = (await api.institutions.settings()) as InstitutionSettingsData;
      setData(next);
      setPolicy({ ...DEFAULT_POLICY, ...(next.policy || {}) });
      setSlowSeconds(String(next.policy?.slowMode?.seconds || DEFAULT_POLICY.slowMode.seconds));
      const source = next.institution || next.request || {};
      setProfile({
        name: source.name || source.institution_name || "",
        description: source.description || "",
        phone: source.phone || "",
        city: source.city || "",
        state: source.state || "",
        country: source.country || "",
        website: source.website || "",
        domain: source.domain || (source.official_email ? String(source.official_email).split("@")[1] : ""),
      });
    } catch (error) {
      Alert.alert("Settings unavailable", getUserErrorMessage(error, "Could not load institution settings."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveProfile = async (fields: Partial<typeof profile>) => {
    try {
      setSaving(true);
      await api.institutions.updateSettings({ profile: fields });
      await load();
      Alert.alert("Saved", "Institution details updated.");
    } catch (error) {
      Alert.alert("Save failed", getUserErrorMessage(error, "Could not update institution details."));
    } finally {
      setSaving(false);
    }
  };

  const savePolicy = async (partial: Partial<InstitutionPolicy>, quiet = true) => {
    const next = { ...policy, ...partial } as InstitutionPolicy;
    setPolicy(next);
    try {
      await api.institutions.updateSettings({ policy: partial });
      if (!quiet) Alert.alert("Saved", "Institution setting updated.");
    } catch (error) {
      setPolicy(policy);
      Alert.alert("Save failed", getUserErrorMessage(error, "Could not update this setting."));
    }
  };

  const runAction = async (action: "pause" | "resume" | "request_delete") => {
    try {
      setSaving(true);
      const result = (await api.institutions.updateSettings({ action })) as any;
      if (result.policy) setPolicy({ ...DEFAULT_POLICY, ...result.policy });
      await load();
    } catch (error) {
      Alert.alert("Action failed", getUserErrorMessage(error, "Could not complete this action."));
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = (key: keyof typeof profile, value: string) => setProfile((current) => ({ ...current, [key]: value }));

  const SwitchControl = ({ value, onValueChange }: { value: boolean; onValueChange: () => void }) => (
    <Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }} thumbColor="#fff" />
  );

  const counts = data?.counts || {};
  const billing: any = { ...(data?.billing || {}), ...(policy.billing || {}) };
  const filters = Array.isArray(policy.contentFilters) ? policy.contentFilters : [];
  const slowMode = policy.slowMode || DEFAULT_POLICY.slowMode;
  const channels = policy.pushChannels || DEFAULT_POLICY.pushChannels;

  const renderContent = () => {
    if (loading) return <Loading />;
    if (section === "basic") {
      return (
        <>
          <Hero meta={meta} subtitle={displayName} />
          <Section title="Institution details">
            <Field label="Institution name" value={profile.name} onChangeText={(v: string) => updateProfile("name", v)} />
            <Field label="Description" value={profile.description} onChangeText={(v: string) => updateProfile("description", v)} multiline />
            <Field label="Contact phone" value={profile.phone} onChangeText={(v: string) => updateProfile("phone", v)} keyboardType="phone-pad" />
          </Section>
          <PrimaryButton label="Save basic info" loading={saving} onPress={() => saveProfile({ name: profile.name, description: profile.description, phone: profile.phone })} />
        </>
      );
    }
    if (section === "locations") {
      return (
        <>
          <Hero meta={meta} subtitle={displayName} />
          <Section title="Primary campus">
            <Field label="City" value={profile.city} onChangeText={(v: string) => updateProfile("city", v)} />
            <Field label="State" value={profile.state} onChangeText={(v: string) => updateProfile("state", v)} />
            <Field label="Country" value={profile.country} onChangeText={(v: string) => updateProfile("country", v)} />
          </Section>
          <PrimaryButton label="Save location" loading={saving} onPress={() => saveProfile({ city: profile.city, state: profile.state, country: profile.country })} />
        </>
      );
    }
    if (section === "social") {
      return (
        <>
          <Hero meta={meta} subtitle={displayName} />
          <Section title="Web presence">
            <Field label="Website" value={profile.website} onChangeText={(v: string) => updateProfile("website", v)} keyboardType="url" />
            <Field label="Institution domain" value={profile.domain} onChangeText={(v: string) => updateProfile("domain", v)} autoCapitalize="none" />
          </Section>
          <PrimaryButton label="Save website details" loading={saving} onPress={() => saveProfile({ website: profile.website, domain: profile.domain })} />
        </>
      );
    }
    if (section === "permissions") {
      return (
        <>
          <Hero meta={meta} subtitle="Configure what each admin role can change." />
          {Object.keys(ROLE_LABELS).map((role) => {
            const allRolePermissions = (policy.rolePermissions || {}) as Record<string, string[]>;
            const rolePermissions = allRolePermissions[role] || [];
            return (
              <Section title={ROLE_LABELS[role]} key={role}>
                {PERMISSIONS.map((permission, index) => (
                  <React.Fragment key={permission.key}>
                    {index > 0 && <Divider />}
                    <SettingsRow
                      icon={permission.key === "billing" ? "card-outline" : "checkmark-circle-outline"}
                      title={permission.label}
                      right={<SwitchControl value={rolePermissions.includes(permission.key)} onValueChange={() => {
                        const nextForRole = rolePermissions.includes(permission.key)
                          ? rolePermissions.filter((item: string) => item !== permission.key)
                          : [...rolePermissions, permission.key];
                        savePolicy({ rolePermissions: { ...(policy.rolePermissions || {}), [role]: nextForRole } as any });
                      }} />}
                    />
                  </React.Fragment>
                ))}
              </Section>
            );
          })}
        </>
      );
    }
    if (section === "activity") {
      return (
        <>
          <Hero meta={meta} subtitle={`${formatNumber(data?.activity?.length)} recent actions`} />
          <List rows={data?.activity || []} empty="No audited admin actions yet." render={(row) => ({
            icon: "time-outline",
            title: String(row.action || "Institution action").replace(/_/g, " "),
            subtitle: formatAgo(row.created_at),
          })} />
        </>
      );
    }
    if (section === "filters") {
      return (
        <>
          <Hero meta={meta} subtitle={`${filters.length} blocked keywords`} />
          <Section title="Add keyword">
            <Field label="Blocked keyword" value={newFilter} onChangeText={setNewFilter} />
            <PrimaryButton label="Add filter" onPress={() => {
              const value = newFilter.trim();
              if (!value || filters.includes(value)) return;
              setNewFilter("");
              savePolicy({ contentFilters: [...filters, value] as any }, false);
            }} />
          </Section>
          <Section title="Active filters">
            {filters.length ? filters.map((item, index) => (
              <React.Fragment key={item}>
                {index > 0 && <Divider />}
                <SettingsRow icon="filter-outline" title={item} value="Remove" onPress={() => savePolicy({ contentFilters: filters.filter((f) => f !== item) as any })} />
              </React.Fragment>
            )) : <Empty label="No content filters yet." />}
          </Section>
        </>
      );
    }
    if (section === "reports") {
      return (
        <>
          <Hero meta={meta} subtitle={`${formatNumber(counts.reports)} pending reports`} />
          <List rows={data?.reports || []} empty="No institution reports are open." render={(row) => ({
            icon: "flag-outline",
            title: `${row.reason || "Report"} - ${row.status || "pending"}`,
            subtitle: row.details || `${row.target_type || "item"} ${row.target_id || ""}`,
          })} />
        </>
      );
    }
    if (section === "banned") {
      return (
        <>
          <Hero meta={meta} subtitle={`${formatNumber(data?.bannedUsers?.length)} users currently restricted`} />
          <List rows={data?.bannedUsers || []} empty="No banned users found." render={(row) => ({
            icon: "person-remove-outline",
            title: row.name || "Banned user",
            subtitle: row.course || row.city || "Account restricted",
          })} />
        </>
      );
    }
    if (section === "slowmode") {
      return (
        <>
          <Hero meta={meta} subtitle={slowMode.enabled ? `${slowMode.seconds}s between posts` : "No cooldown active"} />
          <Section title="Rate limit">
            <SettingsRow icon="timer-outline" title="Enable slow mode" right={<SwitchControl value={!!slowMode.enabled} onValueChange={() => savePolicy({ slowMode: { ...slowMode, enabled: !slowMode.enabled } as any })} />} />
            <Divider />
            <Field label="Cooldown seconds" value={slowSeconds} onChangeText={setSlowSeconds} keyboardType="number-pad" />
          </Section>
          <PrimaryButton label="Save rate limit" onPress={() => savePolicy({ slowMode: { ...slowMode, seconds: Math.max(5, Number(slowSeconds) || 30) } as any }, false)} />
        </>
      );
    }
    if (section === "push") {
      return (
        <>
          <Hero meta={meta} subtitle="Choose which admin alerts are delivered." />
          <Section title="Channels">
            <SettingsRow icon="warning-outline" title="Critical alerts" right={<SwitchControl value={!!channels.critical} onValueChange={() => savePolicy({ pushChannels: { ...channels, critical: !channels.critical } as any })} />} />
            <Divider />
            <SettingsRow icon="flag-outline" title="Report queue" right={<SwitchControl value={!!channels.reports} onValueChange={() => savePolicy({ pushChannels: { ...channels, reports: !channels.reports } as any })} />} />
            <Divider />
            <SettingsRow icon="mail-outline" title="Weekly digest" right={<SwitchControl value={!!channels.weeklyDigest} onValueChange={() => savePolicy({ pushChannels: { ...channels, weeklyDigest: !channels.weeklyDigest } as any })} />} />
          </Section>
        </>
      );
    }
    if (section === "export") {
      return (
        <>
          <Hero meta={meta} subtitle={`${formatNumber(counts.members)} members, ${formatNumber(counts.posts)} posts`} />
          <Section title="Included data">
            <Metric label="Groups" value={counts.groups || 0} />
            <Metric label="Posts" value={counts.posts || 0} />
            <Metric label="Members" value={counts.members || 0} />
          </Section>
          <PrimaryButton label="Create JSON export" loading={saving} onPress={downloadExport} />
        </>
      );
    }
    if (section === "dpa") {
      const acceptedAt = policy.dpaAcceptedAt;
      return (
        <>
          <Hero meta={meta} subtitle={acceptedAt ? `Accepted ${formatDate(acceptedAt)}` : "Not accepted yet"} />
          <Section title="Agreement">
            <Text style={[styles.copy, { color: colors.onSurfaceTertiary }]}>This agreement records that institution admins will process member, post, and analytics data only for campus community operations.</Text>
          </Section>
          <PrimaryButton label={acceptedAt ? "Reconfirm agreement" : "Accept agreement"} onPress={() => savePolicy({ dpaAcceptedAt: new Date().toISOString() } as any, false)} />
        </>
      );
    }
    if (section === "twofactor") {
      return (
        <>
          <Hero meta={meta} subtitle={policy.twoFactorRequired ? "Required for all admins" : "Optional for admins"} />
          <Section title="Security">
            <SettingsRow icon="shield-checkmark-outline" title="Require two-factor authentication" subtitle="Admins must complete a second security step" right={<SwitchControl value={!!policy.twoFactorRequired} onValueChange={() => savePolicy({ twoFactorRequired: !policy.twoFactorRequired } as any)} />} />
          </Section>
        </>
      );
    }
    if (section === "plan") {
      return (
        <>
          <Hero meta={meta} subtitle={`${billing.plan || "free"} - ${billing.status || "Free tier"}`} />
          <Section title="Plan">
            <Metric label="Current tier" value={billing.plan === "campus_pro" ? "Campus Pro" : "Verified Free"} />
            <Metric label="Billing status" value={billing.status || "Free tier"} />
          </Section>
          <PrimaryButton label="Request upgrade" onPress={() => savePolicy({ billing: { ...(policy.billing || {}), plan: "campus_pro", upgradeRequestedAt: new Date().toISOString() } as any }, false)} />
        </>
      );
    }
    if (section === "payments") {
      const bill = policy.billing || DEFAULT_POLICY.billing;
      return (
        <>
          <Hero meta={meta} subtitle={bill.paymentContactEmail || "No billing contact set"} />
          <Section title="Billing contact">
            <Field label="Payment contact email" value={bill.paymentContactEmail || ""} onChangeText={(value: string) => setPolicy({ ...policy, billing: { ...bill, paymentContactEmail: value } as any })} autoCapitalize="none" keyboardType="email-address" />
            <Field label="Invoice name" value={bill.invoiceName || ""} onChangeText={(value: string) => setPolicy({ ...policy, billing: { ...bill, invoiceName: value } as any })} />
          </Section>
          <PrimaryButton label="Save payment details" onPress={() => savePolicy({ billing: policy.billing } as any, false)} />
        </>
      );
    }
    if (section === "invoices") {
      return (
        <>
          <Hero meta={meta} subtitle={`${formatNumber(billing.invoices?.length)} invoices`} />
          <List rows={billing.invoices || []} empty="No invoices yet. Your current plan has no charges." render={(row) => ({
            icon: "receipt-outline",
            title: row.number || "Invoice",
            subtitle: `${row.status || "issued"} - ${row.amount || ""}`,
          })} />
        </>
      );
    }
    if (section === "pause") {
      const paused = !!policy.danger?.pausedAt || !policy.publicPage;
      return (
        <>
          <Hero meta={meta} subtitle={paused ? "Public page is paused" : "Public page is visible"} destructive />
          <Section title="Public visibility">
            <Text style={[styles.copy, { color: colors.onSurfaceTertiary }]}>Pausing hides the institution from Discover and disables public institution promotion until you resume it.</Text>
          </Section>
          <PrimaryButton destructive label={paused ? "Resume institution page" : "Pause institution page"} loading={saving} onPress={() => Alert.alert(paused ? "Resume page?" : "Pause page?", paused ? "Your institution will be visible again." : "Your institution will be hidden from public discovery.", [{ text: "Cancel", style: "cancel" }, { text: paused ? "Resume" : "Pause", style: paused ? "default" : "destructive", onPress: () => runAction(paused ? "resume" : "pause") }])} />
        </>
      );
    }
    return (
      <>
        <Hero meta={meta} subtitle={policy.danger?.deletionRequestedAt ? `Requested ${formatDate(policy.danger.deletionRequestedAt)}` : "No deletion request active"} destructive />
        <Section title="Deletion request">
          <Text style={[styles.copy, { color: colors.onSurfaceTertiary }]}>This creates an audited deletion request for backend review. Data is not removed instantly, so reports, billing, and verification history can be reviewed first.</Text>
        </Section>
        <PrimaryButton destructive label="Request institution deletion" loading={saving} onPress={() => Alert.alert("Request deletion?", "This will submit an audited institution deletion request.", [{ text: "Cancel", style: "cancel" }, { text: "Request deletion", style: "destructive", onPress: () => runAction("request_delete") }])} />
      </>
    );
  };

  async function downloadExport() {
    try {
      setSaving(true);
      const exported = await api.institutions.exportData();
      const fileName = `${displayName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-export.json`;
      const json = JSON.stringify(exported, null, 2);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      }
      Alert.alert("Export ready", Platform.OS === "web" ? "The JSON export has been downloaded." : "The export was generated successfully.");
    } catch (error) {
      Alert.alert("Export failed", getUserErrorMessage(error, "Could not create institution export."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title={meta.title} subtitle={meta.subtitle} onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

function Hero({ meta, subtitle, destructive }: { meta: { title: string; icon: keyof typeof Ionicons.glyphMap }; subtitle: string; destructive?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.hero, { backgroundColor: destructive ? colors.error + "12" : colors.brandTertiary, borderColor: destructive ? colors.error + "33" : colors.border }]}>
      <View style={[styles.heroIcon, { backgroundColor: destructive ? colors.error : colors.brandPrimary }]}>
        <Ionicons name={meta.icon} size={24} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.heroTitle, { color: colors.onSurface }]}>{meta.title}</Text>
        <Text style={[styles.heroSub, { color: colors.onSurfaceTertiary }]}>{subtitle}</Text>
      </View>
    </View>
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

function Field({ label, value, onChangeText, multiline, ...props }: any) {
  const { colors } = useTheme();
  return (
    <View style={{ padding: spacing.lg, gap: spacing.sm }}>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "600" }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholderTextColor={colors.placeholder}
        style={[styles.input, { minHeight: multiline ? 96 : 46, color: colors.onSurface, borderColor: colors.border, backgroundColor: colors.surfaceTertiary }]}
        {...props}
      />
    </View>
  );
}

function PrimaryButton({ label, onPress, loading, destructive }: { label: string; onPress: () => void; loading?: boolean; destructive?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable disabled={loading} onPress={onPress} style={[styles.button, { backgroundColor: destructive ? colors.error : colors.brandPrimary, opacity: loading ? 0.7 : 1 }]}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: font.base }}>{label}</Text>}
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.metric}>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{label}</Text>
      <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "700" }}>{typeof value === "number" ? formatNumber(value) : value}</Text>
    </View>
  );
}

function List({ rows, empty, render }: { rows: any[]; empty: string; render: (row: any) => { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string } }) {
  if (!rows.length) return <Section title="Results"><Empty label={empty} /></Section>;
  return (
    <Section title="Results">
      {rows.map((row, index) => {
        const rendered = render(row);
        return (
          <React.Fragment key={row.id || `${rendered.title}-${index}`}>
            {index > 0 && <Divider />}
            <SettingsRow icon={rendered.icon} title={rendered.title} subtitle={rendered.subtitle} />
          </React.Fragment>
        );
      })}
    </Section>
  );
}

function Empty({ label }: { label: string }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.onSurfaceTertiary, padding: spacing.lg, fontSize: font.base }}>{label}</Text>;
}

function Loading() {
  const { colors } = useTheme();
  return <View style={{ padding: spacing.xl, alignItems: "center" }}><ActivityIndicator color={colors.brandPrimary} /></View>;
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 68 }} />;
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    margin: spacing.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { fontSize: font.xl, fontWeight: "700" },
  heroSub: { fontSize: font.sm, marginTop: 3 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: font.base,
    textAlignVertical: "top",
  },
  button: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  metric: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  copy: {
    padding: spacing.lg,
    fontSize: font.base,
    lineHeight: 22,
  },
});
