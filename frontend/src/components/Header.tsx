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
        {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: transparent ? "transparent" : colors.surface,
          borderBottomWidth: transparent ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          minHeight: 56,
        },
        style,
      ]}
    >
      {(showBack || leftIcon) && (
        <Pressable
          testID="header-back-btn"
          onPress={onLeftPress || onBack}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons
            name={leftIcon || "chevron-back"}
            size={26}
            color={colors.onSurface}
          />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        {!!title && (
          <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }} numberOfLines={1}>
            {title}
          </Text>
        )}
        {!!subtitle && (
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}
