import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/src/theme/ThemeProvider";

const APP_ICON = require("../assets/images/icon.png");

export default function Startup() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      let target: "/(tabs)/feed" | "/(auth)/welcome" = "/(auth)/welcome";
      try {
        const authed = await AsyncStorage.getItem("oncampus.authed");
        target = authed === "true" ? "/(tabs)/feed" : "/(auth)/welcome";
      } catch {
        target = "/(auth)/welcome";
      }
      if (mounted) router.replace(target);
    };
    void boot();
    return () => { mounted = false; };
  }, [router]);

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]} testID="startup-screen">
      <StatusBar style={isDark ? "light" : "dark"} translucent backgroundColor="transparent" />
      <View style={[styles.logoShell, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <Image source={APP_ICON} style={styles.logo} contentFit="cover" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center" },
  logoShell: { width: 84, height: 84, borderRadius: 26, padding: 6, borderWidth: StyleSheet.hairlineWidth, shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  logo: { width: "100%", height: "100%", borderRadius: 20 },
});
