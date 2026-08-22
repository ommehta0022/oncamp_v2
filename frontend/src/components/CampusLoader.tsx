import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeProvider";

type Props = {
  label?: string;
  fullScreen?: boolean;
  compact?: boolean;
  style?: ViewStyle;
  inverse?: boolean;
};

export default function CampusLoader({
  label = "Loading campus…",
  fullScreen = false,
  compact = false,
  style,
  inverse = false,
}: Props) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const dotsLoop = Animated.loop(
      Animated.stagger(140, [dot1, dot2, dot3].map((dot) =>
        Animated.sequence([
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.delay(420),
        ]),
      )),
    );
    pulseLoop.start();
    floatLoop.start();
    dotsLoop.start();
    return () => {
      pulseLoop.stop();
      floatLoop.stop();
      dotsLoop.stop();
    };
  }, [dot1, dot2, dot3, float, pulse]);

  const ink = inverse ? "#FFFFFF" : colors.brandPrimary;
  const labelColor = inverse ? "rgba(255,255,255,0.82)" : colors.onSurfaceTertiary;
  const size = compact ? 44 : 58;
  const halo = compact ? 58 : 76;
  const pulseStyle = useMemo(() => ({
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.04] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.16] }) }],
  }), [pulse]);
  const floatStyle = useMemo(() => ({
    transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [1.5, -3] }) }],
  }), [float]);

  return (
    <View style={[fullScreen ? styles.fullScreen : styles.inline, style]} accessibilityRole="progressbar" accessibilityLabel={label}>
      <View style={[styles.visual, { width: halo, height: halo }]}> 
        <Animated.View style={[styles.halo, { width: halo, height: halo, borderRadius: halo / 2, backgroundColor: ink }, pulseStyle]} />
        <Animated.View style={[styles.iconShell, { width: size, height: size, borderRadius: size / 2, backgroundColor: inverse ? "rgba(255,255,255,0.16)" : colors.surfaceSecondary, borderColor: inverse ? "rgba(255,255,255,0.28)" : `${colors.brandPrimary}28` }, floatStyle]}>
          <Ionicons name="school" size={compact ? 22 : 28} color={ink} />
        </Animated.View>
      </View>
      {label ? <Text style={[styles.label, { color: labelColor }, compact && styles.compactLabel]}>{label}</Text> : null}
      <View style={styles.dots}>
        {[dot1, dot2, dot3].map((dot, index) => <Animated.View key={index} style={[styles.dot, { backgroundColor: ink, opacity: dot }]} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  inline: { alignItems: "center", justifyContent: "center", paddingVertical: 34, paddingHorizontal: 20 },
  visual: { alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute" },
  iconShell: { alignItems: "center", justifyContent: "center", borderWidth: 1 },
  label: { marginTop: 12, fontSize: 13, fontWeight: "600", textAlign: "center" },
  compactLabel: { marginTop: 8, fontSize: 12 },
  dots: { flexDirection: "row", gap: 5, marginTop: 8 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
});
