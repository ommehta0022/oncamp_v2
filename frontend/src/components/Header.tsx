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
          onPress={onLeftPress || onBack}
          hitSlop={12}
          style={({ pressed }) => [styles.back, pressed && { backgroundColor: colors.surfaceTertiary }]}
        >
          <Ionicons name={leftIcon || "chevron-back"} size={24} color={colors.onSurface} />
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
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 56,
  },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  title: { fontSize: font.lg, fontWeight: "600", letterSpacing: -0.1 },
  subtitle: { fontSize: font.sm, marginTop: 2 },
});
