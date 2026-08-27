import React from "react";
import { View, Text, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeProvider";

export type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "brand";

type BadgeProps = {
  label?: string | number;
  count?: number; // Used for dot/count badge
  variant?: BadgeVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
  status?: "online" | "offline" | "away" | "busy";
  isDot?: boolean; // For just a tiny dot
  textStyle?: StyleProp<import("react-native").TextStyle>;
};

export default function Badge({ label, count, variant = "default", icon, size = "md", style, status, isDot, textStyle }: BadgeProps) {
  const { colors } = useTheme();

  // Handle status explicitly if passed
  if (status) {
    const statusColors = {
      online: colors.success,
      offline: colors.textDisabled || colors.muted,
      away: colors.warning,
      busy: colors.danger || colors.error,
    };
    const sColor = statusColors[status];
    return (
      <View 
        style={[
          styles.dot, 
          { backgroundColor: sColor, borderColor: colors.surface }, 
          style
        ]} 
      />
    );
  }

  // Count/Dot logic
  if (isDot) {
    return <View style={[styles.dot, { backgroundColor: colors.danger || colors.error }, style]} />;
  }

  if (count !== undefined) {
    if (count <= 0) return null;
    const displayCount = count > 99 ? "99+" : count.toString();
    return (
      <View style={[styles.countBadge, { backgroundColor: colors.danger || colors.error }, style]}>
        <Text style={styles.countText}>{displayCount}</Text>
      </View>
    );
  }

  // Standard Pill logic
  const vColors: Record<BadgeVariant, { bg: string; fg: string }> = {
    default: { bg: colors.surfaceTertiary, fg: colors.textPrimary || colors.onSurface },
    success: { bg: colors.success + "22", fg: colors.success },
    warning: { bg: colors.warning + "22", fg: colors.warning },
    error: { bg: (colors.danger || colors.error) + "22", fg: colors.danger || colors.error },
    info: { bg: colors.info + "22", fg: colors.info },
    brand: { bg: colors.brandPrimary + "22", fg: colors.brandPrimary },
  };

  const c = vColors[variant];
  const px = { sm: 6, md: 8, lg: 12 };
  const py = { sm: 2, md: 4, lg: 6 };
  const fontSize = { sm: 10, md: 12, lg: 14 };

  return (
    <View 
      style={[
        styles.pill, 
        { backgroundColor: c.bg, paddingHorizontal: px[size], paddingVertical: py[size] },
        style
      ]}
    >
      {icon && <Ionicons name={icon} size={fontSize[size] + 2} color={c.fg} style={{ marginRight: 4 }} />}
      <Text style={[{ color: c.fg, fontSize: fontSize[size], fontWeight: "600", textTransform: "uppercase" }, textStyle]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
  },
});
