import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import Avatar from "@/src/components/Avatar";
import { api } from "@/src/lib/api";

export default function InstitutionAdmins() {
  const { colors } = useTheme();
  const router = useRouter();
  const [admins, setAdmins] = useState<any[]>([]);

  useEffect(() => {
    api.institutions.admins().then((rows: any) => Array.isArray(rows) && setAdmins(rows)).catch(() => setAdmins([]));
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="institution-admins-screen">
      <Header
        title="Institution admins"
        subtitle={`${admins.length} admins`}
        onBack={() => router.back()}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.md }}>
        {admins.length === 0 && (
          <EmptyState icon="person-add-outline" title="No admins loaded" message="Institution admin records will appear here after approval and admin invites are connected." />
        )}
        {admins.map((admin) => (
          <View key={admin.id} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Avatar uri={admin.user?.avatarUrl} name={admin.user?.name || "Admin"} size={48} verified={admin.user?.verified} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }}>{admin.user?.name || "Admin"}</Text>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }} numberOfLines={1}>{admin.user?.bio || admin.user?.course || "Institution admin"}</Text>
              </View>
              <View style={[styles.roleTag, { backgroundColor: colors.brandTertiary }]}>
                <Text style={{ color: colors.onBrandTertiary, fontSize: 10, fontWeight: "500", letterSpacing: 0.3 }}>{String(admin.role || "admin").toUpperCase()}</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  roleTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, borderWidth: 1,
  },
});
