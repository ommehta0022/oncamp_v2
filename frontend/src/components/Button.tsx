import React, { useRef } from "react";
import { Pressable, Text, ActivityIndicator, StyleProp, ViewStyle, TextStyle, Animated, Easing } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing, font } from "../theme/colors";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "link";
type Size = "sm" | "md" | "lg" | "xl";

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: Size;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

export default function Button({
  label, onPress, variant = "primary", loading, disabled, fullWidth,
  size = "md", style, textStyle, testID, leftIcon, rightIcon,
}: ButtonProps) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const bg: Record<Variant, string> = {
    primary: colors.brandPrimary,
    secondary: colors.brandSecondary,
    ghost: "transparent",
    outline: "transparent",
    danger: colors.danger || colors.error,
    link: "transparent",
  };
  const fg: Record<Variant, string> = {
    primary: colors.onBrandPrimary,
    secondary: colors.onBrandSecondary,
    ghost: colors.textPrimary || colors.onSurface,
    outline: colors.textPrimary || colors.onSurface,
    danger: colors.onError,
    link: colors.link || colors.brandPrimary,
  };
  
  const border = variant === "outline" ? (colors.borderStrong || colors.border) : "transparent";
  
  const heights: Record<Size, number> = { sm: 36, md: 44, lg: 52, xl: 60 };
  const fontSizes: Record<Size, number> = { sm: font.sm, md: font.base, lg: font.lg, xl: font.xl };
  const px: Record<Size, number> = { sm: spacing.md, md: spacing.lg, lg: spacing.xl, xl: spacing["2xl"] };

  const handlePressIn = () => {
    if (disabled || loading) return;
    Animated.timing(scaleAnim, {
      toValue: 0.96,
      duration: 100,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 100,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.();
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, fullWidth && { width: "100%" }]}>
      <Pressable
        testID={testID}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          {
            height: variant === "link" ? undefined : heights[size],
            paddingHorizontal: variant === "link" ? 0 : px[size],
            paddingVertical: variant === "link" ? spacing.sm : 0,
            borderRadius: radius.pill,
            backgroundColor: disabled && variant !== "link" && variant !== "ghost" ? colors.surfaceTertiary : bg[variant],
            borderWidth: variant === "outline" ? 1.5 : 0,
            borderColor: disabled ? colors.border : border,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            opacity: disabled ? 0.6 : (pressed && variant === "link" ? 0.7 : 1),
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
            <Text 
              style={[
                { 
                  color: disabled ? (colors.textDisabled || colors.muted) : fg[variant], 
                  fontSize: fontSizes[size], 
                  fontWeight: variant === "link" ? "600" : "500",
                  textDecorationLine: variant === "link" ? "underline" : "none"
                }, 
                textStyle
              ]}
            >
              {label}
            </Text>
            {rightIcon}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
