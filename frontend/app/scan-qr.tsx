import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";

function extractInviteCode(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  try {
    const normalized = value.startsWith("oncampus://") ? value.replace("oncampus://", "https://oncampus.local/") : value;
    const url = new URL(normalized);
    const code = url.searchParams.get("code");
    if (code) return code.trim();
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] === "join" && segments[1]) return segments[1].trim();
  } catch { /* raw invite code */ }
  if (/^[A-Za-z0-9_-]{8,80}$/.test(value)) return value;
  return "";
}

export default function ScanCampusQr() {
  const { colors } = useTheme();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");

  const openInvite = useCallback((raw: string) => {
    const code = extractInviteCode(raw);
    if (!code) {
      setError("This QR code is not a valid OnCampus invite.");
      setScanned(false);
      return;
    }
    setError("");
    router.push({ pathname: "/join" as any, params: { code } });
  }, [router]);

  const onBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);
    openInvite(result.data || "");
  };

  if (!permission) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}><Header title="Scan campus QR" onBack={() => router.back()} /><View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <Header title="Scan campus QR" onBack={() => router.back()} />
      <View style={{ flex: 1 }}>
        {permission.granted ? (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
            />
            <View pointerEvents="none" style={styles.cameraOverlay}>
              <View style={styles.frame} />
              <Text style={styles.cameraText}>Point the camera at an OnCampus campus, group or event QR code.</Text>
            </View>
            {scanned && <Pressable onPress={() => { setScanned(false); setError(""); }} style={styles.scanAgain}><Ionicons name="scan" size={18} color="#fff" /><Text style={styles.scanAgainText}>Scan again</Text></Pressable>}
          </View>
        ) : (
          <View style={styles.permission}>
            <View style={[styles.permissionIcon, { backgroundColor: colors.brandPrimary + "14" }]}><Ionicons name="camera-outline" size={32} color={colors.brandPrimary} /></View>
            <Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: "800", textAlign: "center" }}>Camera access</Text>
            <Text style={{ color: colors.onSurfaceTertiary, textAlign: "center", lineHeight: 20, marginTop: 7 }}>OnCampus only uses the camera while this scanner is open.</Text>
            <Pressable onPress={() => void requestPermission()} style={[styles.primary, { backgroundColor: colors.brandPrimary }]}><Text style={styles.primaryText}>Allow camera</Text></Pressable>
          </View>
        )}

        <View style={[styles.manualCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={{ color: colors.onSurface, fontWeight: "800" }}>Or enter invite code</Text>
          <View style={[styles.inputRow, { backgroundColor: colors.surfaceSecondary, borderColor: error ? colors.error : colors.border }]}>
            <TextInput value={manual} onChangeText={(value) => { setManual(value); setError(""); }} autoCapitalize="none" autoCorrect={false} placeholder="Campus invite code" placeholderTextColor={colors.muted} style={{ flex: 1, color: colors.onSurface, minHeight: 44 }} />
            <Pressable disabled={!manual.trim()} onPress={() => openInvite(manual)} style={[styles.go, { backgroundColor: colors.brandPrimary, opacity: manual.trim() ? 1 : .45 }]}><Ionicons name="arrow-forward" size={19} color="#fff" /></Pressable>
          </View>
          {!!error && <Text style={{ color: colors.error, fontSize: 12, marginTop: 7 }}>{error}</Text>}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  cameraWrap: { flex: 1, overflow: "hidden" },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,.18)" },
  frame: { width: 245, height: 245, borderRadius: 26, borderWidth: 3, borderColor: "#fff", backgroundColor: "transparent" },
  cameraText: { color: "#fff", fontSize: 13, fontWeight: "700", textAlign: "center", lineHeight: 19, marginTop: 18, paddingHorizontal: 40, textShadowColor: "#000", textShadowRadius: 6 },
  scanAgain: { position: "absolute", bottom: 132, alignSelf: "center", backgroundColor: "rgba(0,0,0,.72)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 7 },
  scanAgainText: { color: "#fff", fontWeight: "700" },
  permission: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  permissionIcon: { width: 68, height: 68, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  primary: { minWidth: 180, minHeight: 48, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", marginTop: spacing.xl }, primaryText: { color: "#fff", fontWeight: "800" },
  manualCard: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.md, paddingLeft: 12, marginTop: 9 },
  go: { width: 42, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 4 },
});
