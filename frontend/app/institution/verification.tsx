import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import { api, getUserErrorMessage } from "@/src/lib/api";
import { formDataFromAsset } from "@/src/lib/uploadFormData";
import {
  formatDate,
  getInstitutionName,
  isVerified,
  statusLabel,
  type InstitutionDashboardData,
  type InstitutionRecord,
} from "@/src/lib/institution";

export default function Verification() {
  const { colors } = useTheme();
  const router = useRouter();
  const [institution, setInstitution] = useState<InstitutionRecord | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = (await api.institutions.dashboard()) as InstitutionDashboardData;
      setInstitution(data.institution || null);
      setRequests(data.verificationRequests || []);
    } catch {
      setInstitution(null);
      setRequests([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const latest = requests[0];
  const verified = isVerified(institution) || latest?.status === "approved";
  const statusColor = verified ? colors.success : latest?.status === "rejected" ? colors.error : colors.warning;
  const docs = useMemo(() => {
    return requests.flatMap((request) => {
      const rows = [];
      if (request.document_url) {
        rows.push({ name: `${request.institution_name || getInstitutionName(institution)} verification document`, type: "Document", url: request.document_url });
      }
      if (request.logo_url) {
        rows.push({ name: "Institution logo", type: "Image", url: request.logo_url });
      }
      return rows;
    });
  }, [institution, requests]);

  const timeline = [
    {
      icon: "cloud-upload" as const,
      title: "Application submitted",
      date: formatDate(latest?.created_at),
      done: Boolean(latest),
      note: latest ? "Institution details and verification files were submitted." : "Submit verification details to start review.",
    },
    {
      icon: "eye" as const,
      title: "Under review",
      date: latest ? formatDate(latest.updated_at || latest.created_at) : "Not started",
      done: Boolean(latest && latest.status !== "draft"),
      note: latest?.review_notes || "Review status updates from the admin team will appear here.",
    },
    {
      icon: latest?.status === "rejected" ? "close-circle" as const : "checkmark-circle" as const,
      title: latest?.status === "rejected" ? "Changes requested" : "Approved & verified",
      date: verified ? formatDate(institution?.verified_at || institution?.verifiedAt || latest?.updated_at || latest?.created_at) : "Pending",
      done: verified || latest?.status === "rejected" || latest?.status === "needs_changes",
      note: verified ? "Your institution is verified. Public posts are live." : latest?.status === "rejected" || latest?.status === "needs_changes" ? latest?.review_notes || "Review the requested changes and resubmit." : "Approval will appear here after review is complete.",
    },
  ];

  const openUrl = (url: string) => Linking.openURL(url).catch(() => Alert.alert("Could not open file", "The document link is not available."));

  const uploadDoc = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const formData = await formDataFromAsset(asset as any, asset.name || "institution-document.pdf", asset.mimeType || "application/pdf");
    setUploading(true);
    try {
      const response = await api.uploadInstitutionDoc(formData);
      await api.institutions.updateMe({ documentUrl: response.url }).catch(() => {});
      Alert.alert("Document uploaded", "The file was uploaded and attached to your verification request.");
      load();
    } catch (error) {
      Alert.alert("Upload failed", getUserErrorMessage(error, "Could not upload this document."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="verification-screen">
      <Header title="Verification" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={[styles.statusCard, { backgroundColor: statusColor + "22", borderColor: statusColor + "44" }]}>
          <View style={[styles.statusIcon, { backgroundColor: statusColor }]}>
            <Ionicons name={verified ? "shield-checkmark" : latest?.status === "rejected" ? "alert-circle" : "time"} size={26} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: statusColor, fontSize: font.sm, fontWeight: "500", letterSpacing: 0.3 }}>{verified ? "APPROVED" : statusLabel(institution)}</Text>
            <Text style={{ color: colors.onSurface, fontSize: font.xl, fontWeight: "500", marginTop: 2 }}>
              {verified ? "You're verified" : getInstitutionName(institution, requests)}
            </Text>
            <Text style={{ color: colors.onSurfaceSecondary, fontSize: font.sm, marginTop: 4, lineHeight: 18 }}>
              {verified
                ? `Approved on ${formatDate(institution?.verified_at || institution?.verifiedAt || latest?.created_at)}. Your institution page and posts are live campus-wide.`
                : latest
                  ? `Current status: ${String(latest.status || "pending").replace("_", " ")}.`
                  : "No verification request has been submitted yet."}
            </Text>
          </View>
        </View>

        <Text style={[styles.section, { color: colors.onSurfaceTertiary }]}>TIMELINE</Text>
        <View style={{ paddingHorizontal: spacing.lg }}>
          {timeline.map((t, i) => (
            <View key={t.title} style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ alignItems: "center" }}>
                <View style={[styles.timelineDot, { backgroundColor: t.done ? colors.brandPrimary : colors.borderStrong }]}>
                  <Ionicons name={t.icon} size={14} color="#fff" />
                </View>
                {i < timeline.length - 1 && <View style={{ width: 2, flex: 1, backgroundColor: t.done ? colors.brandPrimary : colors.borderStrong, marginVertical: 2 }} />}
              </View>
              <View style={{ flex: 1, paddingBottom: spacing.xl }}>
                <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{t.title}</Text>
                <Text style={{ color: colors.muted, fontSize: font.sm, marginTop: 2 }}>{t.date}</Text>
                <Text style={{ color: colors.onSurfaceSecondary, fontSize: font.sm, marginTop: 6, lineHeight: 18 }}>{t.note}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.section, { color: colors.onSurfaceTertiary }]}>DOCUMENTS ON FILE</Text>
        {docs.length === 0 ? (
          <EmptyState icon="document-text-outline" title="No documents on file" message="Uploaded verification files will appear here." />
        ) : (
          <View style={[styles.docCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            {docs.map((d, i) => (
              <View key={`${d.url}-${i}`}>
                {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: spacing.lg }} />}
                <View style={styles.docRow}>
                  <View style={[styles.docIcon, { backgroundColor: colors.brandTertiary }]}>
                    <Ionicons name="document-text" size={20} color={colors.onBrandTertiary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }} numberOfLines={1}>{d.name}</Text>
                    <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{d.type}</Text>
                  </View>
                  <Pressable hitSlop={8} onPress={() => openUrl(d.url)}>
                    <Ionicons name="download-outline" size={20} color={colors.onSurfaceTertiary} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        <Pressable style={[styles.uploadBox, { borderColor: colors.borderStrong }]} onPress={uploadDoc} disabled={uploading}>
          <Ionicons name="add" size={18} color={colors.brandPrimary} />
          <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "500" }}>{uploading ? "Uploading document" : "Upload additional documents"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  statusCard: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", margin: spacing.lg, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  statusIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  section: { fontSize: font.sm, fontWeight: "500", letterSpacing: 0.5, paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.md },
  timelineDot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  docCard: { marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  docRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  docIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  uploadBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.md, height: 48, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed" },
});
