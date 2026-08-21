import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import { campusApi } from "@/src/lib/campusApi";

export default function Changelog() {
  const { colors } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await campusApi.student.changelog()); }
    catch { setItems([]); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="What’s new" onBack={() => router.back()} />
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 70 }}>
          {items.length === 0 ? <View style={styles.centerBlock}><Ionicons name="sparkles-outline" size={30} color={colors.brandPrimary} /><Text style={{ color: colors.onSurface, fontWeight: "700", fontSize: 18, marginTop: 10 }}>You’re up to date</Text><Text style={{ color: colors.onSurfaceTertiary, textAlign: "center", marginTop: 5 }}>New OnCampus features and important changes will appear here.</Text></View> : items.map((item) => <View key={item.id} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><View style={styles.top}><View style={[styles.version, { backgroundColor: colors.brandPrimary + "16" }]}><Text style={{ color: colors.brandPrimary, fontWeight: "800" }}>{item.version}</Text></View><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12 }}>{new Date(item.published_at || item.created_at).toLocaleDateString()}</Text></View><Text style={{ color: colors.onSurface, fontWeight: "800", fontSize: 18, marginTop: 10 }}>{item.title}</Text><Text style={{ color: colors.onSurfaceTertiary, lineHeight: 21, marginTop: 7 }}>{item.body}</Text></View>)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  centerBlock: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 30 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  version: { borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5 },
});
