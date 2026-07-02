import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, useWindowDimensions, ScrollView } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Button from "@/src/components/Button";
import { onboardingSlides } from "@/src/data/mock";

export default function Welcome() {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      const next = (index + 1) % onboardingSlides.length;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setIndex(next);
    }, 4000);
    return () => clearInterval(t);
  }, [index, width]);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]} testID="welcome-screen">
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}
      >
        {onboardingSlides.map((slide, i) => (
          <View key={i} style={{ width, flex: 1 }}>
            <Image source={{ uri: slide.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.85)"]}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.slideText}>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.subtitle}>{slide.subtitle}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.top}>
          <View style={[styles.logoBadge, { backgroundColor: "#ffffff22" }]}>
            <Text style={styles.brand}>OC</Text>
          </View>
          <Text style={styles.brandLabel}>OnCampus</Text>
        </View>

        <View style={styles.bottom}>
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
            style={{ marginTop: spacing.lg, alignItems: "center" }}
            testID="welcome-login-btn"
          >
            <Text style={{ color: "#fff", fontSize: font.base }}>
              Already have an account?{" "}
              <Text style={{ fontWeight: "500", color: "#fff" }}>Log in</Text>
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(auth)/register-institution")}
            style={{ marginTop: spacing.md, alignItems: "center" }}
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    padding: spacing.xl,
    justifyContent: "space-between",
  },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing["2xl"] },
  logoBadge: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  brand: { color: "#fff", fontWeight: "500", fontSize: font.lg },
  brandLabel: { color: "#fff", fontSize: font.lg, fontWeight: "500" },
  bottom: { paddingBottom: spacing.xl },
  slideText: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    bottom: 200,
  },
  title: { color: "#fff", fontSize: 30, fontWeight: "500", letterSpacing: -0.5, lineHeight: 36 },
  subtitle: { color: "#ffffffcc", fontSize: font.lg, marginTop: spacing.md, lineHeight: 22 },
  dots: { flexDirection: "row", gap: 6, justifyContent: "center", marginBottom: spacing.xl },
  dot: { height: 6, borderRadius: 3 },
});
