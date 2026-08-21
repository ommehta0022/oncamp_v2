import React, { useEffect, useState } from "react";
import { Alert, View, Text, StyleSheet, ScrollView, Switch, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import SettingsRow from "@/src/components/SettingsRow";
import { api } from "@/src/lib/api";

const defaults = { push: true, campus: true, social: true, deviceAlerts: true };

export default function Notifs() {
  const { colors } = useTheme();
  const router = useRouter();
  const [state, setState] = useState(defaults);

  useEffect(() => {
    Promise.all([
      api.users.notificationPreferences().catch(() => null),
      api.users.settings().catch(() => null),
    ]).then(([row, settings]: any[]) => {
      if (!row) return;
      setState({
        push: row.pushEnabled !== false,
        campus: row.announcements !== false || row.joinRequests !== false,
        social: row.mentions !== false || row.postActivity !== false,
        deviceAlerts: settings?.preferences?.sound !== false || settings?.preferences?.vibrate !== false,
      });
    });
  }, []);

  const save = async (key: keyof typeof state, value: boolean) => {
    const previous = state;
    const next = { ...state, [key]: value };
    setState(next);
    if (Platform.OS === "ios") void Haptics.selectionAsync();
    try {
      if (key === "push") await api.users.updateNotificationPreferences({ pushEnabled: value });
      if (key === "campus") await api.users.updateNotificationPreferences({ announcements: value, joinRequests: value });
      if (key === "social") await api.users.updateNotificationPreferences({ mentions: value, postActivity: value });
      if (key === "deviceAlerts") await api.users.updateSettings({ preferences: { sound: value, vibrate: value } });
    } catch (error) {
      setState(previous);
      Alert.alert("Save failed", error instanceof Error ? error.message : "Could not save notification settings.");
    }
  };

  const sw = (key: keyof typeof state) => <Switch value={state[key]} onValueChange={(value) => void save(key, value)} trackColor={{ true: colors.brandPrimary, false: colors.borderStrong || colors.border }} thumbColor="#fff" ios_backgroundColor={colors.borderStrong || colors.border} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background || colors.surface }} edges={["top"]} testID="notif-settings-screen">
      <Header title="Notifications" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
          <Text style={{ color: colors.onSurface, fontSize: 19, fontWeight: "800" }}>Keep notifications simple</Text>
          <Text style={{ color: colors.onSurfaceTertiary, marginTop: 5, lineHeight: 20 }}>Choose the types of updates you want instead of managing many individual switches.</Text>
        </View>
        <Section>
          <SettingsRow icon="notifications" title="Push notifications" subtitle="Master switch for notifications on this device" right={sw("push")} />
          <Divider />
          <SettingsRow icon="school" title="Campus essentials" subtitle="Announcements, event updates and important institution activity" right={sw("campus")} />
          <Divider />
          <SettingsRow icon="people" title="Community activity" subtitle="Mentions, replies and reactions involving you" right={sw("social")} />
          <Divider />
          <SettingsRow icon="phone-portrait" title="Sound & vibration" subtitle="Use your device alert sound and vibration" right={sw("deviceAlerts")} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.section, { backgroundColor: colors.surfaceSecondary || colors.surface }]}>{children}</View>;
}
function Divider() { const { colors } = useTheme(); return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border || colors.divider, marginLeft: 56 }} />; }
const styles = StyleSheet.create({ section: { marginHorizontal: spacing.xl, marginTop: spacing.xl, borderRadius: radius.lg, overflow: "hidden" } });
