import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeProvider";
import { spacing, font } from "../theme/colors";

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  testID?: string;
};

export default function SettingsRow({ icon, iconColor, iconBg, title, subtitle, value, right, onPress, destructive, testID }: Props) {
  const { colors } = useTheme();
  const titleColor = destructive ? colors.error : colors.onSurface;
  const resolvedIconColor = iconColor || (destructive ? colors.error : colors.onSurfaceTertiary);
  const resolvedIconBg = iconBg || (destructive ? `${colors.error}12` : colors.surfaceTertiary);
  const accessibleLabel = [title, value, subtitle].filter(Boolean).join(", ");

  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={accessibleLabel}
      accessibilityHint={onPress ? `Open ${title}` : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.surfaceTertiary : "transparent" },
      ]}
    >
      {icon && (
        <View accessible={false} style={[styles.iconWrap, { backgroundColor: resolvedIconBg }]}>
          <Ionicons name={icon} size={19} color={resolvedIconColor} />
        </View>
      )}
      <View style={{ flex: 1 }} accessible={false}>
        <Text allowFontScaling maxFontSizeMultiplier={1.6} style={{ color: titleColor, fontSize: font.lg, fontWeight: "500" }}>{title}</Text>
        {!!subtitle && <Text allowFontScaling maxFontSizeMultiplier={1.6} style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 3, lineHeight: 17 }}>{subtitle}</Text>}
      </View>
      {value !== undefined && <Text accessible={false} allowFontScaling maxFontSizeMultiplier={1.6} style={{ color: colors.onSurfaceTertiary, fontSize: font.base }}>{value}</Text>}
      {right}
      {!right && onPress && <Ionicons accessible={false} name="chevron-forward" size={18} color={colors.muted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 58,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
});
