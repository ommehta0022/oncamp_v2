import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import Header from "@/src/components/Header";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import { AuditEntry, governanceApi, InstitutionRole } from "@/src/lib/governanceApi";

type Tab = "roles" | "audit" | "exports";

const PERMISSIONS = [
  ["students.review", "Student approvals"],
  ["staff.manage", "Faculty & staff"],
  ["departments.manage", "Departments"],
  ["roles.manage", "Roles & permissions"],
  ["events.manage", "Events"],
  ["broadcasts.send", "Broadcasts"],
  ["moderation.review", "Moderation"],
  ["analytics.view", "Analytics & audit"],
  ["verification.manage", "Verification"],
  ["storage.view", "Storage"],
  ["exports.view", "Exports"],
  ["backup.manage", "Backup & restore"],
  ["integrations.manage", "API & integrations"],
  ["invites.manage", "Invites & QR"],
  ["opportunities.manage", "Placements"],
  ["places.manage", "Campus map"],
  ["attendance.manage", "Attendance"],
  ["digital_id.manage", "Digital ID"],
  ["emergency.send", "Emergency alerts"],
] as const;

export default function GovernanceScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("roles");
  const [roles, setRoles] = useState<InstitutionRole[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<InstitutionRole | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextRoles, nextAudit] = await Promise.all([
        governanceApi.roles().catch(() => []),
        governanceApi.auditLogs().catch(() => []),
      ]);
      setRoles(nextRoles);
      setAudit(nextAudit);
    } catch (error) {
      Alert.alert("Governance", error instanceof Error ? error.message : "Could not load governance data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const openRole = (role?: InstitutionRole) => {
    setEditor(role || null);
    setName(role?.name || "");
    setDescription(role?.description || "");
    setSelected(role?.permissions || []);
  };

  const togglePermission = (permission: string) => {
    setSelected((current) => current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission]);
  };

  const saveRole = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const payload = { name: name.trim(), description: description.trim() || null, permissions: selected };
      if (editor?.id) await governanceApi.updateRole(editor.id, payload);
      else await governanceApi.createRole(payload);
      setEditor(undefined);
      await load();
    } catch (error) {
      Alert.alert("Role not saved", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const download = async (dataset: "students" | "staff" | "events" | "analytics", format: "csv" | "pdf") => {
    const key = `${dataset}-${format}`;
    if (exporting) return;
    setExporting(key);
    try {
      const result = await governanceApi.exportLink(dataset, format);
      await WebBrowser.openBrowserAsync(result.url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
    } catch (error) {
      Alert.alert("Export failed", error instanceof Error ? error.message : "Could not create the export.");
    } finally {
      setExporting(null);
    }
  };

  const counts = useMemo(() => ({ roles: roles.length, actions: audit.length }), [roles.length, audit.length]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Governance & reports" subtitle="Roles, audit trail and secure exports" onBack={() => router.back()} />
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {([ ["roles", "Roles", "key-outline"], ["audit", "Audit", "shield-checkmark-outline"], ["exports", "Exports", "download-outline"] ] as const).map(([key, label, icon]) => (
          <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && { borderBottomColor: colors.brandPrimary }]}>
            <Ionicons name={icon as any} size={18} color={tab === key ? colors.brandPrimary : colors.onSurfaceTertiary} />
            <Text style={{ color: tab === key ? colors.brandPrimary : colors.onSurfaceTertiary, fontWeight: "600" }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
          {tab === "roles" && (
            <>
              <View style={[styles.hero, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <View><Text style={[styles.heroValue, { color: colors.onSurface }]}>{counts.roles}</Text><Text style={{ color: colors.onSurfaceTertiary }}>configured roles</Text></View>
                <Pressable onPress={() => openRole()} style={[styles.primary, { backgroundColor: colors.brandPrimary }]}><Ionicons name="add" size={18} color="#fff" /><Text style={styles.primaryText}>New role</Text></Pressable>
              </View>
              {roles.length === 0 ? <Empty text="No custom roles yet." /> : roles.map((role) => (
                <Pressable key={role.id} onPress={() => openRole(role)} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}><Text style={[styles.title, { color: colors.onSurface }]}>{role.name}</Text><Text style={[styles.sub, { color: colors.onSurfaceTertiary }]}>{role.description || `${role.permissions?.length || 0} permissions`}</Text></View>
                  {role.is_system ? <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>System</Text> : <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />}
                </Pressable>
              ))}
            </>
          )}

          {tab === "audit" && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Recent institution activity</Text>
              <Text style={[styles.sectionSub, { color: colors.onSurfaceTertiary }]}>Tenant-scoped actions recorded by the production backend.</Text>
              {audit.length === 0 ? <Empty text="No audit events yet." /> : audit.map((entry) => (
                <View key={entry.id} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <View style={[styles.auditIcon, { backgroundColor: colors.brandPrimary + "18" }]}><Ionicons name="shield-checkmark-outline" size={18} color={colors.brandPrimary} /></View>
                  <View style={{ flex: 1 }}><Text style={[styles.title, { color: colors.onSurface }]}>{entry.event_type}</Text><Text style={[styles.sub, { color: colors.onSurfaceTertiary }]}>{[entry.target_type, entry.target_id].filter(Boolean).join(" · ") || "Institution"}</Text><Text style={[styles.time, { color: colors.onSurfaceTertiary }]}>{new Date(entry.created_at).toLocaleString()}</Text></View>
                </View>
              ))}
            </>
          )}

          {tab === "exports" && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Secure institution exports</Text>
              <Text style={[styles.sectionSub, { color: colors.onSurfaceTertiary }]}>Each download uses a signed link that expires after two minutes. Data is generated live from production APIs.</Text>
              {(["students", "staff", "events", "analytics"] as const).map((dataset) => (
                <View key={dataset} style={[styles.exportCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}><Text style={[styles.title, { color: colors.onSurface }]}>{dataset[0].toUpperCase() + dataset.slice(1)}</Text><Text style={[styles.sub, { color: colors.onSurfaceTertiary }]}>Current institution data</Text></View>
                  <ExportButton label="CSV" busy={exporting === `${dataset}-csv`} onPress={() => void download(dataset, "csv")} />
                  <ExportButton label="PDF" busy={exporting === `${dataset}-pdf`} onPress={() => void download(dataset, "pdf")} />
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      <Modal visible={editor !== undefined} animationType="slide" transparent onRequestClose={() => setEditor(undefined)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.onSurface }]}>{editor?.id ? "Edit role" : "Create role"}</Text><Pressable onPress={() => setEditor(undefined)}><Ionicons name="close" size={24} color={colors.onSurface} /></Pressable></View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput value={name} onChangeText={setName} placeholder="Role name" placeholderTextColor={colors.onSurfaceTertiary} style={[styles.input, { color: colors.onSurface, borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]} />
              <TextInput value={description} onChangeText={setDescription} placeholder="Description" placeholderTextColor={colors.onSurfaceTertiary} multiline style={[styles.input, styles.multiline, { color: colors.onSurface, borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]} />
              <Text style={[styles.sectionTitle, { color: colors.onSurface, marginTop: spacing.md }]}>Permissions</Text>
              {PERMISSIONS.map(([permission, label]) => {
                const active = selected.includes(permission);
                return <Pressable key={permission} onPress={() => togglePermission(permission)} style={[styles.permission, { borderColor: active ? colors.brandPrimary : colors.border, backgroundColor: active ? colors.brandPrimary + "12" : colors.surfaceSecondary }]}><Ionicons name={active ? "checkbox" : "square-outline"} size={20} color={active ? colors.brandPrimary : colors.onSurfaceTertiary} /><View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontWeight: "600" }}>{label}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{permission}</Text></View></Pressable>;
              })}
            </ScrollView>
            <Pressable disabled={!name.trim() || saving} onPress={() => void saveRole()} style={[styles.save, { backgroundColor: colors.brandPrimary, opacity: !name.trim() || saving ? 0.5 : 1 }]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save role</Text>}</Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ExportButton({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable onPress={onPress} disabled={busy} style={[styles.exportButton, { borderColor: colors.brandPrimary }]}>{busy ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : <Text style={{ color: colors.brandPrimary, fontWeight: "700", fontSize: font.sm }}>{label}</Text>}</Pressable>;
}

function Empty({ text }: { text: string }) {
  const { colors } = useTheme();
  return <View style={[styles.empty, { borderColor: colors.border }]}><Ionicons name="file-tray-outline" size={24} color={colors.onSurfaceTertiary} /><Text style={{ color: colors.onSurfaceTertiary }}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderBottomWidth: 2, borderBottomColor: "transparent" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  heroValue: { fontSize: 28, fontWeight: "800" },
  primary: { flexDirection: "row", gap: 6, alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md },
  primaryText: { color: "#fff", fontWeight: "700" },
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md },
  title: { fontSize: font.base, fontWeight: "700" },
  sub: { fontSize: font.sm, marginTop: 3, lineHeight: 18 },
  time: { fontSize: 11, marginTop: 5 },
  auditIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: font.lg, fontWeight: "800" },
  sectionSub: { marginTop: 4, marginBottom: spacing.lg, lineHeight: 20 },
  exportCard: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  exportButton: { minWidth: 52, height: 36, borderWidth: 1, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  empty: { borderWidth: 1, borderStyle: "dashed", borderRadius: radius.md, padding: spacing.xl, alignItems: "center", gap: spacing.sm },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  modal: { maxHeight: "90%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  modalTitle: { fontSize: 22, fontWeight: "800" },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, marginBottom: spacing.sm },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  permission: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md },
  save: { minHeight: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
});
