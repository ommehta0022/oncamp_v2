import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, useWindowDimensions, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, spacing } from "@/src/theme/colors";
import Button from "@/src/components/Button";
import { onboardingSlides } from "@/src/data/onboarding";

const APP_ICON = require("../../assets/images/icon.png");

function formatOnboardingTitle(title = "") {
  return title
    .replace("Your campus, in one feed", "Your campus,\nin one feed")
    .replace("Discover groups worth joining", "Discover groups worth\njoining")
    .replace("Communicate the campus way", "Communicate the\ncampus way");
}

function formatOnboardingSubtitle(subtitle = "") {
  return subtitle
    .replace(", all in one place.", ",\nall in one place.")
    .replace(", find your people.", ",\nfind your people.")
    .replace(". No spam.", ".\nNo spam.");
}

export default function Welcome() {
  const { width, height } = useWindowDimensions();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const contentWidth = Math.max(0, width - spacing.xl * 2);

  useEffect(() => {
    const timer = setInterval(() => {
      const next = (index + 1) % onboardingSlides.length;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setIndex(next);
    }, 4500);
    return () => clearInterval(timer);
  }, [index, width]);

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceInverse }]} testID="welcome-screen">
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}
      >
        {onboardingSlides.map((slide, slideIndex) => (
          <View key={slideIndex} style={{ width, height }}>
            <Image source={{ uri: slide.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient
              colors={["rgba(3,16,30,0.26)", "rgba(3,16,30,0.18)", "rgba(3,16,30,0.82)", "rgba(3,12,23,0.99)"]}
              locations={[0, 0.34, 0.74, 1]}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ))}
      </ScrollView>

      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={[styles.top, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.logoShell}><Image source={APP_ICON} style={styles.logo} contentFit="cover" /></View>
          <View>
            <Text style={styles.brandLabel}>OnCampus</Text>
            <Text style={styles.brandMeta}>CAMPUS, ELEVATED</Text>
          </View>
        </View>

        <View style={[styles.slideTextWrap, { width: contentWidth }]} pointerEvents="none">
          <View style={styles.luxuryRule} />
          <Text style={[styles.title, { maxWidth: contentWidth }]}>{formatOnboardingTitle(onboardingSlides[index]?.title)}</Text>
          <Text style={[styles.subtitle, { maxWidth: contentWidth }]}>{formatOnboardingSubtitle(onboardingSlides[index]?.subtitle)}</Text>
        </View>

        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom + spacing.md, spacing.xl) }]}>
          <View style={styles.dots}>
            {onboardingSlides.map((_, dotIndex) => <View key={dotIndex} style={[styles.dot, { backgroundColor: dotIndex === index ? "#D9C486" : "#ffffff4A", width: dotIndex === index ? 24 : 6 }]} />)}
          </View>
          <Button label="Get started" fullWidth size="lg" onPress={() => router.push("/(auth)/signup")} testID="welcome-get-started-btn" />
          <Pressable onPress={() => router.push("/(auth)/login")} style={{ marginTop: spacing.md, alignItems: "center", paddingVertical: 8 }} testID="welcome-login-btn">
            <Text style={styles.loginText}>Already have an account? <Text style={{ fontWeight: "800", color: "#fff" }}>Log in</Text></Text>
          </Pressable>
          <Pressable onPress={() => router.push("/(auth)/register-institution")} style={{ marginTop: 2, alignItems: "center", paddingVertical: 8 }} testID="welcome-register-institution-btn">
            <Text style={styles.institutionText}>Represent a school or college?{"\n"}<Text style={{ fontWeight: "800", color: "#fff" }}>Register your institution</Text></Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.xl },
  logoShell: { width: 46, height: 46, borderRadius: 15, padding: 2, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.28)" },
  logo: { width: "100%", height: "100%", borderRadius: 12 },
  brandLabel: { color: "#fff", fontSize: font.lg, fontWeight: "900", letterSpacing: -0.2 },
  brandMeta: { color: "#D9C486", fontSize: 8, fontWeight: "900", letterSpacing: 1.25, marginTop: 2 },
  slideTextWrap: { position: "absolute", left: spacing.xl, bottom: 260 },
  luxuryRule: { width: 38, height: 3, borderRadius: 2, backgroundColor: "#D9C486", marginBottom: 13 },
  title: { color: "#fff", fontSize: 33, fontWeight: "800", letterSpacing: -0.6, lineHeight: 39, flexShrink: 1 },
  subtitle: { color: "#ffffffD9", fontSize: font.lg, marginTop: spacing.sm, lineHeight: 22, flexShrink: 1 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.xl },
  loginText: { color: "#fff", fontSize: font.base, textAlign: "center", flexShrink: 1 },
  institutionText: { color: "#ffffffC9", fontSize: font.sm, textAlign: "center", flexShrink: 1, lineHeight: 18 },
  dots: { flexDirection: "row", gap: 6, justifyContent: "center", marginBottom: spacing.xl },
  dot: { height: 6, borderRadius: 3 },
});
