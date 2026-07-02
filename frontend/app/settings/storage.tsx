import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import SettingsRow from "@/src/components/SettingsRow";

export default function Storage() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Storage & data" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.summaryCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 }}>Cache usage</Text>
          <Text style={{ color: colors.onSurface, fontSize: 32, fontWeight: "500", marginTop: spacing.sm }}>142.8 MB</Text>
          <View style={styles.bar}>
            <View style={{ flex: 3, backgroundColor: colors.brandPrimary, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }} />
            <View style={{ flex: 2, backgroundColor: colors.brandSecondary }} />
            <View style={{ flex: 1, backgroundColor: colors.info, borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md }}>
            <Legend color={colors.brandPrimary} label="Media" value="72 MB" />
            <Legend color={colors.brandSecondary} label="Docs" value="48 MB" />
            <Legend color={colors.info} label="Other" value="22 MB" />
          </View>
        </View>

        <Section title="Auto-download">
          <SettingsRow icon="wifi-outline" title="On Wi-Fi" value="Photos, Videos" onPress={() => {}} />
          <Divider />
          <SettingsRow icon="cellular-outline" title="On mobile data" value="Photos only" onPress={() => {}} />
          <Divider />
          <SettingsRow icon="cloud-outline" title="When roaming" value="Never" onPress={() => {}} />
        </Section>

        <Section title="Manage">
          <SettingsRow icon="trash-outline" title="Clear cache" subtitle="Free up 142.8 MB" onPress={() => {}} />
          <Divider />
          <SettingsRow icon="download-outline" title="Download quality" value="Auto" onPress={() => {}} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>{label}</Text>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "500", paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</Text>
      <View style={{ marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, overflow: "hidden" }}>{children}</View>
    </View>
  );
}
function Divider() { const { colors } = useTheme(); return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 68 }} />; }
const styles = StyleSheet.create({
  summaryCard: { margin: spacing.lg, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  bar: { height: 8, borderRadius: 4, flexDirection: "row", marginTop: spacing.md, overflow: "hidden" },
});
