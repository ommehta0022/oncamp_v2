import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import SettingsRow from "@/src/components/SettingsRow";

export default function Privacy() {
  const { colors } = useTheme();
  const router = useRouter();
  const [s, set] = useState({ showPhone: false, showEmail: false, readReceipts: true, lastSeen: true, discoverable: true });
  const Sw = (k: keyof typeof s) => (
    <Switch value={s[k]} onValueChange={() => set((v) => ({ ...v, [k]: !v[k] }))} trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }} thumbColor="#fff" />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Privacy" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.hint, { color: colors.onSurfaceTertiary }]}>
          Because OnCampus is group-only, most privacy is handled at the group level.
        </Text>
        <Section title="Profile visibility">
          <SettingsRow icon="call-outline" title="Show phone number" subtitle="Members can see your phone" right={Sw("showPhone")} />
          <Divider />
          <SettingsRow icon="mail-outline" title="Show email" subtitle="Members can see your email" right={Sw("showEmail")} />
          <Divider />
          <SettingsRow icon="search-outline" title="Discoverable in search" right={Sw("discoverable")} />
        </Section>
        <Section title="Messaging">
          <SettingsRow icon="checkmark-done-outline" title="Read receipts" right={Sw("readReceipts")} />
          <Divider />
          <SettingsRow icon="time-outline" title="Last seen" right={Sw("lastSeen")} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "500", paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</Text>
      <View style={{ marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, overflow: "hidden" }}>
        {children}
      </View>
    </View>
  );
}
function Divider() { const { colors } = useTheme(); return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 68 }} />; }
const styles = StyleSheet.create({ hint: { padding: spacing.lg, fontSize: font.sm, lineHeight: 20 } });
