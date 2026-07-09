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

export default function Welcome() {
  const { width, height } = useWindowDimensions();
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      const next = (index + 1) % onboardingSlides.length;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setIndex(next);
    }, 4500);
    return () => clearInterval(t);
  }, [index, width]);

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]} testID="welcome-screen">
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}
      >
        {onboardingSlides.map((slide, i) => (
          <View key={i} style={{ width, height }}>
            <Image source={{ uri: slide.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient
              colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.85)", "rgba(0,0,0,0.98)"]}
              locations={[0, 0.35, 0.75, 1]}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ))}
      </ScrollView>

      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={[styles.top, { paddingTop: insets.top + spacing.md }]}>
          <View style={[styles.logoBadge, { backgroundColor: "#ffffff22", borderColor: "#ffffff33" }]}>
            <Text style={styles.brand}>OC</Text>
          </View>
          <Text style={styles.brandLabel}>OnCampus</Text>
        </View>

        <View style={styles.slideTextWrap} pointerEvents="none">
          <Text style={styles.title}>{onboardingSlides[index]?.title}</Text>
          <Text style={styles.subtitle}>{onboardingSlides[index]?.subtitle}</Text>
        </View>

        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom + spacing.md, spacing.xl) }]}>
          <View style={styles.dots}>
            {onboardingSlides.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === index ? "#fff" : "#ffffff55", width: i === index ? 24 : 6 },
                ]}
              />
            ))}
          </View>

          <Button
            label="Get started"
            fullWidth
            size="lg"
            onPress={() => router.push("/(auth)/signup")}
            testID="welcome-get-started-btn"
          />
          <Pressable
            onPress={() => router.push("/(auth)/login")}
            style={{ marginTop: spacing.md, alignItems: "center", paddingVertical: 8 }}
            testID="welcome-login-btn"
          >
            <Text style={{ color: "#fff", fontSize: font.base }}>
              Already have an account?{" "}
              <Text style={{ fontWeight: "500", color: "#fff" }}>Log in</Text>
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(auth)/register-institution")}
            style={{ marginTop: 2, alignItems: "center", paddingVertical: 8 }}
            testID="welcome-register-institution-btn"
          >
            <Text style={{ color: "#ffffffcc", fontSize: font.sm }}>
              Represent a school or college?{" "}
              <Text style={{ fontWeight: "500", color: "#fff" }}>Register your institution →</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  logoBadge: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
  },
  brand: { color: "#fff", fontWeight: "500", fontSize: font.lg },
  brandLabel: { color: "#fff", fontSize: font.lg, fontWeight: "500", letterSpacing: -0.3 },
  slideTextWrap: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    bottom: 260,
  },
  title: { color: "#fff", fontSize: 32, fontWeight: "500", letterSpacing: -0.6, lineHeight: 38 },
  subtitle: { color: "#ffffffdd", fontSize: font.lg, marginTop: spacing.sm, lineHeight: 22 },
  bottom: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: spacing.xl,
  },
  dots: { flexDirection: "row", gap: 6, justifyContent: "center", marginBottom: spacing.xl },
  dot: { height: 6, borderRadius: 3 },
});
