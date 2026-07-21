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

const RANGES = ["7d", "30d", "90d", "1y"];

export default function Analytics() {
  const { colors } = useTheme();
  const router = useRouter();
  const [range, setRange] = useState("30d");
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    api.institutions.analytics().then(setData).catch(() => setData(null));
  }, []);

  const counts = data?.counts || {};
  const kpis = [
    { label: "Reach", value: counts.reach || 0, icon: "eye" as const, color: "#2E5C4E" },
    { label: "Members", value: counts.members || 0, icon: "person-add" as const, color: "#E87A5D" },
    { label: "Engagements", value: counts.engagements || 0, icon: "heart" as const, color: "#D14D4D" },
    { label: "Approval rate", value: `${counts.approvalRate || 0}%`, icon: "checkmark-circle" as const, color: "#4A788C" },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="analytics-screen">
      <Header title="Analytics" subtitle={data?.institution?.name || "Real database overview"} onBack={() => router.back()} />

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
              <View style={[styles.kpiIcon, { backgroundColor: k.color + "22" }]}>
                <Ionicons name={k.icon} size={16} color={k.color} />
              </View>
              <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "500", letterSpacing: 0, marginTop: spacing.sm }}>
                {typeof k.value === "number" ? k.value.toLocaleString() : k.value}
              </Text>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{k.label}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.section, { color: colors.onSurface }]}>Top groups</Text>
        {(data?.topGroups || []).length === 0 ? (
          <EmptyState icon="people-outline" title="No group analytics yet" message="Group analytics will appear after real members join institution groups." />
        ) : (
          <View style={[styles.listCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            {data.topGroups.map((group: any, i: number) => (
              <View key={group.id}>
                {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: spacing.lg }} />}
                <View style={styles.listRow}>
                  <View style={[styles.rank, { backgroundColor: colors.brandTertiary }]}>
                    <Text style={{ color: colors.onBrandTertiary, fontSize: font.sm, fontWeight: "500" }}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }} numberOfLines={1}>{group.name}</Text>
                    <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{group.members.toLocaleString()} members</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.section, { color: colors.onSurface }]}>Top posts</Text>
        {(data?.topPosts || []).length === 0 ? (
          <EmptyState icon="document-text-outline" title="No post analytics yet" message="Views and likes will appear after real users interact with posts." />
        ) : (
          <View style={[styles.listCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginBottom: spacing.lg }]}>
            {data.topPosts.map((post: any, i: number) => (
              <View key={post.id}>
                {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: spacing.lg }} />}
                <Pressable style={styles.listRow} onPress={() => router.push(`/post/${post.id}`)}>
                  <View style={[styles.rank, { backgroundColor: colors.brandSecondary + "22" }]}>
                    <Ionicons name="megaphone" size={16} color={colors.brandSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }} numberOfLines={1}>{post.title}</Text>
                    <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>
                      {post.views.toLocaleString()} views - {post.likes.toLocaleString()} likes
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

const styles = StyleSheet.create({
  chip: { height: 34, paddingHorizontal: spacing.lg, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, padding: spacing.lg },
  kpi: { width: "47.5%", padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  kpiIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  section: { fontSize: font.lg, fontWeight: "500", paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.md },
  listCard: { marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  listRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rank: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
