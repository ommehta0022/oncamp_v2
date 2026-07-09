import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "@/src/theme/ThemeProvider";

interface LoadingSkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
}

export function LoadingSkeleton({ width = "100%", height = 20, borderRadius = 4, style }: LoadingSkeletonProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
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
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.borderStrong,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function FeedSkeleton() {
  return (
    <View style={{ padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <LoadingSkeleton width={40} height={40} borderRadius={20} />
        <View style={{ marginLeft: 12 }}>
          <LoadingSkeleton width={120} height={16} style={{ marginBottom: 6 }} />
          <LoadingSkeleton width={80} height={12} />
        </View>
      </View>
      <LoadingSkeleton width="100%" height={100} borderRadius={8} style={{ marginBottom: 12 }} />
      <View style={{ flexDirection: "row", gap: 16 }}>
        <LoadingSkeleton width={60} height={24} borderRadius={12} />
        <LoadingSkeleton width={60} height={24} borderRadius={12} />
      </View>
    </View>
  );
}

export function GroupSkeleton() {
  return (
    <View style={{ flexDirection: "row", padding: 16, alignItems: "center" }}>
      <LoadingSkeleton width={48} height={48} borderRadius={24} />
      <View style={{ marginLeft: 16, flex: 1 }}>
        <LoadingSkeleton width="70%" height={18} style={{ marginBottom: 8 }} />
        <LoadingSkeleton width="40%" height={14} />
      </View>
    </View>
  );
}
