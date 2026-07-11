import React, { useEffect, useRef } from "react";
import { Animated, View, StyleSheet } from "react-native";
import type { DimensionValue, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "@/src/theme/ThemeProvider";

interface LoadingSkeletonProps {
  style?: StyleProp<ViewStyle>;
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
}

export function LoadingSkeleton({ style, width, height, borderRadius = 4 }: LoadingSkeletonProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { backgroundColor: colors.border, opacity, borderRadius },
        width !== undefined ? { width } : undefined,
        height !== undefined ? { height } : undefined,
        style,
      ]}
    />
  );
}

export function FeedPostSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <LoadingSkeleton width={40} height={40} borderRadius={20} />
        <View style={styles.headerText}>
          <LoadingSkeleton width={120} height={14} style={styles.textLineGap} />
          <LoadingSkeleton width={80} height={12} />
        </View>
      </View>
      <LoadingSkeleton width="100%" height={14} style={styles.bodyLineFirst} />
      <LoadingSkeleton width="90%" height={14} style={styles.bodyLine} />
      <LoadingSkeleton width="60%" height={14} style={styles.bodyLineLast} />
      <LoadingSkeleton width="100%" height={200} borderRadius={8} />
    </View>
  );
}

export function FeedSkeleton() {
  return <FeedPostSkeleton />;
}

export function GroupSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.groupRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <LoadingSkeleton width={44} height={44} borderRadius={22} />
      <View style={styles.groupText}>
        <LoadingSkeleton width="70%" height={14} style={styles.textLineGap} />
        <LoadingSkeleton width="45%" height={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: "hidden",
  },
  card: {
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderRadius: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  textLineGap: {
    marginBottom: 6,
  },
  bodyLineFirst: {
    marginTop: 16,
    marginBottom: 8,
  },
  bodyLine: {
    marginBottom: 8,
  },
  bodyLineLast: {
    marginBottom: 16,
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginVertical: 6,
    borderWidth: 1,
    borderRadius: 12,
  },
  groupText: {
    flex: 1,
    marginLeft: 12,
  },
});
