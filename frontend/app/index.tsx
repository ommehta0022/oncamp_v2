import { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, spacing } from "@/src/theme/colors";

export default function Splash() {
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    const t = setTimeout(async () => {
      const authed = await AsyncStorage.getItem("oncampus.authed");
      if (authed === "true") router.replace("/(tabs)/feed");
      else router.replace("/(auth)/welcome");
    }, 1200);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.brandPrimary }]} testID="splash-screen">
      <View style={[styles.logoWrap, { backgroundColor: "#ffffff22" }]}>
        <Ionicons name="school" size={44} color="#fff" />
      </View>
      <Text style={styles.brand}>OnCampus</Text>
      <Text style={styles.tagline}>Your campus, connected.</Text>
      <ActivityIndicator color="#ffffffaa" style={{ marginTop: spacing["2xl"] }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  logoWrap: {
    width: 88, height: 88, borderRadius: 24,
    alignItems: "center", justifyContent: "center",
  },
  brand: { color: "#fff", fontSize: 32, fontWeight: "500", marginTop: spacing.lg, letterSpacing: -0.5 },
  tagline: { color: "#ffffffcc", fontSize: font.base, marginTop: spacing.xs },
});
