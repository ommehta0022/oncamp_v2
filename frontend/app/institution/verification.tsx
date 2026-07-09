import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import { api } from "@/src/lib/api";

export default function Verification() {
  const { colors } = useTheme();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setLoading(true);
    api.institutions.dashboard()
      .then(setDashboard)
      .catch((error) => {
        console.error('Failed to load dashboard:', error);
        setDashboard(null);
      })
      .finally(() => setLoading(false));
  };

  const institution = dashboard?.institution;
  const requests = dashboard?.verificationRequests || [];
  const verified = !!institution?.verified_at || institution?.status === "approved";

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return colors.success;
      case 'rejected': return colors.error;
      case 'needs_changes': return colors.warning;
      default: return colors.brandPrimary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return 'checkmark-circle';
      case 'rejected': return 'close-circle';
      case 'needs_changes': return 'alert-circle';
      default: return 'time';
    }
  };

  const openUrl = (url: string) => {
    if (url) {
      Linking.openURL(url).catch(err => console.error('Failed to open URL:', err));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="verification-screen">
      <Header title="Verification" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={[styles.statusCard, { backgroundColor: (verified ? colors.success : colors.warning) + "22", borderColor: (verified ? colors.success : colors.warning) + "44" }]}>
          <View style={[styles.statusIcon, { backgroundColor: verified ? colors.success : colors.warning }]}>
            <Ionicons name={verified ? "shield-checkmark" : "time"} size={26} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: verified ? colors.success : colors.warning, fontSize: font.sm, fontWeight: "500", letterSpacing: 0.3 }}>
              {verified ? "VERIFIED" : String(institution?.status || "PENDING").toUpperCase()}
            </Text>
            <Text style={{ color: colors.onSurface, fontSize: font.xl, fontWeight: "500", marginTop: 2, letterSpacing: -0.3 }}>
              {institution?.name || "Institution verification"}
            </Text>
            <Text style={{ color: colors.onSurfaceSecondary, fontSize: font.sm, marginTop: 4, lineHeight: 18 }}>
              {institution?.verified_at 
                ? `Verified on ${new Date(institution.verified_at).toLocaleDateString()}` 
                : requests.length > 0
                  ? `${requests.length} verification ${requests.length === 1 ? 'request' : 'requests'} submitted`
                  : "Submit verification request to get started"}
            </Text>
          </View>
        </View>

        <Text style={[styles.section, { color: colors.onSurfaceTertiary }]}>VERIFICATION REQUESTS</Text>
        {loading ? (
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <Text style={{ color: colors.onSurfaceTertiary }}>Loading...</Text>
          </View>
        ) : requests.length === 0 ? (
          <EmptyState 
            icon="document-text-outline" 
            title="No verification requests" 
            message="Submitted institution verification requests will appear here." 
          />
        ) : (
          <View style={{ gap: spacing.md, paddingHorizontal: spacing.lg }}>
            {requests.map((request: any) => {
              const statusColor = getStatusColor(request.status);
              return (
                <View 
                  key={request.id} 
                  style={[styles.requestCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                >
                  {/* Status Header */}
                  <View style={styles.requestHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "600" }}>
                        {request.institution_name || "Institution Request"}
                      </Text>
                      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>
                        Submitted {new Date(request.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
                      <Ionicons name={getStatusIcon(request.status)} size={16} color={statusColor} />
                      <Text style={{ color: statusColor, fontSize: font.sm, fontWeight: "600", marginLeft: 4 }}>
                        {request.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Files Section */}
                  {(request.logo_url || request.document_url) && (
                    <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                      {request.logo_url && (
                        <Pressable 
                          onPress={() => openUrl(request.logo_url)}
                          style={[styles.fileRow, { backgroundColor: colors.surfaceTertiary }]}
                        >
                          <View style={[styles.fileIcon, { backgroundColor: colors.brandTertiary }]}>
                            <Ionicons name="image" size={18} color={colors.onBrandTertiary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>
                              Institution Logo
                            </Text>
                            <Text style={{ color: colors.success, fontSize: font.sm, marginTop: 2 }}>
                              ✓ Uploaded
                            </Text>
                          </View>
                          <Ionicons name="open-outline" size={18} color={colors.onSurfaceTertiary} />
                        </Pressable>
                      )}
                      
                      {request.document_url && (
                        <Pressable 
                          onPress={() => openUrl(request.document_url)}
                          style={[styles.fileRow, { backgroundColor: colors.surfaceTertiary }]}
                        >
                          <View style={[styles.fileIcon, { backgroundColor: colors.brandTertiary }]}>
                            <Ionicons name="document-text" size={18} color={colors.onBrandTertiary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>
                              Verification Document
                            </Text>
                            <Text style={{ color: colors.success, fontSize: font.sm, marginTop: 2 }}>
                              ✓ Uploaded
                            </Text>
                          </View>
                          <Ionicons name="open-outline" size={18} color={colors.onSurfaceTertiary} />
                        </Pressable>
                      )}
                    </View>
                  )}

                  {/* Review Notes */}
                  {request.review_notes && (
                    <View style={[styles.notesSection, { backgroundColor: colors.surfaceTertiary }]}>
                      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "600", marginBottom: 4 }}>
                        REVIEW NOTES
                      </Text>
                      <Text style={{ color: colors.onSurface, fontSize: font.sm, lineHeight: 18 }}>
                        {request.review_notes}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Action Button */}
        {!verified && requests.length === 0 && !loading && (
          <Pressable 
            onPress={() => router.push('/(auth)/register-institution')}
            style={[styles.actionButton, { backgroundColor: colors.brandPrimary }]}
          >
            <Text style={{ color: colors.onBrandPrimary, fontSize: font.base, fontWeight: "600" }}>
              Submit Verification Request
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  statusCard: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", margin: spacing.lg, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  statusIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  section: { fontSize: font.sm, fontWeight: "500", letterSpacing: 0.5, paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.md },
  requestCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  requestHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  fileRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.sm },
  fileIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  notesSection: { marginTop: spacing.md, padding: spacing.sm, borderRadius: radius.sm },
  actionButton: { margin: spacing.lg, padding: spacing.md, borderRadius: radius.md, alignItems: "center" },
});
