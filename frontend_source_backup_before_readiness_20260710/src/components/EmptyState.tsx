import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeProvider";
import { spacing, font } from "../theme/colors";
import Button from "./Button";

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function EmptyState({ icon = "sparkles-outline", title, message, actionLabel, onAction }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, { backgroundColor: colors.brandTertiary }]}>
        <Ionicons name={icon} size={32} color={colors.onBrandTertiary} />
      </View>
      <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500", marginTop: spacing.lg }}>{title}</Text>
      {!!message && (
        <Text
          style={{
            color: colors.onSurfaceTertiary,
            fontSize: font.base,
            textAlign: "center",
            marginTop: spacing.sm,
            paddingHorizontal: spacing.xl,
            lineHeight: 20,
          }}
        >
          {message}
        </Text>
      )}
      {actionLabel && (
        <View style={{ marginTop: spacing.xl }}>
          <Button label={actionLabel} onPress={onAction} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
});
