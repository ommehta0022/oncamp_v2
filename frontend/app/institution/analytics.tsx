import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import { api } from "@/src/lib/api";
import {
  formatNumber,
  formatPercent,
  getInstitutionName,
  getPalette,
  makeChartValues,
  type InstitutionAnalyticsData,
  type InstitutionDashboardData,
} from "@/src/lib/institution";

const RANGES = ["7d", "30d", "90d", "1y"];

export default function Analytics() {
  const { colors } = useTheme();
  const router = useRouter();
  const [range, setRange] = useState("30d");
  const [data, setData] = useState<InstitutionAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const dashboard = (await api.institutions.dashboard()) as InstitutionDashboardData;
        if (!dashboard.institution?.id) {
          const request = dashboard.verificationRequests?.[0];
          if (mounted) {
            setData({
              institution: {
                name: request?.institution_name,
                institution_type: request?.institution_type,
                logo_url: request?.logo_url,
                status: request?.status || "pending",
              },
              counts: { reach: 0, members: 0, groups: 0, posts: 0, engagements: 0, approvalRate: 0 },
              topGroups: [],
              topPosts: [],
            });
          }
          return;
        }
        const next = (await api.institutions.analytics()) as InstitutionAnalyticsData;
        if (mounted) setData(next);
      } catch {
        if (mounted) setData(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const counts = data?.counts || {};
  const palette = getPalette(data?.institution);
  const kpis = [
    { label: "Reach", value: formatNumber(counts.reach), detail: "live", up: true, icon: "eye" as const, color: palette.primary },
    { label: "New members", value: formatNumber(counts.members), detail: "total", up: true, icon: "person-add" as const, color: palette.secondary },
    { label: "Engagement", value: formatNumber(counts.engagements), detail: "actions", up: true, icon: "heart" as const, color: "#D14D4D" },
    { label: "Post approval rate", value: formatPercent(counts.approvalRate), detail: "requests", up: Number(counts.approvalRate || 0) >= 50, icon: "checkmark-circle" as const, color: "#4A788C" },
  ];
  const chartValues = makeChartValues(Number(counts.members || 0), data?.topGroups || []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="analytics-screen">
      <Header title="Analytics" subtitle={`${getInstitutionName(data?.institution)} - overview`} onBack={() => router.back()} />

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, flexDirection: "row", gap: spacing.sm }}>
        {RANGES.map((r) => (
          <Pressable key={r} onPress={() => setRange(r)} style={[styles.chip, { backgroundColor: range === r ? colors.brandPrimary : colors.surfaceTertiary }]}>
            <Text style={{ color: range === r ? colors.onBrandPrimary : colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>{r}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.kpiGrid}>
          {kpis.map((k) => (
            <View key={k.label} style={[styles.kpi, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={[styles.kpiIcon, { backgroundColor: k.color + "22" }]}>
                  <Ionicons name={k.icon} size={16} color={k.color} />
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <Ionicons name={k.up ? "trending-up" : "trending-down"} size={12} color={k.up ? colors.success : colors.error} />
                  <Text style={{ color: k.up ? colors.success : colors.error, fontSize: font.sm, fontWeight: "500" }}>{k.detail}</Text>
                </View>
              </View>
              <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "500", marginTop: spacing.sm }}>{k.value}</Text>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{k.label}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.section, { color: colors.onSurface }]}>Growth</Text>
        <View style={[styles.chartCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>Members over time</Text>
              <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "500", marginTop: 2 }}>{formatNumber(counts.members)}</Text>
            </View>
            <View style={[styles.pillGood, { backgroundColor: colors.success + "22" }]}>
              <Text style={{ color: colors.success, fontSize: font.sm, fontWeight: "500" }}>Live data</Text>
            </View>
          </View>
          <Chart values={chartValues} color={palette.primary} />
        </View>

        <Text style={[styles.section, { color: colors.onSurface }]}>Top groups</Text>
        {(data?.topGroups || []).length === 0 ? (
          <EmptyState icon="people-outline" title={loading ? "Loading groups" : "No group analytics yet"} message="Group analytics will appear after members join institution groups." />
        ) : (
          <View style={[styles.listCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            {(data?.topGroups || []).map((g, i) => (
              <View key={g.id || g.name || i}>
                {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: spacing.lg }} />}
                <View style={styles.listRow}>
                  <View style={[styles.rank, { backgroundColor: colors.brandTertiary }]}>
                    <Text style={{ color: colors.onBrandTertiary, fontSize: font.sm, fontWeight: "500" }}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }} numberOfLines={1}>{g.name || "Institution group"}</Text>
                    <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{formatNumber(g.members)} members</Text>
                  </View>
                  <Text style={{ color: colors.success, fontSize: font.sm, fontWeight: "500" }}>{formatNumber(g.members)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.section, { color: colors.onSurface }]}>Top posts</Text>
        {(data?.topPosts || []).length === 0 ? (
          <EmptyState icon="document-text-outline" title={loading ? "Loading posts" : "No post analytics yet"} message="Views and likes will appear after real users interact with posts." />
        ) : (
          <View style={[styles.listCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginBottom: spacing.lg }]}>
            {(data?.topPosts || []).map((p, i) => (
              <View key={p.id || p.title || i}>
                {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: spacing.lg }} />}
                <Pressable style={styles.listRow} onPress={() => p.id && router.push(`/post/${p.id}`)}>
                  <View style={[styles.rank, { backgroundColor: colors.brandSecondary + "22" }]}>
                    <Ionicons name="megaphone" size={16} color={colors.brandSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }} numberOfLines={1}>{p.title || "Institution post"}</Text>
                    <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>
                      {formatNumber(p.views)} views - {formatNumber(p.likes)} likes
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceTertiary} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Chart({ values, color }: { values: number[]; color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: 120, gap: 6, marginTop: spacing.md }}>
      {values.map((v, i) => (
        <View key={i} style={{ flex: 1, height: `${v}%`, borderRadius: 6, backgroundColor: i === values.length - 1 ? color : color + "55" }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { height: 34, paddingHorizontal: spacing.lg, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, padding: spacing.lg },
  kpi: { width: "47.5%", padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  kpiIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  section: { fontSize: font.lg, fontWeight: "500", paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.md },
  chartCard: { marginHorizontal: spacing.lg, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  chartHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  pillGood: { paddingHorizontal: spacing.md, height: 28, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  listCard: { marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  listRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rank: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
