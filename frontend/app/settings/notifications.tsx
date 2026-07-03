import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import SettingsRow from "@/src/components/SettingsRow";
import { api } from "@/src/lib/api";

const defaults = {
  push: true,
  mentions: true,
  announcements: true,
  joinRequests: true,
  postActivity: true,
  sound: true,
  vibrate: true,
};

export default function Notifs() {
  const { colors } = useTheme();
  const router = useRouter();
  const [state, setState] = useState(defaults);
  useEffect(() => {
    api.users.notificationPreferences()
      .then((row: any) => setState({
        ...defaults,
        push: row.pushEnabled,
        mentions: row.mentions,
        announcements: row.announcements,
        joinRequests: row.joinRequests,
        postActivity: row.postActivity,
      }))
      .catch(() => setState(defaults));
  }, []);
  const toggle = (k: keyof typeof state) => {
    const next = { ...state, [k]: !state[k] };
    setState(next);
    const body: Record<string, boolean> = {};
    if (k === "push") body.pushEnabled = next[k];
    else if (k === "postActivity" || k === "mentions" || k === "announcements" || k === "joinRequests") body[k] = next[k];
    else api.users.updateSettings({ preferences: { [k]: next[k] } }).catch(() => {});
    if (Object.keys(body).length > 0) api.users.updateNotificationPreferences(body).catch(() => {});
  };

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
          <SettingsRow icon="arrow-undo" title="Replies to you" right={Sw("postActivity")} />
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
