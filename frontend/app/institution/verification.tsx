import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
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

  useEffect(() => {
    api.institutions.dashboard().then(setDashboard).catch(() => setDashboard(null));
  }, []);

  const institution = dashboard?.institution;
  const requests = dashboard?.verificationRequests || [];
  const verified = !!institution?.verified_at || institution?.status === "approved";

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
              {institution?.verified_at ? `Verified at ${institution.verified_at}` : "Verification details are fetched from Supabase."}
            </Text>
          </View>
        </View>

        <Text style={[styles.section, { color: colors.onSurfaceTertiary }]}>REQUESTS</Text>
        {requests.length === 0 ? (
          <EmptyState icon="document-text-outline" title="No verification requests" message="Submitted institution verification requests will appear here." />
        ) : (
          <View style={[styles.docCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            {requests.map((request: any, index: number) => (
              <View key={request.id}>
                {index > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: spacing.lg }} />}
                <View style={styles.docRow}>
                  <View style={[styles.docIcon, { backgroundColor: colors.brandTertiary }]}>
                    <Ionicons name="document-text" size={20} color={colors.onBrandTertiary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }} numberOfLines={1}>{request.status}</Text>
                    <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{request.created_at}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  statusCard: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", margin: spacing.lg, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  statusIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  section: { fontSize: font.sm, fontWeight: "500", letterSpacing: 0.5, paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.md },
  docCard: { marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  docRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  docIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
