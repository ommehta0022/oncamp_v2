import React from "react";
import { View, Text, StyleSheet, Pressable, StyleProp, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing, font } from "../theme/colors";

type CardProps = {
  children?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: "elevated" | "outlined" | "filled";
  padding?: number;
};

export default function Card({ children, onPress, style, variant = "elevated", padding = spacing.lg }: CardProps) {
  const { colors } = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case "outlined":
        return {
          backgroundColor: colors.card || colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.border,
        };
      case "filled":
        return {
          backgroundColor: colors.surfaceTertiary,
        };
      case "elevated":
      default:
        return {
          backgroundColor: colors.card || colors.surfaceSecondary,
          shadowColor: colors.shadow || "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        };
    }
  };

  const Container = onPress ? Pressable : View;
  
  return (
    <Container 
      style={({ pressed }: any) => [
        styles.card,
        getVariantStyles(),
        { padding },
        onPress && pressed && { opacity: 0.9 },
        style
      ]}
      onPress={onPress}
    >
      {children}
    </Container>
  );
}

// Subcomponents for structured cards

export function CardHeader({ title, subtitle, action, icon }: { title: string, subtitle?: string, action?: React.ReactNode, icon?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      {icon && <View style={styles.headerIcon}>{icon}</View>}
      <View style={{ flex: 1 }}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary || colors.onSurface }]}>{title}</Text>
        {subtitle && <Text style={[styles.headerSubtitle, { color: colors.textSecondary || colors.onSurfaceTertiary }]}>{subtitle}</Text>}
      </View>
      {action && <View>{action}</View>}
    </View>
  );
}

export function CardImage({ uri, height = 150 }: { uri: string, height?: number }) {
  return (
    <View style={[styles.imageContainer, { height }]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
    </View>
  );
}

export function CardFooter({ children, borderTop = false }: { children: React.ReactNode, borderTop?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.footer, borderTop && { borderTopWidth: 1, borderTopColor: colors.border }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  headerIcon: {
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: font.lg,
    fontWeight: "600",
  },
  headerSubtitle: {
    fontSize: font.sm,
    marginTop: 2,
  },
  imageContainer: {
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.lg,
    marginBottom: spacing.md,
  },
  footer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
});
