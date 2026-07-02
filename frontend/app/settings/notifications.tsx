import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import SettingsRow from "@/src/components/SettingsRow";

export default function Notifs() {
  const { colors } = useTheme();
  const router = useRouter();
  const [state, setState] = useState({
    push: true, mentions: true, replies: true, announcements: true, joinRequests: true, marketing: false, sound: true, vibrate: true,
  });
  const toggle = (k: keyof typeof state) => setState((s) => ({ ...s, [k]: !s[k] }));

  const Sw = (k: keyof typeof state) => (
    <Switch
      value={state[k]}
      onValueChange={() => toggle(k)}
      trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }}
      thumbColor="#fff"
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="notif-settings-screen">
      <Header title="Notifications" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Section title="Push">
          <SettingsRow icon="notifications-outline" title="Enable push" subtitle="All notifications" right={Sw("push")} />
        </Section>
        <Section title="Group activity">
          <SettingsRow icon="at" title="Mentions" right={Sw("mentions")} />
          <Divider />
          <SettingsRow icon="arrow-undo" title="Replies to you" right={Sw("replies")} />
          <Divider />
          <SettingsRow icon="megaphone-outline" title="Announcements" right={Sw("announcements")} />
          <Divider />
          <SettingsRow icon="person-add-outline" title="Join requests" right={Sw("joinRequests")} />
        </Section>
        <Section title="Sound & vibration">
          <SettingsRow icon="musical-notes-outline" title="Sound" right={Sw("sound")} />
          <Divider />
          <SettingsRow icon="phone-portrait-outline" title="Vibrate" right={Sw("vibrate")} />
        </Section>
        <Section title="Other">
          <SettingsRow icon="pricetag-outline" title="Product updates" right={Sw("marketing")} />
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
