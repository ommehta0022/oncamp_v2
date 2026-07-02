import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";

const PALETTES = [
  { name: "Moss", primary: "#2E5C4E", secondary: "#E87A5D" },
  { name: "Ocean", primary: "#1F4B6E", secondary: "#F4A261" },
  { name: "Sunset", primary: "#C0392B", secondary: "#F1C40F" },
  { name: "Forest", primary: "#264653", secondary: "#2A9D8F" },
  { name: "Berry", primary: "#6A2C70", secondary: "#F08A5D" },
  { name: "Slate", primary: "#3D3D3D", secondary: "#E63946" },
];

export default function Branding() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="branding-screen">
      <Header
        title="Branding"
        subtitle="Logo, cover & colors"
        onBack={() => router.back()}
        right={
          <Pressable>
            <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "500" }}>Save</Text>
          </Pressable>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <Text style={[styles.section, { color: colors.onSurfaceTertiary }]}>COVER IMAGE</Text>
        <View style={styles.coverWrap}>
          <Image
            source={{ uri: "https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?w=1200&q=80" }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <LinearGradient colors={["rgba(0,0,0,0.2)", "rgba(0,0,0,0.6)"]} style={StyleSheet.absoluteFill} />
          <Pressable style={styles.editBtn}>
            <Ionicons name="camera" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontSize: font.sm, fontWeight: "500" }}>Change cover</Text>
          </Pressable>
        </View>

        <Text style={[styles.section, { color: colors.onSurfaceTertiary }]}>LOGO</Text>
        <View style={styles.logoRow}>
          <View style={[styles.logo, { backgroundColor: colors.brandPrimary }]}>
            <Ionicons name="school" size={32} color="#fff" />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>IIT Bombay logo</Text>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>PNG or SVG · Minimum 512x512</Text>
            <Pressable style={[styles.uploadBtn, { borderColor: colors.borderStrong }]}>
              <Ionicons name="cloud-upload-outline" size={14} color={colors.onSurface} />
              <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>Upload new</Text>
            </Pressable>
          </View>
        </View>

        <Text style={[styles.section, { color: colors.onSurfaceTertiary }]}>BRAND PALETTE</Text>
        <View style={styles.palettes}>
          {PALETTES.map((p, i) => (
            <Pressable
              key={p.name}
              style={[styles.palette, { backgroundColor: colors.surfaceSecondary, borderColor: i === 0 ? colors.brandPrimary : colors.border, borderWidth: i === 0 ? 2 : 1 }]}
            >
              <View style={{ flexDirection: "row", gap: 4 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: p.primary }} />
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: p.secondary }} />
              </View>
              <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500", marginTop: spacing.sm }}>{p.name}</Text>
              {i === 0 && <Ionicons name="checkmark-circle" size={16} color={colors.brandPrimary} style={{ position: "absolute", top: 8, right: 8 }} />}
            </Pressable>
          ))}
        </View>

        <Text style={[styles.section, { color: colors.onSurfaceTertiary }]}>PREVIEW</Text>
        <View style={[styles.preview, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <View style={{ height: 80 }}>
            <Image
              source={{ uri: "https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?w=800&q=80" }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={StyleSheet.absoluteFill} />
          </View>
          <View style={{ padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={[styles.logoSmall, { backgroundColor: colors.brandPrimary }]}>
              <Ionicons name="school" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>IIT Bombay</Text>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>Verified · 8,420 members</Text>
            </View>
            <View style={[styles.btnPreview, { backgroundColor: colors.brandPrimary }]}>
              <Text style={{ color: colors.onBrandPrimary, fontSize: font.sm, fontWeight: "500" }}>Follow</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: font.sm, fontWeight: "500", letterSpacing: 0.5, paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.sm },
  coverWrap: { height: 140, marginHorizontal: spacing.lg, borderRadius: radius.md, overflow: "hidden", justifyContent: "flex-end" },
  editBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end",
    backgroundColor: "#00000066", paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill,
    margin: spacing.md,
  },
  logoRow: {
    flexDirection: "row", gap: spacing.md, alignItems: "center",
    marginHorizontal: spacing.lg, padding: spacing.md,
  },
  logo: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  uploadBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: spacing.md, height: 30, borderRadius: radius.pill, borderWidth: 1, marginTop: 4 },
  palettes: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, paddingHorizontal: spacing.lg },
  palette: { width: "30%", padding: spacing.md, borderRadius: radius.md, alignItems: "flex-start" },
  preview: { marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  logoSmall: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnPreview: { paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
