import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import SettingsRow from "@/src/components/SettingsRow";

const FAQS = [
  { q: "How do I join a group?", a: "Go to Discover and tap Join on any public group. For private groups, your request will be reviewed." },
  { q: "Can I message someone privately?", a: "OnCampus is group-only. There are no direct messages by design." },
  { q: "How do I verify my student status?", a: "Sign in with your institution email or SSO. Verified badge is granted after review." },
  { q: "How do I report a message?", a: "Long-press any message and choose Report. Our moderation team reviews within 24h." },
];

export default function Help() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Help & support" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[styles.hero, { backgroundColor: colors.brandTertiary }]}>
          <Ionicons name="help-buoy" size={32} color={colors.onBrandTertiary} />
          <Text style={{ color: colors.onBrandTertiary, fontSize: font.xl, fontWeight: "500", marginTop: spacing.sm }}>
            We&apos;re here to help
          </Text>
          <Text style={{ color: colors.onBrandTertiary, fontSize: font.base, marginTop: 4, opacity: 0.8 }}>
            Reach out anytime, we usually reply within a day.
          </Text>
        </View>

        <Section title="Contact us">
          <SettingsRow icon="mail-outline" title="Email support" subtitle="support@oncampus.app" onPress={() => {}} />
          <Divider />
          <SettingsRow icon="chatbubbles-outline" title="Live chat" subtitle="Mon–Fri, 9 AM – 6 PM IST" onPress={() => {}} />
          <Divider />
          <SettingsRow icon="logo-twitter" title="Twitter / X" subtitle="@oncampusapp" onPress={() => {}} />
        </Section>

        <Section title="Frequently asked">
          {FAQS.map((f, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: spacing.lg }} />}
              <View style={{ padding: spacing.lg }}>
                <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{f.q}</Text>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 4, lineHeight: 20 }}>{f.a}</Text>
              </View>
            </React.Fragment>
          ))}
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
  hero: { margin: spacing.lg, padding: spacing.xl, borderRadius: radius.md, alignItems: "flex-start" },
});
