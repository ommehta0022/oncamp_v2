import React from "react";
import { View, Text, Pressable, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeProvider";
import { spacing, font } from "../theme/colors";

type Props = {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  showBack?: boolean;
  transparent?: boolean;
  style?: StyleProp<ViewStyle>;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  onLeftPress?: () => void;
};

export default function Header({
  title, subtitle, onBack, right, showBack = true, transparent, style, leftIcon, onLeftPress,
}: Props) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: transparent ? "transparent" : colors.surface,
          borderBottomWidth: transparent ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        style,
      ]}
    >
      {(showBack || leftIcon) && (
        <Pressable
          testID="header-back-btn"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onLeftPress || onBack}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.58 : 1 })}
        >
          <Ionicons name={leftIcon || "chevron-back"} size={26} color={colors.onSurface} />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        {!!title && <Text style={[styles.title, { color: colors.onSurface }]} numberOfLines={1}>{title}</Text>}
        {!!subtitle && <Text style={[styles.subtitle, { color: colors.onSurfaceTertiary }]} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 56,
  },
  title: { fontSize: font.lg, fontWeight: "500" },
  subtitle: { fontSize: font.sm, marginTop: 2 },
});
