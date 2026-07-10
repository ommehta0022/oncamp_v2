import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, font, radius } from "@/src/theme/colors";
import { useTheme } from "@/src/theme/ThemeProvider";
import Button from "@/src/components/Button";

interface NetworkErrorProps {
  onRetry: () => void;
  message?: string;
}

export function NetworkError({ onRetry, message = "Could not connect to the server." }: NetworkErrorProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.onSurfaceTertiary} />
      </View>
      <Text style={[styles.title, { color: colors.onSurface }]}>Connection Error</Text>
      <Text style={[styles.subtitle, { color: colors.onSurfaceTertiary }]}>{message}</Text>
      <Button 
        label="Try Again" 
        onPress={onRetry} 
        style={{ marginTop: spacing.xl, paddingHorizontal: spacing.xl }}
        variant="outline"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: font.xl,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: font.base,
    textAlign: "center",
  },
});
