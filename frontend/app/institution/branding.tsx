import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
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

type BrandingForm = { logoUrl: string; coverUrl: string; palette: string };

export default function Branding() {
  const { colors } = useTheme();
  const router = useRouter();
  const [institution, setInstitution] = useState<InstitutionRecord | null>(null);
  const [counts, setCounts] = useState<any>({});
  const [form, setForm] = useState<BrandingForm>({ logoUrl: "", coverUrl: "", palette: "Moss" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = (await api.institutions.dashboard()) as InstitutionDashboardData;
      const next = data.institution || null;
      const pendingBranding = await readPendingBranding();
      const storedPalette = next ? String(getPolicy(next).brandPalette || "") : "";

      setInstitution(next);
      setCounts(data.counts || {});
      setForm({
        logoUrl: getLogoUrl(next) || pendingBranding.logoUrl || data.verificationRequests?.[0]?.logo_url || "",
        coverUrl: getCoverUrl(next) || pendingBranding.coverUrl || "",
        palette: storedPalette || pendingBranding.palette || "Moss",
      });
      setLogoFailed(false);
      setCoverFailed(false);
    } catch (error) {
      Alert.alert("Branding unavailable", getUserErrorMessage(error, "Could not load institution branding."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

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
    const mimeType = asset.mimeType || "image/jpeg";
    const extension = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    const formData = await formDataFromAsset(asset as any, `${kind}.${extension}`, mimeType);

    setUploading(kind);
    try {
      const response = kind === "logo"
        ? await api.uploadInstitutionLogo(formData)
        : await api.uploadInstitutionCover(formData);
      const key = kind === "logo" ? "logoUrl" : "coverUrl";
      setForm((current) => ({ ...current, [key]: response.url }));
      if (kind === "logo") setLogoFailed(false);
      if (kind === "cover") setCoverFailed(false);
    } catch (error) {
      Alert.alert("Upload failed", getUserErrorMessage(error, "Could not upload this image."));
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (saving || uploading) return;
    setSaving(true);
    try {
      const payload = {
        logoUrl: form.logoUrl || undefined,
        coverUrl: form.coverUrl || undefined,
        verificationPolicy: { ...policy, brandPalette: form.palette },
      };

      if (!institution?.id) {
        await AsyncStorage.setItem(PENDING_BRANDING_KEY, JSON.stringify(form));
        try {
          await api.institutions.updateMe(payload);
          await AsyncStorage.removeItem(PENDING_BRANDING_KEY);
        } catch (error) {
          Alert.alert(
            "Saved on this device",
            getUserErrorMessage(error, "Branding will stay available locally while institution approval is pending."),
          );
        }
        router.back();
        return;
      }

      await api.institutions.updateMe(payload);
      await AsyncStorage.removeItem(PENDING_BRANDING_KEY);
      Alert.alert("Branding updated", "Logo, cover and brand colors are now applied to the institution dashboard.", [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert("Save failed", getUserErrorMessage(error, "Could not save institution branding."));
    } finally {
      setSaving(false);
    }
  };

  const renderLogo = (size: "large" | "small" = "large") => {
    const style = size === "large" ? styles.logo : styles.logoSmall;
    if (form.logoUrl && !logoFailed) {
      return (
        <View style={[style, { backgroundColor: selectedPalette.primary }]}>
          <Image
            source={{ uri: form.logoUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={120}
            onError={() => setLogoFailed(true)}
          />
        </View>
      );
    }
    return (
      <View style={[style, { backgroundColor: selectedPalette.primary }]}>
        <Ionicons name="school" size={size === "large" ? 32 : 18} color="#fff" />
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="branding-screen">
      <Header
        title="Branding"
        subtitle="Logo, cover & colors"
        onBack={() => router.back()}
        right={
          <Pressable onPress={save} disabled={saving || !!uploading || loading}>
            <Text style={{ color: selectedPalette.primary, fontSize: font.base, fontWeight: "600" }}>
              {saving ? "Saving…" : "Save"}
            </Text>
          </Pressable>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        <Text style={[styles.sectionTitle, { color: colors.onSurfaceTertiary }]}>COVER IMAGE</Text>
        <View style={[styles.coverWrap, { backgroundColor: selectedPalette.primary }]}>
          {form.coverUrl && !coverFailed ? (
            <Image
              source={{ uri: form.coverUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={160}
              onError={() => setCoverFailed(true)}
            />
          ) : (
            <LinearGradient colors={[selectedPalette.primary, selectedPalette.secondary]} style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient colors={["rgba(0,0,0,0.04)", "rgba(0,0,0,0.56)"]} style={StyleSheet.absoluteFill} />
          <Pressable style={styles.editBtn} onPress={() => pickImage("cover")} disabled={!!uploading}>
            <Ionicons name="camera" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontSize: font.sm, fontWeight: "600" }}>
              {uploading === "cover" ? "Uploading…" : "Change cover"}
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurfaceTertiary }]}>LOGO</Text>
        <View style={styles.logoRow}>
          {renderLogo("large")}
          <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
            <Text numberOfLines={2} style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "600" }}>
              {getInstitutionName(institution)} logo
            </Text>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>Square image · Recommended 512×512</Text>
            <Pressable style={[styles.uploadBtn, { borderColor: colors.borderStrong }]} onPress={() => pickImage("logo")} disabled={!!uploading}>
              <Ionicons name="cloud-upload-outline" size={14} color={colors.onSurface} />
              <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "600" }}>
                {uploading === "logo" ? "Uploading…" : "Upload new"}
              </Text>
            </Pressable>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurfaceTertiary }]}>BRAND PALETTE</Text>
        <View style={styles.palettes}>
          {BRAND_PALETTES.map((p) => {
            const selected = p.name === form.palette;
            return (
              <Pressable
                key={p.name}
                onPress={() => setForm((current) => ({ ...current, palette: p.name }))}
                style={[
                  styles.palette,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: selected ? p.primary : colors.border,
                    borderWidth: selected ? 2 : 1,
                  },
                ]}
              >
                <View style={{ flexDirection: "row", gap: 4 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: p.primary }} />
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: p.secondary }} />
                </View>
                <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "600", marginTop: spacing.sm }}>{p.name}</Text>
                {selected && <Ionicons name="checkmark-circle" size={17} color={p.primary} style={{ position: "absolute", top: 8, right: 8 }} />}
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurfaceTertiary }]}>LIVE PREVIEW</Text>
        <View style={[styles.preview, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <View style={{ height: 92, backgroundColor: selectedPalette.primary }}>
            {form.coverUrl && !coverFailed ? (
              <Image source={{ uri: form.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <LinearGradient colors={[selectedPalette.primary, selectedPalette.secondary]} style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient colors={["transparent", "rgba(0,0,0,0.52)"]} style={StyleSheet.absoluteFill} />
          </View>
          <View style={styles.previewIdentity}>
            {renderLogo("small")}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "600" }} numberOfLines={1}>
                {getInstitutionName(institution)}
              </Text>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }} numberOfLines={1}>
                {formatNumber(counts.members)} members
              </Text>
            </View>
            <View style={[styles.btnPreview, { backgroundColor: selectedPalette.primary }]}>
              <Text style={{ color: "#fff", fontSize: font.sm, fontWeight: "600" }}>Follow</Text>
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
  sectionTitle: {
    fontSize: font.sm,
    fontWeight: "600",
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  coverWrap: {
    height: 150,
    marginHorizontal: spacing.lg,
    borderRadius: 18,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-end",
    backgroundColor: "#00000070",
    paddingHorizontal: spacing.md,
    height: 34,
    borderRadius: radius.pill,
    margin: spacing.md,
  },
  logoRow: { flexDirection: "row", gap: spacing.md, alignItems: "center", marginHorizontal: spacing.lg, paddingVertical: spacing.sm },
  logo: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    height: 30,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: 4,
  },
  palettes: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, paddingHorizontal: spacing.lg },
  palette: { flexGrow: 1, flexBasis: "29%", minWidth: 92, padding: spacing.md, borderRadius: radius.md, alignItems: "flex-start" },
  preview: { marginHorizontal: spacing.lg, borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  previewIdentity: { padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md },
  logoSmall: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 },
  btnPreview: { paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", flexShrink: 0 },
});
