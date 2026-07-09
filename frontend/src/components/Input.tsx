import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TextInputProps, Pressable, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing, font } from "../theme/colors";

export type InputProps = TextInputProps & {
  label?: string;
  helperText?: string;
  error?: string;
  success?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  isPassword?: boolean;
  maxLength?: number;
};

export default function Input({
  label,
  helperText,
  error,
  success,
  leftIcon,
  rightIcon,
  onRightIconPress,
  isPassword,
  maxLength,
  style,
  value,
  onChangeText,
  ...props
}: InputProps) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isError = !!error;
  
  let borderColor = colors.inputBorder || colors.borderStrong;
  if (isFocused) borderColor = colors.inputFocus || colors.brandPrimary;
  if (success) borderColor = colors.success;
  if (isError) borderColor = colors.danger || colors.error;

  const actualRightIcon = isPassword ? (showPassword ? "eye-off-outline" : "eye-outline") : rightIcon;
  const handleRightIconPress = isPassword ? () => setShowPassword(!showPassword) : onRightIconPress;

  return (
    <View style={{ marginBottom: spacing.lg }}>
      {label && (
        <Text style={[styles.label, { color: colors.textSecondary || colors.onSurfaceTertiary }]}>
          {label}
        </Text>
      )}
      
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.inputBg || colors.surfaceSecondary,
            borderColor,
          },
          props.multiline && { height: 100, alignItems: "flex-start", paddingTop: spacing.md },
          style
        ]}
      >
        {leftIcon && (
          <Ionicons 
            name={leftIcon} 
            size={20} 
            color={colors.placeholder || colors.muted} 
            style={styles.leftIcon} 
          />
        )}
        
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isPassword && !showPassword}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          placeholderTextColor={colors.placeholder || colors.muted}
          maxLength={maxLength}
          style={[
            styles.input,
            { color: colors.textPrimary || colors.onSurface },
            props.multiline && { minHeight: 80, textAlignVertical: "top" }
          ]}
          {...props}
        />

        {value && !isPassword && !actualRightIcon && (
          <Pressable onPress={() => onChangeText?.("")} hitSlop={10} style={styles.rightIcon}>
            <Ionicons name="close-circle" size={18} color={colors.placeholder || colors.muted} />
          </Pressable>
        )}

        {actualRightIcon && (
          <Pressable onPress={handleRightIconPress} disabled={!handleRightIconPress} hitSlop={10} style={styles.rightIcon}>
            <Ionicons 
              name={actualRightIcon} 
              size={20} 
              color={success ? colors.success : (colors.placeholder || colors.muted)} 
            />
          </Pressable>
        )}
      </View>

      <View style={styles.footerRow}>
        {(error || helperText) ? (
          <Text style={[styles.helperText, { color: isError ? (colors.danger || colors.error) : (colors.textSecondary || colors.onSurfaceTertiary) }]}>
            {error || helperText}
          </Text>
        ) : <View style={{ flex: 1 }} />}

        {maxLength && (
          <Text style={[styles.charCount, { color: colors.textDisabled || colors.muted }]}>
            {value?.length || 0}/{maxLength}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: font.sm,
    fontWeight: "600",
    marginBottom: spacing.xs,
    letterSpacing: 0.3,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: radius.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: font.base,
    height: "100%",
  },
  leftIcon: {
    marginRight: spacing.sm,
  },
  rightIcon: {
    marginLeft: spacing.sm,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  helperText: {
    fontSize: font.sm,
    flex: 1,
  },
  charCount: {
    fontSize: font.sm,
    marginLeft: spacing.md,
  },
});
