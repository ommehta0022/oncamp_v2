import React from "react";
import { Pressable, Text, StyleSheet, ActivityIndicator, StyleProp, ViewStyle, TextStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing, font } from "../theme/colors";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

export default function Button({
  label, onPress, variant = "primary", loading, disabled, fullWidth,
  size = "md", style, textStyle, testID, leftIcon, rightIcon,
}: Props) {
  const { colors } = useTheme();

  const bg: Record<Variant, string> = {
    primary: colors.brandPrimary,
    secondary: colors.brandSecondary,
    ghost: "transparent",
    outline: "transparent",
    danger: colors.error,
  };
  const fg: Record<Variant, string> = {
    primary: colors.onBrandPrimary,
    secondary: colors.onBrandSecondary,
    ghost: colors.onSurface,
    outline: colors.onSurface,
    danger: colors.onError,
  };
  const border = variant === "outline" ? colors.borderStrong : "transparent";
  const heights = { sm: 40, md: 48, lg: 56 };
  const fontSize = { sm: font.base, md: font.lg, lg: font.lg };
  const px = { sm: spacing.lg, md: spacing.xl, lg: spacing.xl };

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress?.();
  };

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          height: heights[size],
          paddingHorizontal: px[size],
          borderRadius: radius.pill,
          backgroundColor: bg[variant],
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor: border,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          gap: spacing.sm,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <>
          {leftIcon}
          <Text style={[{ color: fg[variant], fontSize: fontSize[size], fontWeight: "500" }, textStyle]}>
            {label}
          </Text>
          {rightIcon}
        </>
      )}
    </Pressable>
  );
}
