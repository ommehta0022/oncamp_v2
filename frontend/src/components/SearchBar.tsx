import React, { useState, useRef } from "react";
import { View, TextInput, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing, font } from "../theme/colors";

export type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSearch?: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

export default function SearchBar({ value, onChangeText, onSearch, placeholder = "Search", autoFocus }: SearchBarProps) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(autoFocus || false);
  const inputRef = useRef<TextInput>(null);
  
  // Debounce onChangeText logic can be implemented in the parent component
  // or added here using a useEffect timer.

  return (
    <View style={styles.container}>
      <View 
        style={[
          styles.inputContainer, 
          { 
            backgroundColor: colors.inputBg || colors.surfaceTertiary,
            borderColor: isFocused ? (colors.inputFocus || colors.brandPrimary) : "transparent",
            borderWidth: 1,
          }
        ]}
      >
        <Ionicons name="search" size={18} color={isFocused ? (colors.brandPrimary) : (colors.placeholder || colors.muted)} />
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={(e) => onSearch?.(e.nativeEvent.text)}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder || colors.muted}
          autoFocus={autoFocus}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          returnKeyType="search"
          style={[styles.input, { color: colors.textPrimary || colors.onSurface }]}
        />
        {value.length > 0 && (
          <Pressable onPress={() => onChangeText("")} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.placeholder || colors.muted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  inputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: font.base,
    paddingHorizontal: spacing.sm,
    height: "100%",
  },
});
