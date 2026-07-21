import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import { api, getUserErrorMessage } from "@/src/lib/api";
import { formDataFromAsset } from "@/src/lib/uploadFormData";
import {
  BRAND_PALETTES,
  formatNumber,
  getCoverUrl,
  getInstitutionName,
  getLogoUrl,
  getPalette,
  getPolicy,
  type InstitutionDashboardData,
  type InstitutionRecord,
} from "@/src/lib/institution";

const PENDING_BRANDING_KEY = "oncampus.pending_institution_branding";

export default function Branding() {
  const { colors } = useTheme();
  const router = useRouter();
  const [institution, setInstitution] = useState<InstitutionRecord | null>(null);
  const [counts, setCounts] = useState<any>({});
  const [form, setForm] = useState({ logoUrl: "", coverUrl: "", palette: "Moss" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);

  const load = useCallback(async () => {
    try {
      const data = (await api.institutions.dashboard()) as InstitutionDashboardData;
      const next = data.institution || null;
      const pendingBranding = await readPendingBranding();
      setInstitution(next);
      setCounts(data.counts || {});
      setForm({
        logoUrl: getLogoUrl(next) || pendingBranding.logoUrl || data.verificationRequests?.[0]?.logo_url || "",
        coverUrl: getCoverUrl(next) || pendingBranding.coverUrl || "",
        palette: pendingBranding.palette || getPolicy(next).brandPalette || "Moss",
      });
    } catch {
      setInstitution(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedPalette = getPalette(institution, form.palette);
  const policy = getPolicy(institution);

  const pickImage = async (kind: "logo" | "cover") => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo library access to upload institution images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: kind === "logo",
      aspect: kind === "logo" ? [1, 1] : [16, 9],
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const formData = await formDataFromAsset(
      asset as any,
      `${kind}.${asset.mimeType?.split("/")[1] || "jpg"}`,
      "image/jpeg",
    );

    setUploading(kind);
    try {
      const response = kind === "logo"
        ? await api.uploadInstitutionLogo(formData)
        : await api.uploadInstitutionCover(formData);
      setForm((current) => ({ ...current, [kind === "logo" ? "logoUrl" : "coverUrl"]: response.url }));
    } catch (error) {
      Alert.alert("Upload failed", getUserErrorMessage(error, "Could not upload this image."));
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await AsyncStorage.setItem(PENDING_BRANDING_KEY, JSON.stringify(form));
      if (!institution?.id) {
        try {
          await api.institutions.updateMe({
            logoUrl: form.logoUrl || undefined,
            coverUrl: form.coverUrl || undefined,
            verificationPolicy: { ...policy, brandPalette: form.palette },
          });
        } catch (error) {
          Alert.alert("Saved on this device", getUserErrorMessage(error, "Your branding is saved locally and will be available while institution approval is pending."));
        }
        router.back();
        return;
      }
      await api.institutions.updateMe({
        logoUrl: form.logoUrl || undefined,
        coverUrl: form.coverUrl || undefined,
        verificationPolicy: { ...policy, brandPalette: form.palette },
      });
      router.back();
    } catch (error) {
      Alert.alert("Save failed", getUserErrorMessage(error, "Could not save institution branding."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="branding-screen">
      <Header
        title="Branding"
        subtitle="Logo, cover & colors"
        onBack={() => router.back()}
        right={
          <Pressable onPress={save} disabled={saving || !!uploading}>
            <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "500" }}>{saving ? "Saving" : "Save"}</Text>
          </Pressable>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <Text style={[styles.section, { color: colors.onSurfaceTertiary }]}>COVER IMAGE</Text>
        <View style={[styles.coverWrap, { backgroundColor: selectedPalette.primary }]}>
          {form.coverUrl ? <Image source={{ uri: form.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          <LinearGradient colors={["rgba(0,0,0,0.08)", "rgba(0,0,0,0.58)"]} style={StyleSheet.absoluteFill} />
          {!form.coverUrl && (
            <View style={styles.emptyCover}>
              <Ionicons name="business" size={42} color="#ffffffcc" />
            </View>
          )}
          <Pressable style={styles.editBtn} onPress={() => pickImage("cover")} disabled={!!uploading}>
            <Ionicons name="camera" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontSize: font.sm, fontWeight: "500" }}>{uploading === "cover" ? "Uploading" : "Change cover"}</Text>
          </Pressable>
        </View>

        <Text style={[styles.section, { color: colors.onSurfaceTertiary }]}>LOGO</Text>
        <View style={styles.logoRow}>
          <View style={[styles.logo, { backgroundColor: selectedPalette.primary }]}>
            {form.logoUrl ? <Image source={{ uri: form.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="school" size={32} color="#fff" />}
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{getInstitutionName(institution)} logo</Text>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>PNG or SVG - Minimum 512x512</Text>
            <Pressable style={[styles.uploadBtn, { borderColor: colors.borderStrong }]} onPress={() => pickImage("logo")} disabled={!!uploading}>
              <Ionicons name="cloud-upload-outline" size={14} color={colors.onSurface} />
              <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>{uploading === "logo" ? "Uploading" : "Upload new"}</Text>
            </Pressable>
          </View>
        </View>

        <Text style={[styles.section, { color: colors.onSurfaceTertiary }]}>BRAND PALETTE</Text>
        <View style={styles.palettes}>
          {BRAND_PALETTES.map((p) => {
            const selected = p.name === form.palette;
            return (
              <Pressable
                key={p.name}
                onPress={() => setForm((current) => ({ ...current, palette: p.name }))}
                style={[styles.palette, { backgroundColor: colors.surfaceSecondary, borderColor: selected ? colors.brandPrimary : colors.border, borderWidth: selected ? 2 : 1 }]}
              >
                <View style={{ flexDirection: "row", gap: 4 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: p.primary }} />
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: p.secondary }} />
                </View>
                <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500", marginTop: spacing.sm }}>{p.name}</Text>
                {selected && <Ionicons name="checkmark-circle" size={16} color={colors.brandPrimary} style={{ position: "absolute", top: 8, right: 8 }} />}
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.section, { color: colors.onSurfaceTertiary }]}>PREVIEW</Text>
        <View style={[styles.preview, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <View style={{ height: 80, backgroundColor: selectedPalette.primary }}>
            {form.coverUrl ? <Image source={{ uri: form.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={StyleSheet.absoluteFill} />
          </View>
          <View style={{ padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={[styles.logoSmall, { backgroundColor: selectedPalette.primary }]}>
              {form.logoUrl ? <Image source={{ uri: form.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="school" size={18} color="#fff" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }} numberOfLines={1}>{getInstitutionName(institution)}</Text>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>Verified - {formatNumber(counts.members)} members</Text>
            </View>
            <View style={[styles.btnPreview, { backgroundColor: selectedPalette.primary }]}>
              <Text style={{ color: "#fff", fontSize: font.sm, fontWeight: "500" }}>Follow</Text>
            </View>
          </View>
          {/* Mock Post Preview */}
          <View style={{ padding: spacing.md, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md }}>
              <View style={[styles.logoSmall, { width: 32, height: 32, backgroundColor: selectedPalette.primary }]}>
                {form.logoUrl ? <Image source={{ uri: form.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="school" size={14} color="#fff" />}
              </View>
              <View>
                <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>{getInstitutionName(institution)}</Text>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: 10 }}>2 hours ago</Text>
              </View>
            </View>
            <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500", marginBottom: 4 }}>Welcome to our new official page!</Text>
            <Text style={{ color: colors.onSurfaceSecondary, fontSize: font.sm, lineHeight: 20 }}>We are excited to share updates, events, and news with our community. Stay tuned for more announcements.</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="heart-outline" size={18} color={colors.onSurfaceTertiary} />
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>124</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="chatbubble-outline" size={18} color={colors.onSurfaceTertiary} />
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>12</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

async function readPendingBranding(): Promise<{ logoUrl?: string; coverUrl?: string; palette?: string }> {
  try {
    const value = await AsyncStorage.getItem(PENDING_BRANDING_KEY);
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

const styles = StyleSheet.create({
  section: { fontSize: font.sm, fontWeight: "500", letterSpacing: 0.5, paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.sm },
  coverWrap: { height: 140, marginHorizontal: spacing.lg, borderRadius: radius.md, overflow: "hidden", justifyContent: "flex-end" },
  emptyCover: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end", backgroundColor: "#00000066", paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill, margin: spacing.md },
  logoRow: { flexDirection: "row", gap: spacing.md, alignItems: "center", marginHorizontal: spacing.lg, padding: spacing.md },
  logo: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  uploadBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: spacing.md, height: 30, borderRadius: radius.pill, borderWidth: 1, marginTop: 4 },
  palettes: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, paddingHorizontal: spacing.lg },
  palette: { width: "30%", padding: spacing.md, borderRadius: radius.md, alignItems: "flex-start" },
  preview: { marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  logoSmall: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  btnPreview: { paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
