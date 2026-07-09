import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Easing } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, spacing, radius } from "@/src/theme/colors";
import Button from "@/src/components/Button";
import { typography } from "@/src/theme/typography";

export default function Welcome() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  const [tagline, setTagline] = useState("");
  const fullTagline = "Connecting your campus, seamlessly.";
  
  // Typewriter effect
  useEffect(() => {
    let i = 0;
    const typing = setInterval(() => {
      setTagline(fullTagline.substring(0, i + 1));
      i++;
      if (i >= fullTagline.length) {
        clearInterval(typing);
      }
    }, 50);
    return () => clearInterval(typing);
  }, []);

  // Initial animations
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    ]).start();

    // Pulse button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ])
    ).start();
  }, [scaleAnim, opacityAnim, pulseAnim]);

  return (
    <View style={styles.container} testID="welcome-screen">
      <LinearGradient
        colors={[colors.gradientStart || colors.brandPrimary, colors.gradientEnd || colors.brandTertiary, "#000000"]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      
      <Animated.View 
        style={[
          styles.content, 
          { 
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
            paddingTop: insets.top + spacing["3xl"]
          }
        ]}
      >
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>OC</Text>
        </View>
        <Text style={styles.brandTitle}>OnCampus</Text>
        <Text style={styles.tagline}>{tagline}<Text style={{color: "transparent"}}>|</Text></Text>
      </Animated.View>

      <Animated.View 
        style={[
          styles.bottom, 
          { 
            paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xl),
            opacity: opacityAnim
          }
        ]}
      >
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Button
            label="Get Started"
            fullWidth
            size="xl"
            onPress={() => router.push("/(auth)/signup")}
            testID="welcome-get-started-btn"
            style={{ 
              backgroundColor: colors.surfaceSecondary, 
              shadowColor: colors.surfaceSecondary,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 15,
              elevation: 10,
            }}
            textStyle={{ color: colors.brandPrimary, fontWeight: "700" }}
          />
        </Animated.View>

        <View style={styles.linksContainer}>
          <Text style={styles.loginText}>
            Already have an account?{" "}
          </Text>
          <Button 
            label="Log in" 
            variant="link"
            size="sm"
            onPress={() => router.push("/(auth)/login")} 
            textStyle={{ color: colors.surfaceSecondary }}
            style={{ paddingHorizontal: 0, height: undefined, paddingVertical: 0 }}
          />
        </View>

        <Pressable
          onPress={() => router.push("/(auth)/register-institution")}
          style={styles.institutionLink}
          testID="welcome-register-institution-btn"
        >
          <Text style={styles.institutionText}>
            Represent a school or college?{" "}
            <Text style={{ fontWeight: "700", color: "#fff" }}>Register your institution →</Text>
          </Text>
        </Pressable>
        
        <Text style={styles.version}>v2.0.0</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: "#000",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    marginTop: -80, // Offset to center visually
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  logoText: {
    fontSize: 48,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -2,
  },
  brandTitle: {
    ...typography.h1,
    color: "#fff",
    fontSize: 40,
    letterSpacing: -1,
    marginBottom: spacing.sm,
  },
  tagline: {
    ...typography.body,
    color: "rgba(255,255,255,0.8)",
    fontSize: 18,
    textAlign: "center",
    minHeight: 24, // Prevent jumping
  },
  bottom: {
    paddingHorizontal: spacing.xl,
    width: "100%",
  },
  linksContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  loginText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: font.base,
  },
  institutionLink: {
    alignItems: "center",
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  institutionText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: font.sm,
  },
  version: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    textAlign: "center",
    letterSpacing: 1,
  }
});
