import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/colors";
import { campusApi } from "@/src/lib/campusApi";

export default function JoinInvite() {
  const { colors } = useTheme();
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const value = String(code || "").trim();
    if (!value) { setError("This invite is missing its code."); setLoading(false); return; }
    campusApi.student.invite(value).then(setInvite).catch((err) => setError(err instanceof Error ? err.message : "Invite unavailable")).finally(() => setLoading(false));
  }, [code]);

  const accept = async () => {
    if (accepting || !code) return;
    setAccepting(true);
    try {
      const result = await campusApi.student.acceptInvite(String(code));
      setInvite((current: any) => ({ ...current, accepted: true, result }));
    } catch (err) { setError(err instanceof Error ? err.message : "Could not accept this invite."); }
    finally { setAccepting(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <Pressable onPress={() => router.back()} style={styles.close}><Ionicons name="close" size={24} color={colors.onSurface} /></Pressable>
      <View style={styles.body}>
        {loading ? <ActivityIndicator color={colors.brandPrimary} /> : error ? <><Ionicons name="warning-outline" size={48} color={colors.error} /><Text style={[styles.title, { color: colors.onSurface }]}>Invite unavailable</Text><Text style={[styles.text, { color: colors.onSurfaceTertiary }]}>{error}</Text></> : invite?.accepted ? <><Ionicons name="checkmark-circle" size={58} color={colors.success} /><Text style={[styles.title, { color: colors.onSurface }]}>Invite accepted</Text><Text style={[styles.text, { color: colors.onSurfaceTertiary }]}>Your campus membership request has been updated.</Text><Pressable onPress={() => router.replace("/(tabs)/discover" as any)} style={[styles.button, { backgroundColor: colors.brandPrimary }]}><Text style={styles.buttonText}>Open Campus</Text></Pressable></> : <><View style={[styles.icon, { backgroundColor: colors.brandPrimary + "16" }]}><Ionicons name="school" size={40} color={colors.brandPrimary} /></View><Text style={[styles.title, { color: colors.onSurface }]}>{invite?.institution?.name || "Campus invite"}</Text><Text style={[styles.text, { color: colors.onSurfaceTertiary }]}>{[invite?.inviteType, invite?.institution?.city, invite?.institution?.state].filter(Boolean).join(" · ")}</Text><View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Ionicons name="shield-checkmark-outline" size={20} color={colors.brandPrimary} /><Text style={{ flex: 1, color: colors.onSurfaceTertiary, lineHeight: 19 }}>This invite is validated by OnCampus before your membership or join request is created.</Text></View><Pressable disabled={accepting} onPress={() => void accept()} style={[styles.button, { backgroundColor: colors.brandPrimary, opacity: accepting ? .6 : 1 }]}>{accepting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Accept invite</Text>}</Pressable></>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center", margin: spacing.md },
  body: { flex: 1, paddingHorizontal: spacing.xl, alignItems: "center", justifyContent: "center" },
  icon: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800", marginTop: spacing.lg, textAlign: "center" },
  text: { textAlign: "center", marginTop: 7, lineHeight: 20 },
  card: { width: "100%", marginTop: spacing.xl, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: "row", gap: spacing.md },
  button: { width: "100%", minHeight: 50, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  buttonText: { color: "#fff", fontWeight: "800" },
});
