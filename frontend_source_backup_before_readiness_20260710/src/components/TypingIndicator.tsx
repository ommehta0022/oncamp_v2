import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/colors";

export default function TypingIndicator() {
  const { colors } = useTheme();
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay(1200 - delay - 600),
        ])
      ).start();
    };

    animateDot(dot1, 0);
    animateDot(dot2, 200);
    animateDot(dot3, 400);
  }, [dot1, dot2, dot3]);

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: colors.onSurfaceTertiary, transform: [{ translateY: dot1.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] },
        ]}
      />
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: colors.onSurfaceTertiary, transform: [{ translateY: dot2.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] },
        ]}
      />
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: colors.onSurfaceTertiary, transform: [{ translateY: dot3.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
    marginLeft: spacing.md,
    marginTop: spacing.sm,
    gap: 4,
    height: 32,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
