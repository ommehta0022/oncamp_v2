import React from "react";
import { View, Text, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { font, spacing } from "../theme/colors";

export type DividerProps = {
  orientation?: "horizontal" | "vertical";
  thickness?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  label?: string;
};

export default function Divider({ orientation = "horizontal", thickness = StyleSheet.hairlineWidth, color, style, label }: DividerProps) {
  const { colors } = useTheme();
  
  const bg = color || colors.border;
  
  if (label && orientation === "horizontal") {
    return (
      <View style={[styles.labelContainer, style]}>
        <View style={[styles.line, { height: thickness, backgroundColor: bg }]} />
        <Text style={[styles.label, { color: colors.textSecondary || colors.muted }]}>{label}</Text>
        <View style={[styles.line, { height: thickness, backgroundColor: bg }]} />
      </View>
    );
  }
  
  if (orientation === "vertical") {
    return <View style={[{ width: thickness, backgroundColor: bg, height: "100%" }, style]} />;
  }

  return <View style={[{ height: thickness, backgroundColor: bg, width: "100%" }, style]} />;
}

const styles = StyleSheet.create({
  labelContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: spacing.md,
  },
  line: {
    flex: 1,
  },
  label: {
    paddingHorizontal: spacing.md,
    fontSize: font.sm,
    fontWeight: "500",
  },
});
