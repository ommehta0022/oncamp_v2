import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import { campusApi } from "@/src/lib/campusApi";

function extractInviteCode(value: string): string {
  const text = value.trim();
  if (!text) return "";
  try {
    const parsed = new URL(text);
    const queryCode = parsed.searchParams.get("code");
    if (queryCode) return queryCode.trim();
    const segments = parsed.pathname.split("/").filter(Boolean);
    const inviteIndex = segments.findIndex((segment) => segment === "invites" || segment === "join");
    if (inviteIndex >= 0 && segments[inviteIndex + 1]) return decodeURIComponent(segments[inviteIndex + 1]);
  } catch {
    // Raw invite codes are valid too.
  }
  return text.replace(/^oncampus:\/\/join\/?/i, "").replace(/^\?code=/i, "").trim();
}

export default function JoinInvite() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [invite, setInvite] = useState<any>(null);
  const [resolvedCode, setResolvedCode] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);

  const paramCode = useMemo(() => {
    const raw = Array.isArray(params.code) ? params.code[0] : params.code;
    return extractInviteCode(raw || "");
  }, [params.code]);

  const loadInvite = useCallback(async (raw: string) => {
    const value = extractInviteCode(raw);
    if (!value) {
      setError("Enter or scan an OnCampus invite code.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const next = await campusApi.student.invite(value);
      setResolvedCode(value);
      setManualCode(value);
      setInvite(next);
      setScanning(false);
    } catch (err) {
      setScanLocked(false);
      setInvite(null);
      setError(err instanceof Error ? err.message : "Invite unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (paramCode) void loadInvite(paramCode);
  }, [paramCode, loadInvite]);

  const startScanner = async () => {
    setError("");
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Camera permission needed", "Allow camera access to scan an OnCampus invite QR code. You can still enter the invite code manually.");
        return;
      }
    }
    setScanLocked(false);
    setScanning(true);
  };

  const accept = async () => {
    if (accepting || !resolvedCode) return;
    setAccepting(true);
    setError("");
    try {
      const result = await campusApi.student.acceptInvite(resolvedCode);
      setInvite((current: any) => ({ ...current, accepted: true, result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept this invite.");
    } finally {
      setAccepting(false);
    }
  };

  const targetName = invite?.target?.title || invite?.target?.name || invite?.institution?.name || "Campus invite";
  const inviteType = String(invite?.inviteType || "institution");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <Pressable onPress={() => router.back()} style={styles.close}><Ionicons name="close" size={24} color={colors.onSurface} /></Pressable>

      {scanning ? (
        <View style={[styles.scanner, { borderColor: colors.border }]}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={scanLocked ? undefined : ({ data }) => {
              const value = extractInviteCode(data || "");
              if (!value) return;
              setScanLocked(true);
              void loadInvite(value);
            }}
          />
          <View pointerEvents="none" style={styles.scanOverlay}>
            <View style={styles.scanFrame} />
            <Text style={styles.scanText}>Place the OnCampus QR inside the frame</Text>
          </View>
          <Pressable onPress={() => setScanning(false)} style={styles.scannerClose}><Ionicons name="close" size={22} color="#fff" /></Pressable>
        </View>
      ) : (
        <View style={styles.body}>
          {loading ? <ActivityIndicator color={colors.brandPrimary} /> : invite?.accepted ? (
            <>
              <Ionicons name="checkmark-circle" size={58} color={colors.success} />
              <Text style={[styles.title, { color: colors.onSurface }]}>Invite accepted</Text>
              <Text style={[styles.text, { color: colors.onSurfaceTertiary }]}>{invite?.result?.status === "pending" ? "Your request has been submitted for institution approval." : "You have joined successfully."}</Text>
              <Pressable onPress={() => router.replace("/(tabs)/discover" as any)} style={[styles.button, { backgroundColor: colors.brandPrimary }]}><Text style={styles.buttonText}>Open Campus</Text></Pressable>
            </>
          ) : invite ? (
            <>
              <View style={[styles.icon, { backgroundColor: colors.brandPrimary + "16" }]}><Ionicons name={inviteType === "event" ? "calendar" : inviteType === "group" ? "people" : "school"} size={40} color={colors.brandPrimary} /></View>
              <Text style={[styles.title, { color: colors.onSurface }]}>{targetName}</Text>
              <Text style={[styles.text, { color: colors.onSurfaceTertiary }]}>{[inviteType.replace(/_/g, " "), invite?.institution?.name !== targetName ? invite?.institution?.name : null, invite?.institution?.city, invite?.institution?.state].filter(Boolean).join(" · ")}</Text>
              {invite?.target?.location ? <Text style={[styles.text, { color: colors.onSurfaceTertiary }]}>{invite.target.location}</Text> : null}
              {invite?.target?.start_at ? <Text style={[styles.text, { color: colors.onSurfaceTertiary }]}>{new Date(invite.target.start_at).toLocaleString()}</Text> : null}
              <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Ionicons name="shield-checkmark-outline" size={20} color={colors.brandPrimary} /><Text style={{ flex: 1, color: colors.onSurfaceTertiary, lineHeight: 19 }}>This invite is verified by the production backend before any campus, group or event membership is changed.</Text></View>
              {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
              <Pressable disabled={accepting} onPress={() => void accept()} style={[styles.button, { backgroundColor: colors.brandPrimary, opacity: accepting ? .6 : 1 }]}>{accepting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{invite?.autoApprove ? "Join now" : "Accept invite"}</Text>}</Pressable>
              <Pressable onPress={() => { setInvite(null); setResolvedCode(""); setError(""); }} style={styles.secondaryButton}><Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>Use another invite</Text></Pressable>
            </>
          ) : (
            <>
              <View style={[styles.icon, { backgroundColor: colors.brandPrimary + "16" }]}><Ionicons name="qr-code" size={40} color={colors.brandPrimary} /></View>
              <Text style={[styles.title, { color: colors.onSurface }]}>Join by QR or code</Text>
              <Text style={[styles.text, { color: colors.onSurfaceTertiary }]}>Scan a campus, group or event invite. You can also paste an invite link or code below.</Text>
              <Pressable onPress={() => void startScanner()} style={[styles.button, { backgroundColor: colors.brandPrimary }]}><Ionicons name="camera-outline" size={20} color="#fff" /><Text style={styles.buttonText}>Scan QR code</Text></Pressable>
              <View style={styles.dividerRow}><View style={[styles.line, { backgroundColor: colors.border }]} /><Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>or</Text><View style={[styles.line, { backgroundColor: colors.border }]} /></View>
              <View style={styles.codeRow}>
                <TextInput value={manualCode} onChangeText={setManualCode} autoCapitalize="none" autoCorrect={false} maxLength={4096} placeholder="Invite code or link" placeholderTextColor={colors.onSurfaceTertiary} style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onSubmitEditing={() => void loadInvite(manualCode)} />
                <Pressable disabled={!manualCode.trim()} onPress={() => void loadInvite(manualCode)} style={[styles.openButton, { backgroundColor: colors.brandPrimary, opacity: manualCode.trim() ? 1 : .5 }]}><Ionicons name="arrow-forward" size={20} color="#fff" /></Pressable>
              </View>
              {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center", margin: spacing.md },
  body: { flex: 1, paddingHorizontal: spacing.xl, alignItems: "center", justifyContent: "center" },
  scanner: { flex: 1, margin: spacing.lg, marginTop: 0, borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,.16)" },
  scanFrame: { width: 240, height: 240, borderWidth: 3, borderColor: "#fff", borderRadius: 20 },
  scanText: { color: "#fff", fontWeight: "800", marginTop: spacing.lg, textAlign: "center" },
  scannerClose: { position: "absolute", top: 14, right: 14, width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(0,0,0,.58)", alignItems: "center", justifyContent: "center" },
  icon: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800", marginTop: spacing.lg, textAlign: "center" },
  text: { textAlign: "center", marginTop: 7, lineHeight: 20 },
  card: { width: "100%", marginTop: spacing.xl, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: "row", gap: spacing.md },
  button: { width: "100%", minHeight: 50, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", marginTop: spacing.xl, flexDirection: "row", gap: spacing.sm },
  buttonText: { color: "#fff", fontWeight: "800" },
  secondaryButton: { paddingVertical: 14 },
  dividerRow: { width: "100%", flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: spacing.lg },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  codeRow: { width: "100%", flexDirection: "row", gap: spacing.sm },
  input: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md },
  openButton: { width: 48, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  error: { textAlign: "center", marginTop: spacing.md, fontSize: font.sm },
});
