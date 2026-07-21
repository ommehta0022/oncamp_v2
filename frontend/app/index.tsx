import { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, spacing } from "@/src/theme/colors";

export default function Splash() {
  const router = useRouter();
  const { colors } = useTheme();
  const { height } = Dimensions.get("window");

  useEffect(() => {
    const t = setTimeout(async () => {
      const authed = await AsyncStorage.getItem("oncampus.authed");
      if (authed === "true") router.replace("/(tabs)/feed");
      else router.replace("/(auth)/welcome");
    }, 1200);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.brandPrimary, height }]} testID="splash-screen">
      <LinearGradient
        colors={[colors.brandPrimary, "#1B382F"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.center}>
        <View style={[styles.logoWrap, { backgroundColor: "#ffffff22", borderColor: "#ffffff33" }]}>
          <Ionicons name="school" size={44} color="#fff" />
        </View>
        <Text style={styles.brand}>OnCampus</Text>
        <Text style={styles.tagline}>Your campus, connected.</Text>
        <ActivityIndicator color="#ffffffaa" style={{ marginTop: spacing["2xl"] }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  logoWrap: {
    width: 88, height: 88, borderRadius: 24,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
  },
  brand: { color: "#fff", fontSize: 32, fontWeight: "500", marginTop: spacing.lg, letterSpacing: 0 },
  tagline: { color: "#ffffffcc", fontSize: font.base, marginTop: spacing.xs },
});
