import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Switch, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import SettingsRow from "@/src/components/SettingsRow";
import { api } from "@/src/lib/api";
import { typography } from "@/src/theme/typography";

const defaults = { showPhone: false, showEmail: false, readReceipts: true, lastSeen: true, discoverable: true };

export default function Privacy() {
  const { colors } = useTheme();
  const router = useRouter();
  const [s, set] = useState(defaults);
  
  useEffect(() => {
    api.users.settings()
      .then((row: any) => set({ ...defaults, ...(row.privacy || {}) }))
      .catch(() => set(defaults));
  }, []);
  
  const update = (k: keyof typeof s) => {
    if (Platform.OS === 'ios') Haptics.selectionAsync();
    const next = { ...s, [k]: !s[k] };
    set(next);
    api.users.updateSettings({ privacy: { [k]: next[k] } }).catch(() => {});
  };
  
  const Sw = (k: keyof typeof s) => (
    <Switch 
      value={s[k]} 
      onValueChange={() => update(k)} 
      trackColor={{ true: colors.brandPrimary, false: colors.borderStrong || colors.border }} 
      thumbColor="#fff" 
      ios_backgroundColor={colors.borderStrong || colors.border}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background || colors.surface }} edges={["top"]}>
      <Header title="Privacy" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <Text style={[styles.hint, { color: colors.textSecondary || colors.onSurfaceTertiary, ...typography.body }]}>
          Because ONCAMPUS is group-focused, most privacy settings are handled at the group level.
        </Text>
        <Section title="Profile visibility">
          <SettingsRow icon="call" title="Show phone number" subtitle="Members can see your phone" right={Sw("showPhone")} />
          <Divider />
          <SettingsRow icon="mail" title="Show email" subtitle="Members can see your email" right={Sw("showEmail")} />
          <Divider />
          <SettingsRow icon="search" title="Discoverable in search" subtitle="Allow others to find you" right={Sw("discoverable")} />
        </Section>
        <Section title="Messaging">
          <SettingsRow icon="checkmark-done" title="Read receipts" right={Sw("readReceipts")} />
          <Divider />
          <SettingsRow icon="time" title="Last seen" right={Sw("lastSeen")} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={{ 
        color: colors.textSecondary || colors.onSurfaceTertiary, 
        fontSize: 12, 
        fontWeight: "700", 
        paddingHorizontal: spacing.xl, 
        marginTop: spacing.md, 
        marginBottom: spacing.sm, 
        textTransform: "uppercase", 
        letterSpacing: 1 
      }}>
        {title}
      </Text>
      <View style={[
        styles.section, 
        { 
          backgroundColor: colors.surfaceSecondary || colors.surface, 
        }
      ]}>
        {children}
      </View>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border || colors.divider, marginLeft: 56 }} />;
}

const styles = StyleSheet.create({
  hint: { 
    paddingHorizontal: spacing.xl, 
    paddingVertical: spacing.lg, 
    fontSize: 14, 
    lineHeight: 22,
    fontWeight: "500",
  },
  section: {
    marginHorizontal: spacing.xl, borderRadius: radius.lg, overflow: "hidden",
  },
});
