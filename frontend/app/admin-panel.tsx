import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { spacing, radius, font } from "@/src/theme/colors";
import { api } from "@/src/lib/api";
import { useRole } from "@/src/context/RoleProvider";
import { NetworkError } from "@/src/components/NetworkError";

export default function AdminPanelScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { role } = useRole();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (role !== "platform_admin") {
      Alert.alert("Access Denied", "You do not have permission to view this page.");
      router.back();
      return;
    }

    fetchDashboard();
  }, [role, router]);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.admin.dashboard();
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (role !== "platform_admin") return null;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surface }]}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  if (error && !data) {
    return <NetworkError onRetry={fetchDashboard} message={error} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.onSurface }]}>Admin Panel</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Ionicons name="people" size={24} color={colors.brandPrimary} />
            <Text style={[styles.statValue, { color: colors.onSurface }]}>{data?.users_count || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Total Users</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Ionicons name="business" size={24} color={colors.brandPrimary} />
            <Text style={[styles.statValue, { color: colors.onSurface }]}>{data?.groups_count || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Total Groups</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: font.lg,
    fontWeight: "bold",
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
  },
});
