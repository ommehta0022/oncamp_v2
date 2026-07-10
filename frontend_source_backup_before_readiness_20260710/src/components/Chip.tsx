import React from "react";
import { View, Text, StyleSheet, Pressable, StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing, font } from "../theme/colors";

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onClose?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
};

export default function Chip({ label, selected, onPress, onClose, icon, size = "md", style }: ChipProps) {
  const { colors } = useTheme();

  const px = { sm: spacing.md, md: spacing.lg };
  const py = { sm: 6, md: 10 };
  const fontSize = { sm: font.sm, md: font.base };

  const bg = selected ? (colors.textPrimary || colors.onSurface) : (colors.surfaceSecondary || colors.surface);
  const fg = selected ? colors.surface : (colors.textPrimary || colors.onSurface);
  const border = selected ? (colors.textPrimary || colors.onSurface) : (colors.borderStrong || colors.border);

  const Container = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: bg,
          borderColor: border,
          paddingHorizontal: px[size],
          paddingVertical: py[size],
        },
        style
      ]}
    >
      {icon && <Ionicons name={icon} size={fontSize[size] + 2} color={fg} style={{ marginRight: spacing.sm }} />}
      
      <Text style={{ color: fg, fontSize: fontSize[size], fontWeight: "500" }}>{label}</Text>
      
      {onClose && (
        <Pressable onPress={onClose} hitSlop={8} style={{ marginLeft: spacing.sm }}>
          <Ionicons name="close-circle" size={fontSize[size] + 2} color={selected ? colors.surfaceSecondary : (colors.muted || colors.borderStrong)} />
        </Pressable>
      )}
    </Container>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
});
