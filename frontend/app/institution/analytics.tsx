import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";

const RANGES = ["7d", "30d", "90d", "1y"];

const KPIS = [
  { label: "Reach", value: "42,840", trend: "+12.4%", up: true, icon: "eye" as const, color: "#2E5C4E" },
  { label: "New members", value: "1,284", trend: "+18.2%", up: true, icon: "person-add" as const, color: "#E87A5D" },
  { label: "Engagement", value: "72.4%", trend: "+3.1%", up: true, icon: "heart" as const, color: "#D14D4D" },
  { label: "Post approval rate", value: "94%", trend: "-2.0%", up: false, icon: "checkmark-circle" as const, color: "#4A788C" },
];

const TOP_GROUPS = [
  { name: "CSE Batch of 2026", members: 248, growth: "+12" },
  { name: "IITB Robotics Club", members: 512, growth: "+8" },
  { name: "Placement Prep 2026", members: 156, growth: "+24" },
  { name: "Mood Indigo Volunteers", members: 380, growth: "+2" },
];

const TOP_POSTS = [
  { title: "Semester exam schedule released", views: 4820, likes: 342 },
  { title: "Guest lecture · Quantum Computing", views: 2140, likes: 210 },
  { title: "Mood Indigo Volunteer sign-ups", views: 1680, likes: 89 },
];

export default function Analytics() {
  const { colors } = useTheme();
  const router = useRouter();
  const [range, setRange] = useState("30d");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="analytics-screen">
      <Header title="Analytics" subtitle="IIT Bombay · overview" onBack={() => router.back()} />

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, flexDirection: "row", gap: spacing.sm }}>
        {RANGES.map((r) => (
          <Pressable
            key={r}
            onPress={() => setRange(r)}
            style={[styles.chip, { backgroundColor: range === r ? colors.brandPrimary : colors.surfaceTertiary }]}
          >
            <Text style={{ color: range === r ? colors.onBrandPrimary : colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>{r}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.kpiGrid}>
          {KPIS.map((k) => (
            <View key={k.label} style={[styles.kpi, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={[styles.kpiIcon, { backgroundColor: k.color + "22" }]}>
                  <Ionicons name={k.icon} size={16} color={k.color} />
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <Ionicons name={k.up ? "trending-up" : "trending-down"} size={12} color={k.up ? colors.success : colors.error} />
                  <Text style={{ color: k.up ? colors.success : colors.error, fontSize: font.sm, fontWeight: "500" }}>{k.trend}</Text>
                </View>
              </View>
              <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "500", letterSpacing: -0.5, marginTop: spacing.sm }}>{k.value}</Text>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{k.label}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.section, { color: colors.onSurface }]}>Growth</Text>
        <View style={[styles.chartCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>Members over time</Text>
              <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "500", marginTop: 2, letterSpacing: -0.5 }}>8,420</Text>
            </View>
            <View style={[styles.pillGood, { backgroundColor: colors.success + "22" }]}>
              <Text style={{ color: colors.success, fontSize: font.sm, fontWeight: "500" }}>+124 this week</Text>
            </View>
          </View>
          <FakeChart color={colors.brandPrimary} />
        </View>

        <Text style={[styles.section, { color: colors.onSurface }]}>Top groups</Text>
        <View style={[styles.listCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          {TOP_GROUPS.map((g, i) => (
            <View key={g.name}>
              {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: spacing.lg }} />}
              <View style={styles.listRow}>
                <View style={[styles.rank, { backgroundColor: colors.brandTertiary }]}>
                  <Text style={{ color: colors.onBrandTertiary, fontSize: font.sm, fontWeight: "500" }}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }} numberOfLines={1}>{g.name}</Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{g.members} members</Text>
                </View>
                <Text style={{ color: colors.success, fontSize: font.sm, fontWeight: "500" }}>{g.growth}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.section, { color: colors.onSurface }]}>Top posts</Text>
        <View style={[styles.listCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginBottom: spacing.lg }]}>
          {TOP_POSTS.map((p, i) => (
            <View key={p.title}>
              {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: spacing.lg }} />}
              <View style={styles.listRow}>
                <View style={[styles.rank, { backgroundColor: colors.brandSecondary + "22" }]}>
                  <Ionicons name="megaphone" size={16} color={colors.brandSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }} numberOfLines={1}>{p.title}</Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>
                    {p.views.toLocaleString()} views · {p.likes} likes
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceTertiary} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FakeChart({ color }: { color: string }) {
  // Simple visual chart with animated-looking bars
  const values = [30, 45, 38, 62, 55, 78, 72, 88, 82, 95, 90, 100];
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: 120, gap: 6, marginTop: spacing.md }}>
      {values.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1, height: `${v}%`, borderRadius: 6,
            backgroundColor: i === values.length - 1 ? color : color + "55",
          }}
        />
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
