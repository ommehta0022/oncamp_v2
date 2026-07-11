import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";

interface NetworkErrorProps {
  onRetry: () => void;
  message?: string;
}

export function NetworkError({ onRetry, message = "Could not connect to the server." }: NetworkErrorProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Ionicons name="cloud-offline-outline" size={64} color={colors.muted} style={styles.icon} />
      <Text style={[styles.title, { color: colors.onSurface }]}>Connection Error</Text>
      <Text style={[styles.message, { color: colors.muted }]}>{message}</Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.brandPrimary }]}
        onPress={onRetry}
      >
        <Text style={[styles.buttonText, { color: colors.onBrandPrimary }]}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
