import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";

export default function Invite() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Invite friends" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg }}>
        <View style={[styles.hero, { backgroundColor: colors.brandPrimary }]}>
          <Ionicons name="gift" size={40} color={colors.onBrandPrimary} />
          <Text style={{ color: colors.onBrandPrimary, fontSize: 22, fontWeight: "500", marginTop: spacing.md, letterSpacing: -0.5 }}>Bring your campus along</Text>
          <Text style={{ color: colors.onBrandPrimary, opacity: 0.85, fontSize: font.base, marginTop: 6, lineHeight: 20 }}>
            OnCampus is better with your classmates on it. Share your invite link and unlock the Ambassador badge.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "500" }}>YOUR INVITE LINK</Text>
          <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500", marginTop: 4 }}>oncampus.app/join/aarav-iitb</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
            <Pressable style={[styles.actionBtn, { backgroundColor: colors.brandTertiary }]}>
              <Ionicons name="copy-outline" size={16} color={colors.onBrandTertiary} />
              <Text style={{ color: colors.onBrandTertiary, fontSize: font.sm, fontWeight: "500" }}>Copy</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, { backgroundColor: colors.brandTertiary }]}>
              <Ionicons name="qr-code-outline" size={16} color={colors.onBrandTertiary} />
              <Text style={{ color: colors.onBrandTertiary, fontSize: font.sm, fontWeight: "500" }}>QR</Text>
            </Pressable>
          </View>
        </View>

        <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: spacing.xl, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 }}>Share via</Text>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md }}>
          {[
            { i: "logo-whatsapp", c: "#25D366", label: "WhatsApp" },
            { i: "mail", c: colors.info, label: "Email" },
            { i: "chatbox-ellipses", c: colors.brandSecondary, label: "SMS" },
            { i: "share-social", c: colors.brandPrimary, label: "More" },
          ].map((s, i) => (
            <Pressable key={i} style={{ alignItems: "center", gap: 6 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: s.c, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={s.i as any} size={26} color="#fff" />
              </View>
              <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ marginTop: spacing["2xl"], paddingVertical: spacing.lg, alignItems: "center" }}>
          <Text style={{ color: colors.onSurface, fontSize: 32, fontWeight: "500" }}>24</Text>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base, marginTop: 2 }}>friends have joined via you</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { padding: spacing.xl, borderRadius: radius.md, alignItems: "flex-start" },
  card: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, marginTop: spacing.lg },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill },
});
