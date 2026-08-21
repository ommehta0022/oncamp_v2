import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import { campusApi, CampusApiError } from "@/src/lib/campusApi";

type Tab = "overview" | "people" | "engage" | "safety" | "tools";
type FormKind = "department" | "staff" | "event" | "broadcast" | "invite" | "opportunity" | "place" | "attendance" | "integration" | "webhook" | "emergency" | "digitalId" | null;

const PERMISSION_LABELS: Record<string, string> = {
  "students.review": "Student approvals",
  "staff.manage": "Staff",
  "departments.manage": "Departments",
  "roles.manage": "Roles",
  "events.manage": "Events",
  "broadcasts.send": "Broadcasts",
  "moderation.review": "Moderation",
  "analytics.view": "Analytics",
  "verification.manage": "Verification",
  "storage.view": "Storage",
  "exports.view": "Exports",
  "backup.manage": "Backups",
  "integrations.manage": "Integrations",
  "invites.manage": "Invites",
  "opportunities.manage": "Opportunities",
  "places.manage": "Campus map",
  "attendance.manage": "Attendance",
  "digital_id.manage": "Digital ID",
  "emergency.send": "Emergency alerts",
};

export default function CampusPlatform() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState<any>(null);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [moderation, setModeration] = useState<any>({ signals: [], reports: [] });
  const [analytics, setAnalytics] = useState<any>(null);
  const [invites, setInvites] = useState<any[]>([]);
  const [storage, setStorage] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [formKind, setFormKind] = useState<FormKind>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const permissions = useMemo(() => new Set<string>(overview?.permissions || []), [overview]);
  const can = (permission: string) => permissions.has(permission);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const nextOverview = await campusApi.institution.overview();
      setOverview(nextOverview);
      const allowed = new Set<string>(nextOverview?.permissions || []);
      const jobs: Promise<void>[] = [];
      const pull = <T,>(permission: string, fn: () => Promise<T>, setter: (value: any) => void) => {
        if (!allowed.has(permission)) return;
        jobs.push(fn().then(setter).catch(() => undefined));
      };
      pull("students.review", () => campusApi.institution.studentApprovals("pending"), setApprovals);
      pull("departments.manage", campusApi.institution.departments, setDepartments);
      pull("staff.manage", campusApi.institution.staff, setStaff);
      pull("events.manage", campusApi.institution.events, setEvents);
      pull("broadcasts.send", campusApi.institution.broadcasts, setBroadcasts);
      pull("moderation.review", () => campusApi.institution.moderation("open"), setModeration);
      pull("analytics.view", campusApi.institution.analytics, setAnalytics);
      pull("invites.manage", campusApi.institution.invites, setInvites);
      pull("storage.view", campusApi.institution.storage, setStorage);
      pull("backup.manage", campusApi.institution.backups, setBackups);
      pull("integrations.manage", campusApi.institution.integrations, setIntegrations);
      pull("integrations.manage", campusApi.institution.webhooks, setWebhooks);
      await Promise.all(jobs);
    } catch (error) {
      Alert.alert("Campus platform", error instanceof Error ? error.message : "Could not load institution operations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const decideStudent = async (item: any, status: "approved" | "rejected" | "needs_info") => {
    const label = status === "approved" ? "Approve" : status === "rejected" ? "Reject" : "Request information";
    Alert.prompt?.(label, "Optional message for the student", async (message) => {
      try {
        await campusApi.institution.decideStudent(item.id, status, message || "");
        await load(true);
      } catch (error) {
        Alert.alert("Could not update student", error instanceof Error ? error.message : "Please try again.");
      }
    });
  };

  const openForm = (kind: FormKind) => {
    const now = new Date();
    const later = new Date(Date.now() + 60 * 60 * 1000);
    const defaults: Record<string, Record<string, string>> = {
      department: { name: "", code: "", description: "" },
      staff: { name: "", title: "", email: "" },
      event: { title: "", description: "", location: "", startAt: now.toISOString(), endAt: later.toISOString() },
      broadcast: { title: "", body: "" },
      invite: { inviteType: "institution", maxUses: "100" },
      opportunity: { kind: "internship", title: "", organization: "", description: "", location: "", applyUrl: "" },
      place: { name: "", category: "building", latitude: "", longitude: "" },
      attendance: { title: "", startsAt: now.toISOString(), endsAt: later.toISOString() },
      integration: { kind: "lms", name: "", baseUrl: "https://" },
      webhook: { name: "", url: "https://", events: "*" },
      emergency: { title: "", body: "", severity: "high" },
      digitalId: { userId: "", validUntil: "" },
    };
    setForm(defaults[kind || "department"] || {});
    setFormKind(kind);
  };

  const submitForm = async () => {
    if (!formKind || submitting) return;
    setSubmitting(true);
    try {
      switch (formKind) {
        case "department":
          await campusApi.institution.createDepartment({ name: form.name, code: form.code || null, description: form.description || null, active: true });
          break;
        case "staff":
          await campusApi.institution.createStaff({ name: form.name, title: form.title || null, email: form.email || null, status: "active" });
          break;
        case "event":
          await campusApi.institution.createEvent({ title: form.title, description: form.description || "", location: form.location || null, startAt: form.startAt, endAt: form.endAt, visibility: "institution", status: "published", rsvpEnabled: true });
          break;
        case "broadcast":
          await campusApi.institution.createBroadcast({ title: form.title, body: form.body, target: { type: "all" }, channels: { inApp: true, push: true } });
          break;
        case "invite":
          await campusApi.institution.createInvite({ inviteType: form.inviteType || "institution", autoApprove: false, maxUses: form.maxUses ? Number(form.maxUses) : null });
          break;
        case "opportunity":
          await campusApi.institution.opportunities({ kind: form.kind || "internship", title: form.title, organization: form.organization || null, description: form.description || "", location: form.location || null, applyUrl: form.applyUrl || null });
          break;
        case "place":
          await campusApi.institution.createPlace({ name: form.name, category: form.category || "building", latitude: Number(form.latitude), longitude: Number(form.longitude) });
          break;
        case "attendance":
          await campusApi.institution.createAttendance({ title: form.title, startsAt: form.startsAt, endsAt: form.endsAt, geofence: {} });
          break;
        case "integration":
          await campusApi.institution.createIntegration({ kind: form.kind || "lms", name: form.name, baseUrl: form.baseUrl || null, config: {}, active: true });
          break;
        case "webhook": {
          const created = await campusApi.institution.createWebhook({ name: form.name, url: form.url, events: (form.events || "*").split(",").map((value) => value.trim()).filter(Boolean) });
          Alert.alert("Webhook created", `${created.warning || "Save the signing secret now."}\n\n${created.secret || ""}`);
          break;
        }
        case "emergency":
          await campusApi.institution.sendEmergency({ title: form.title, body: form.body, severity: form.severity || "high", target: { type: "all" } });
          break;
        case "digitalId":
          await campusApi.institution.issueDigitalId({ userId: form.userId, validUntil: form.validUntil || null, metadata: {} });
          break;
      }
      setFormKind(null);
      await load(true);
    } catch (error) {
      Alert.alert("Could not save", error instanceof CampusApiError || error instanceof Error ? error.message : "Please check the fields and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const createBackup = async () => {
    try {
      await campusApi.institution.createBackup(`Manual backup ${new Date().toLocaleString()}`);
      await load(true);
    } catch (error) {
      Alert.alert("Backup failed", error instanceof Error ? error.message : "Please try again.");
    }
  };

  const scanModeration = async () => {
    try {
      const result = await campusApi.institution.scanModeration(100);
      Alert.alert("Content scan complete", `${result.scanned || 0} recent posts checked.`);
      await load(true);
    } catch (error) {
      Alert.alert("Scan failed", error instanceof Error ? error.message : "Please try again.");
    }
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "overview", label: "Overview", icon: "grid-outline" },
    { key: "people", label: "People", icon: "people-outline" },
    { key: "engage", label: "Engage", icon: "megaphone-outline" },
    { key: "safety", label: "Safety", icon: "shield-checkmark-outline" },
    { key: "tools", label: "Tools", icon: "construct-outline" },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Campus Platform" onBack={() => router.back()} />
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}> 
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 6 }}>
          {tabs.map((item) => {
            const active = tab === item.key;
            return (
              <Pressable key={item.key} onPress={() => setTab(item.key)} style={[styles.tab, active && { backgroundColor: colors.brandPrimary + "18" }]}> 
                <Ionicons name={item.icon} size={17} color={active ? colors.brandPrimary : colors.onSurfaceTertiary} />
                <Text style={{ color: active ? colors.brandPrimary : colors.onSurfaceTertiary, fontWeight: active ? "700" : "500", fontSize: 12 }}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /><Text style={{ color: colors.onSurfaceTertiary, marginTop: 10 }}>Loading institution operations…</Text></View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={colors.brandPrimary} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
        >
          {tab === "overview" && <Overview overview={overview} analytics={analytics} approvals={approvals} events={events} colors={colors} />}

          {tab === "people" && (
            <>
              {can("students.review") && <Section title="Student approval queue" action="Refresh" onAction={() => void load(true)}>
                {approvals.length === 0 ? <Empty text="No pending students." /> : approvals.slice(0, 20).map((item) => (
                  <View key={item.id} style={[styles.item, { borderColor: colors.border }]}>
                    <View style={styles.itemBody}><Text style={[styles.itemTitle, { color: colors.onSurface }]}>{item.user?.name || item.user?.handle || "Student"}</Text><Text style={[styles.itemSub, { color: colors.onSurfaceTertiary }]}>{item.verification_data?.rollNumber || item.user?.course || item.source || "Pending verification"}</Text></View>
                    <Pressable onPress={() => void decideStudent(item, "approved")} style={[styles.smallButton, { backgroundColor: colors.success + "18" }]}><Ionicons name="checkmark" size={17} color={colors.success} /></Pressable>
                    <Pressable onPress={() => void decideStudent(item, "needs_info")} style={[styles.smallButton, { backgroundColor: "#D9983A22" }]}><Ionicons name="chatbox-ellipses-outline" size={17} color="#D9983A" /></Pressable>
                    <Pressable onPress={() => void decideStudent(item, "rejected")} style={[styles.smallButton, { backgroundColor: colors.error + "18" }]}><Ionicons name="close" size={17} color={colors.error} /></Pressable>
                  </View>
                ))}
              </Section>}

              {can("departments.manage") && <Section title="Departments" action="Add" onAction={() => openForm("department")}>
                {departments.length === 0 ? <Empty text="Create departments to organize students, staff and groups." /> : departments.map((item) => <SimpleRow key={item.id} icon="business-outline" title={item.name} subtitle={item.code || item.description || "Active"} />)}
              </Section>}

              {can("staff.manage") && <Section title="Faculty & staff" action="Add" onAction={() => openForm("staff")}>
                {staff.length === 0 ? <Empty text="No faculty or staff added yet." /> : staff.slice(0, 30).map((item) => <SimpleRow key={item.id} icon="person-circle-outline" title={item.name} subtitle={[item.title, item.email, item.status].filter(Boolean).join(" · ")} />)}
              </Section>}

              {can("roles.manage") && <Section title="Roles & permissions">
                <Text style={{ color: colors.onSurfaceTertiary, lineHeight: 20 }}>Custom roles are enforced by the backend. Available permissions: {Object.values(PERMISSION_LABELS).join(", ")}.</Text>
              </Section>}
            </>
          )}

          {tab === "engage" && (
            <>
              {can("events.manage") && <Section title="Events & RSVP" action="Create" onAction={() => openForm("event")}>
                {events.length === 0 ? <Empty text="No events yet." /> : events.slice(0, 20).map((item) => <SimpleRow key={item.id} icon="calendar-outline" title={item.title} subtitle={`${formatDate(item.start_at)}${item.location ? ` · ${item.location}` : ""} · ${item.status}`} />)}
              </Section>}
              {can("broadcasts.send") && <Section title="Broadcast notifications" action="Send" onAction={() => openForm("broadcast")}>
                {broadcasts.length === 0 ? <Empty text="Send targeted in-app and push notifications to verified students." /> : broadcasts.slice(0, 20).map((item) => <SimpleRow key={item.id} icon="notifications-outline" title={item.title} subtitle={`${item.status}${item.delivery_stats?.recipients != null ? ` · ${item.delivery_stats.recipients} recipients` : ""}`} />)}
              </Section>}
              {can("invites.manage") && <Section title="Campus invites & QR" action="Create" onAction={() => openForm("invite")}>
                {invites.length === 0 ? <Empty text="Generate secure institution, group or event invites." /> : invites.slice(0, 10).map((item) => (
                  <View key={item.id} style={[styles.invite, { borderColor: colors.border }]}>
                    <Image source={{ uri: campusApi.qrUrl(item.code) }} style={styles.qr} contentFit="contain" />
                    <View style={{ flex: 1 }}><Text style={[styles.itemTitle, { color: colors.onSurface }]}>{item.invite_type || "institution"} invite</Text><Text selectable style={[styles.itemSub, { color: colors.onSurfaceTertiary }]}>{item.code}</Text><Text style={[styles.itemSub, { color: colors.onSurfaceTertiary }]}>{item.use_count || 0}{item.max_uses ? ` / ${item.max_uses}` : ""} uses</Text></View>
                  </View>
                ))}
              </Section>}
              {can("opportunities.manage") && <ActionCard icon="briefcase-outline" title="Placements & internships" subtitle="Publish internships, placements, scholarships and competitions." action="Create" onPress={() => openForm("opportunity")} />}
            </>
          )}

          {tab === "safety" && (
            <>
              {can("moderation.review") && <Section title="Content intelligence" action="Scan now" onAction={() => void scanModeration()}>
                {(moderation?.signals || []).length === 0 ? <Empty text="No open spam, duplicate or moderation signals." /> : (moderation.signals || []).slice(0, 30).map((signal: any) => (
                  <View key={signal.id} style={[styles.item, { borderColor: colors.border }]}>
                    <View style={styles.itemBody}><Text style={[styles.itemTitle, { color: colors.onSurface }]}>{String(signal.signal_type || "signal").toUpperCase()} · {Math.round(Number(signal.score || 0) * 100)}%</Text><Text style={[styles.itemSub, { color: colors.onSurfaceTertiary }]}>{signal.explanation || signal.target_id}</Text></View>
                    <Pressable onPress={async () => { await campusApi.institution.moderate(signal.id, "reviewed"); await load(true); }} style={[styles.pill, { borderColor: colors.border }]}><Text style={{ color: colors.onSurface, fontSize: 12 }}>Review</Text></Pressable>
                    <Pressable onPress={async () => { await campusApi.institution.moderate(signal.id, "actioned"); await load(true); }} style={[styles.pill, { borderColor: colors.error + "55" }]}><Text style={{ color: colors.error, fontSize: 12 }}>Action</Text></Pressable>
                  </View>
                ))}
              </Section>}
              {can("verification.manage") && <ActionCard icon="checkmark-done-circle-outline" title="Verification management" subtitle="Verify official clubs, societies, departments and staff identities." action="Open" onPress={() => router.push("/institution/verification" as any)} />}
              {can("emergency.send") && <ActionCard icon="warning-outline" title="Emergency alerts" subtitle="Send high-priority campus-wide alerts with in-app and push delivery." action="Send" danger onPress={() => openForm("emergency")} />}
            </>
          )}

          {tab === "tools" && (
            <>
              {can("analytics.view") && <Section title="Institution analytics">
                <MetricGrid metrics={[
                  ["Students", analytics?.students?.total || 0],
                  ["New 30d", analytics?.students?.new30d || 0],
                  ["Groups", analytics?.groups?.total || 0],
                  ["Posts", analytics?.content?.posts || 0],
                  ["Events", analytics?.content?.events || 0],
                  ["Open risks", analytics?.moderation?.openSignals || 0],
                ]} />
              </Section>}
              {can("storage.view") && <ActionCard icon="cloud-outline" title="Storage management" subtitle={`${storage?.megabytes || 0} MB · ${storage?.files || 0} tracked files`} action="Refresh" onPress={() => void load(true)} />}
              {can("backup.manage") && <Section title="Backup & restore" action="Create backup" onAction={() => void createBackup()}>
                {backups.length === 0 ? <Empty text="No institution backups yet." /> : backups.slice(0, 10).map((item) => <SimpleRow key={item.id} icon="archive-outline" title={item.label} subtitle={`${item.status} · ${formatDate(item.created_at)}`} />)}
              </Section>}
              {can("integrations.manage") && <Section title="Integrations & webhooks">
                <ActionRow icon="git-network-outline" title="Connect LMS / Library / Timetable" subtitle={`${integrations.length} integrations configured`} onPress={() => openForm("integration")} />
                <ActionRow icon="code-slash-outline" title="Secure webhooks" subtitle={`${webhooks.length} webhooks configured · HMAC signed`} onPress={() => openForm("webhook")} />
              </Section>}
              {can("places.manage") && <ActionCard icon="map-outline" title="Campus map" subtitle="Manage buildings, facilities and geocoded campus places." action="Add place" onPress={() => openForm("place")} />}
              {can("attendance.manage") && <ActionCard icon="checkmark-circle-outline" title="Attendance integration" subtitle="Create sessions and record verified attendance." action="Create" onPress={() => openForm("attendance")} />}
              {can("digital_id.manage") && <ActionCard icon="card-outline" title="Digital ID cards" subtitle="Issue revocable campus IDs to verified members." action="Issue" onPress={() => openForm("digitalId")} />}
              {can("exports.view") && <ActionCard icon="download-outline" title="CSV / PDF reports" subtitle="Secure export APIs are enabled for students, staff, events and analytics." action="Ready" onPress={() => Alert.alert("Exports ready", "CSV and PDF exports are available from the institution export API and web admin. Mobile file-save UX will use the device share sheet.")} />}
            </>
          )}
        </ScrollView>
      )}

      <FormModal kind={formKind} values={form} setValues={setForm} submitting={submitting} onClose={() => setFormKind(null)} onSubmit={() => void submitForm()} />
    </SafeAreaView>
  );
}

function Overview({ overview, analytics, approvals, events, colors }: any) {
  const counts = overview?.counts || {};
  return (
    <>
      <View style={[styles.hero, { backgroundColor: colors.brandPrimary }]}>
        <View style={{ flex: 1 }}><Text style={styles.heroEyebrow}>INSTITUTION OPERATIONS</Text><Text style={styles.heroTitle}>One workspace for your campus</Text><Text style={styles.heroText}>Approvals, staff, events, broadcasts, moderation, analytics, integrations and campus services use real production APIs.</Text></View>
        <Ionicons name="school" size={42} color="#ffffffcc" />
      </View>
      <MetricGrid metrics={[
        ["Pending", counts.pendingStudents || approvals.length || 0],
        ["Departments", counts.departments || 0],
        ["Staff", counts.staff || 0],
        ["Events", counts.upcomingEvents || events.length || 0],
        ["Moderation", counts.moderation || 0],
        ["Students", analytics?.students?.total || 0],
      ]} />
      <Section title="Security & governance">
        <SimpleRow icon="shield-checkmark-outline" title="Granular permissions" subtitle="Every operation is checked server-side against institution roles." />
        <SimpleRow icon="receipt-outline" title="Audit trail" subtitle="Administrative actions are recorded with institution-scoped activity events." />
        <SimpleRow icon="lock-closed-outline" title="Deny-by-default database" subtitle="Campus platform tables use RLS and service-only access." />
      </Section>
    </>
  );
}

function MetricGrid({ metrics }: { metrics: Array<[string, string | number]> }) {
  const { colors } = useTheme();
  return <View style={styles.metricGrid}>{metrics.map(([label, value]) => <View key={label} style={[styles.metric, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Text style={{ color: colors.onSurface, fontWeight: "800", fontSize: 22 }}>{Number(value || 0).toLocaleString()}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 4 }}>{label}</Text></View>)}</View>;
}

function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={{ marginTop: spacing.xl }}><View style={styles.sectionHeader}><Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "700" }}>{title}</Text>{action && onAction && <Pressable onPress={onAction}><Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>{action}</Text></Pressable>}</View><View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>{children}</View></View>;
}

function SimpleRow({ icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  const { colors } = useTheme();
  return <View style={styles.row}><View style={[styles.rowIcon, { backgroundColor: colors.brandPrimary + "14" }]}><Ionicons name={icon} size={19} color={colors.brandPrimary} /></View><View style={{ flex: 1 }}><Text style={[styles.itemTitle, { color: colors.onSurface }]}>{title}</Text><Text style={[styles.itemSub, { color: colors.onSurfaceTertiary }]}>{subtitle}</Text></View></View>;
}

function ActionRow({ icon, title, subtitle, onPress }: { icon: any; title: string; subtitle: string; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable onPress={onPress} style={styles.row}><View style={[styles.rowIcon, { backgroundColor: colors.brandPrimary + "14" }]}><Ionicons name={icon} size={19} color={colors.brandPrimary} /></View><View style={{ flex: 1 }}><Text style={[styles.itemTitle, { color: colors.onSurface }]}>{title}</Text><Text style={[styles.itemSub, { color: colors.onSurfaceTertiary }]}>{subtitle}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} /></Pressable>;
}

function ActionCard({ icon, title, subtitle, action, onPress, danger }: { icon: any; title: string; subtitle: string; action: string; onPress: () => void; danger?: boolean }) {
  const { colors } = useTheme();
  const accent = danger ? colors.error : colors.brandPrimary;
  return <Pressable onPress={onPress} style={[styles.actionCard, { backgroundColor: colors.surfaceSecondary, borderColor: danger ? colors.error + "44" : colors.border }]}><View style={[styles.rowIcon, { backgroundColor: accent + "16" }]}><Ionicons name={icon} size={20} color={accent} /></View><View style={{ flex: 1 }}><Text style={[styles.itemTitle, { color: colors.onSurface }]}>{title}</Text><Text style={[styles.itemSub, { color: colors.onSurfaceTertiary }]}>{subtitle}</Text></View><Text style={{ color: accent, fontWeight: "700", fontSize: 12 }}>{action}</Text></Pressable>;
}

function Empty({ text }: { text: string }) {
  const { colors } = useTheme();
  return <View style={{ padding: spacing.lg, alignItems: "center" }}><Ionicons name="sparkles-outline" size={24} color={colors.onSurfaceTertiary} /><Text style={{ color: colors.onSurfaceTertiary, marginTop: 8, textAlign: "center" }}>{text}</Text></View>;
}

function FormModal({ kind, values, setValues, submitting, onClose, onSubmit }: { kind: FormKind; values: Record<string, string>; setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>; submitting: boolean; onClose: () => void; onSubmit: () => void }) {
  const { colors } = useTheme();
  if (!kind) return null;
  const fieldMap: Record<string, Array<[string, string, boolean?]>> = {
    department: [["name", "Department name"], ["code", "Code"], ["description", "Description", true]],
    staff: [["name", "Name"], ["title", "Title / designation"], ["email", "Email"]],
    event: [["title", "Event title"], ["description", "Description", true], ["location", "Location"], ["startAt", "Start time (ISO)"], ["endAt", "End time (ISO)"]],
    broadcast: [["title", "Notification title"], ["body", "Message", true]],
    invite: [["inviteType", "Type: institution/group/event/club"], ["maxUses", "Maximum uses"]],
    opportunity: [["kind", "Kind: internship/placement/scholarship…"], ["title", "Title"], ["organization", "Organization"], ["description", "Description", true], ["location", "Location"], ["applyUrl", "Application URL"]],
    place: [["name", "Place name"], ["category", "Category"], ["latitude", "Latitude"], ["longitude", "Longitude"]],
    attendance: [["title", "Session title"], ["startsAt", "Starts at (ISO)"], ["endsAt", "Ends at (ISO)"]],
    integration: [["kind", "Kind: lms/library/timetable/calendar…"], ["name", "Integration name"], ["baseUrl", "HTTPS base URL"]],
    webhook: [["name", "Webhook name"], ["url", "HTTPS endpoint"], ["events", "Events comma-separated"]],
    emergency: [["title", "Alert title"], ["body", "Emergency message", true], ["severity", "Severity: info/warning/high/critical"]],
    digitalId: [["userId", "Verified student user ID"], ["validUntil", "Valid until (ISO, optional)"]],
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}><View style={[styles.modal, { backgroundColor: colors.surface }]}>
        <View style={styles.modalHeader}><View><Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: "800" }}>{titleCase(kind)}</Text><Text style={{ color: colors.onSurfaceTertiary, marginTop: 2, fontSize: 12 }}>Saved through secured institution APIs</Text></View><Pressable onPress={onClose}><Ionicons name="close" size={24} color={colors.onSurface} /></Pressable></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 30 }}>
          {(fieldMap[kind] || []).map(([key, label, multiline]) => <View key={key} style={{ marginTop: spacing.md }}><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>{label}</Text><TextInput value={values[key] || ""} onChangeText={(value) => setValues((previous) => ({ ...previous, [key]: value }))} multiline={multiline} placeholder={label} placeholderTextColor={colors.muted} style={[styles.input, multiline && { minHeight: 100, textAlignVertical: "top" }, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} /></View>)}
          <Pressable disabled={submitting} onPress={onSubmit} style={[styles.submit, { backgroundColor: colors.brandPrimary, opacity: submitting ? .6 : 1 }]}>{submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "800" }}>Save</Text>}</Pressable>
        </ScrollView>
      </View></View>
    </Modal>
  );
}

function titleCase(value: string) { return value.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()); }
function formatDate(value?: string) { if (!value) return ""; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(); }

const styles = StyleSheet.create({
  tabs: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  tab: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 18 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { borderRadius: 22, padding: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md },
  heroEyebrow: { color: "#ffffffaa", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  heroTitle: { color: "#fff", fontSize: 23, lineHeight: 28, fontWeight: "800", marginTop: 5 },
  heroText: { color: "#ffffffd6", lineHeight: 20, marginTop: 7, fontSize: 13 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: spacing.lg },
  metric: { width: "31%", minWidth: 96, flexGrow: 1, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  section: { borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" },
  item: { flexDirection: "row", alignItems: "center", gap: 7, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  itemBody: { flex: 1, minWidth: 0 }, itemTitle: { fontSize: 14, fontWeight: "700" }, itemSub: { fontSize: 12, marginTop: 3, lineHeight: 17 },
  smallButton: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  row: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(128,128,128,.12)" },
  rowIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  actionCard: { marginTop: spacing.md, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md },
  pill: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7 },
  invite: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  qr: { width: 72, height: 72, backgroundColor: "#fff", borderRadius: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,.45)", justifyContent: "flex-end" },
  modal: { maxHeight: "88%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11, minHeight: 46 },
  submit: { marginTop: spacing.xl, minHeight: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
});
