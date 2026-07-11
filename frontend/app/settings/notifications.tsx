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
    if (Platform.OS === 'ios') Haptics.selectionAsync();
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
      trackColor={{ true: colors.brandPrimary, false: colors.borderStrong || colors.border }}
      thumbColor="#fff"
      ios_backgroundColor={colors.borderStrong || colors.border}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background || colors.surface }} edges={["top"]} testID="notif-settings-screen">
      <Header title="Notifications" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <Section title="Push">
          <SettingsRow icon="notifications" title="Enable push" subtitle="All notifications" right={Sw("push")} />
        </Section>
        <Section title="Group activity">
          <SettingsRow icon="at" title="Mentions" subtitle="When someone @mentions you" right={Sw("mentions")} />
          <Divider />
          <SettingsRow icon="chatbubble-ellipses" title="Replies to you" subtitle="When someone replies to your post" right={Sw("postActivity")} />
          <Divider />
          <SettingsRow icon="megaphone" title="Announcements" subtitle="Important group updates" right={Sw("announcements")} />
          <Divider />
          <SettingsRow icon="person-add" title="Join requests" subtitle="When someone asks to join your group" right={Sw("joinRequests")} />
        </Section>
        <Section title="Sound & vibration">
          <SettingsRow icon="musical-notes" title="Sound" right={Sw("sound")} />
          <Divider />
          <SettingsRow icon="phone-portrait" title="Vibrate" right={Sw("vibrate")} />
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
  section: {
    marginHorizontal: spacing.xl, borderRadius: radius.lg, overflow: "hidden",
  },
});
