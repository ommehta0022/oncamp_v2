import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CampusLoader from "@/src/components/CampusLoader";
import { spacing } from "@/src/theme/colors";

export default function Splash() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      try {
        const authed = await AsyncStorage.getItem("oncampus.authed");
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (!mounted) return;
        router.replace(authed === "true" ? "/(tabs)/feed" : "/(auth)/welcome");
      } catch {
        if (mounted) router.replace("/(auth)/welcome");
      }
    };
    void boot();
    return () => { mounted = false; };
  }, [router]);

  return (
    <View style={styles.root} testID="splash-screen">
      <StatusBar hidden animated={false} />
      <LinearGradient colors={["#1267F4", "#0B49BD"]} start={{ x: 0.15, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.glowOne} />
      <View style={styles.glowTwo} />
      <View style={styles.center}>
        <View style={styles.logoWrap}><Ionicons name="school" size={42} color="#1267F4" /></View>
        <Text style={styles.brand}>OnCampus</Text>
        <Text style={styles.tagline}>Your campus, connected.</Text>
        <CampusLoader compact inverse label="Getting campus ready…" style={styles.loader} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: "100%", overflow: "hidden", backgroundColor: "#1267F4" },
  glowOne: { position: "absolute", width: 280, height: 280, borderRadius: 140, backgroundColor: "rgba(255,255,255,0.08)", top: -70, right: -90 },
  glowTwo: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(255,255,255,0.05)", bottom: -50, left: -80 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  logoWrap: { width: 88, height: 88, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", shadowColor: "#041C56", shadowOpacity: 0.18, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 7 },
  brand: { color: "#FFFFFF", fontSize: 34, fontWeight: "800", marginTop: 18, letterSpacing: -0.7 },
  tagline: { color: "rgba(255,255,255,0.82)", fontSize: 14, marginTop: 5 },
  loader: { marginTop: 12, paddingVertical: 18 },
});
