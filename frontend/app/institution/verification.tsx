import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";

const TIMELINE = [
  { icon: "cloud-upload" as const, title: "Application submitted", date: "Nov 8, 2025", done: true, note: "You submitted institution details and 3 documents." },
  { icon: "eye" as const, title: "Under review", date: "Nov 9, 2025", done: true, note: "Our team started reviewing your submission." },
  { icon: "call" as const, title: "Verification call completed", date: "Nov 11, 2025", done: true, note: "Phone verification with Dr. Ramesh Iyer (Dean of Student Affairs)." },
  { icon: "checkmark-circle" as const, title: "Approved & verified", date: "Nov 12, 2025", done: true, note: "Your institution is now verified. Public posts are live." },
];

const DOCS = [
  { name: "AICTE registration certificate", size: "2.4 MB", type: "PDF" },
  { name: "Institution logo (high-res)", size: "820 KB", type: "PNG" },
  { name: "Government authorization letter", size: "1.1 MB", type: "PDF" },
];

export default function Verification() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="verification-screen">
      <Header title="Verification" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={[styles.statusCard, { backgroundColor: colors.success + "22", borderColor: colors.success + "44" }]}>
          <View style={[styles.statusIcon, { backgroundColor: colors.success }]}>
            <Ionicons name="shield-checkmark" size={26} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.success, fontSize: font.sm, fontWeight: "500", letterSpacing: 0.3 }}>APPROVED</Text>
            <Text style={{ color: colors.onSurface, fontSize: font.xl, fontWeight: "500", marginTop: 2, letterSpacing: -0.3 }}>
              You&apos;re verified
            </Text>
            <Text style={{ color: colors.onSurfaceSecondary, fontSize: font.sm, marginTop: 4, lineHeight: 18 }}>
              Approved on Nov 12, 2025. Your institution page and posts are live campus-wide.
            </Text>
          </View>
        </View>

        <Text style={[styles.section, { color: colors.onSurfaceTertiary }]}>TIMELINE</Text>
        <View style={{ paddingHorizontal: spacing.lg }}>
          {TIMELINE.map((t, i) => (
            <View key={t.title} style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ alignItems: "center" }}>
                <View style={[styles.timelineDot, { backgroundColor: t.done ? colors.brandPrimary : colors.borderStrong }]}>
                  <Ionicons name={t.icon} size={14} color="#fff" />
                </View>
                {i < TIMELINE.length - 1 && (
                  <View style={{ width: 2, flex: 1, backgroundColor: t.done ? colors.brandPrimary : colors.borderStrong, marginVertical: 2 }} />
                )}
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
        <View style={[styles.docCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          {DOCS.map((d, i) => (
            <View key={d.name}>
              {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: spacing.lg }} />}
              <View style={styles.docRow}>
                <View style={[styles.docIcon, { backgroundColor: colors.brandTertiary }]}>
                  <Ionicons name="document-text" size={20} color={colors.onBrandTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }} numberOfLines={1}>{d.name}</Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{d.type} · {d.size}</Text>
                </View>
                <Pressable hitSlop={8}>
                  <Ionicons name="download-outline" size={20} color={colors.onSurfaceTertiary} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        <Pressable style={[styles.uploadBox, { borderColor: colors.borderStrong }]}>
          <Ionicons name="add" size={18} color={colors.brandPrimary} />
          <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "500" }}>Upload additional documents</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    flexDirection: "row", gap: spacing.md, alignItems: "flex-start",
    margin: spacing.lg, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1,
  },
  statusIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  section: { fontSize: font.sm, fontWeight: "500", letterSpacing: 0.5, paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.md },
  timelineDot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  docCard: { marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  docRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  docIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  uploadBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    marginHorizontal: spacing.lg, marginTop: spacing.md, height: 48, borderRadius: radius.md,
    borderWidth: 1, borderStyle: "dashed",
  },
});
