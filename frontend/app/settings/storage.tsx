import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import SettingsRow from "@/src/components/SettingsRow";
import { api } from "@/src/lib/api";

const defaults = {
  wifiDownload: "Photos",
  mobileDownload: "Never",
  roamingDownload: "Never",
  downloadQuality: "Auto",
};

const options = {
  wifiDownload: ["Never", "Photos", "Photos, videos"],
  mobileDownload: ["Never", "Photos", "Photos, videos"],
  roamingDownload: ["Never", "Photos"],
  downloadQuality: ["Auto", "Data saver", "High quality"],
};

export default function Storage() {
  const { colors } = useTheme();
  const router = useRouter();
  const [prefs, setPrefs] = useState(defaults);

  useEffect(() => {
    api.users.settings()
      .then((row: any) => setPrefs({ ...defaults, ...(row.preferences?.storage || {}) }))
      .catch(() => setPrefs(defaults));
  }, []);

  const cycle = (key: keyof typeof defaults) => {
    const list = options[key];
    const current = list.indexOf(prefs[key]);
    const next = { ...prefs, [key]: list[(current + 1) % list.length] };
    setPrefs(next);
    api.users.updateSettings({ preferences: { storage: next } }).catch(() => {});
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Storage & data" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.summaryCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 }}>Device cache</Text>
          <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500", marginTop: spacing.sm }}>Not tracked by server</Text>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 4, lineHeight: 20 }}>
            Download preferences below are saved to your account.
          </Text>
        </View>

        <Section title="Auto-download">
          <SettingsRow icon="wifi-outline" title="On Wi-Fi" value={prefs.wifiDownload} onPress={() => cycle("wifiDownload")} />
          <Divider />
          <SettingsRow icon="cellular-outline" title="On mobile data" value={prefs.mobileDownload} onPress={() => cycle("mobileDownload")} />
          <Divider />
          <SettingsRow icon="cloud-outline" title="When roaming" value={prefs.roamingDownload} onPress={() => cycle("roamingDownload")} />
        </Section>

        <Section title="Manage">
          <SettingsRow icon="download-outline" title="Download quality" value={prefs.downloadQuality} onPress={() => cycle("downloadQuality")} />
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
      <View style={{ marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, overflow: "hidden" }}>{children}</View>
    </View>
  );
}
function Divider() { const { colors } = useTheme(); return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 68 }} />; }
const styles = StyleSheet.create({
  summaryCard: { margin: spacing.lg, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
});
