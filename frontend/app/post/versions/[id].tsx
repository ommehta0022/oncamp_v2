import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import { API_BASE_URL, getAccessToken } from "@/src/lib/api";

export default function VersionHistory() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const token = await getAccessToken();
      const response = await fetch(`${API_BASE_URL}/campus/posts/${id}/versions`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.detail || "Could not load version history.");
      setVersions(Array.isArray(data) ? data : []);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load version history."); }
    finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Version history" onBack={() => router.back()} />
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View> : error ? <View style={styles.center}><Ionicons name="alert-circle-outline" size={32} color={colors.error} /><Text style={{ color: colors.onSurface, fontWeight: "700", marginTop: 10 }}>{error}</Text></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 70 }}>
          {versions.length === 0 ? <View style={styles.centerBlock}><Ionicons name="time-outline" size={32} color={colors.onSurfaceTertiary} /><Text style={{ color: colors.onSurface, fontWeight: "700", marginTop: 10 }}>No revisions yet</Text><Text style={{ color: colors.onSurfaceTertiary, textAlign: "center", marginTop: 5 }}>The first indexed version will appear automatically.</Text></View> : versions.map((item, index) => <View key={item.id} style={styles.timelineRow}><View style={styles.timeline}><View style={[styles.dot, { backgroundColor: index === 0 ? colors.brandPrimary : colors.border }]} />{index < versions.length - 1 && <View style={[styles.line, { backgroundColor: colors.border }]} />}</View><View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><View style={styles.cardTop}><Text style={{ color: colors.brandPrimary, fontWeight: "800" }}>Version {item.version}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 11 }}>{new Date(item.created_at).toLocaleString()}</Text></View><Text style={{ color: colors.onSurface, fontWeight: "700", marginTop: 8 }}>{item.title || "Untitled post"}</Text><Text style={{ color: colors.onSurfaceTertiary, marginTop: 5, lineHeight: 20 }}>{item.change_summary || "Post updated"}</Text><Text numberOfLines={8} style={{ color: colors.onSurface, marginTop: 10, lineHeight: 20 }}>{item.content || ""}</Text></View></View>)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  centerBlock: { alignItems: "center", paddingVertical: 60 },
  timelineRow: { flexDirection: "row", gap: spacing.md }, timeline: { width: 20, alignItems: "center" }, dot: { width: 10, height: 10, borderRadius: 5, marginTop: 18 }, line: { width: 2, flex: 1, minHeight: 70 },
  card: { flex: 1, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }, cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
});
