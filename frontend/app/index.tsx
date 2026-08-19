import { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
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
    <View style={styles.root} testID="splash-screen">
      <StatusBar hidden animated={false} />
      <LinearGradient
        colors={[colors.brandPrimary, colors.gradientEnd || "#1B382F"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.center}>
        <View style={[styles.logoWrap, { backgroundColor: "#ffffff22", borderColor: "#ffffff33" }]}>
          <Ionicons name="school" size={44} color="#fff" />
        </View>
        <Text style={styles.brand}>OnCampus</Text>
        <Text style={styles.tagline}>Your campus, connected.</Text>
        <ActivityIndicator color="#ffffffaa" style={styles.loader} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: "100%",
    alignSelf: "stretch",
    overflow: "hidden",
    backgroundColor: "#2E5C4E",
  },
  center: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  brand: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "500",
    marginTop: spacing.lg,
    letterSpacing: 0,
    textAlign: "center",
  },
  tagline: {
    color: "#ffffffcc",
    fontSize: font.base,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  loader: { marginTop: spacing["2xl"] },
});
