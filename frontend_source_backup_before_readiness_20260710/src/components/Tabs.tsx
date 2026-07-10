import React, { useRef, useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, LayoutChangeEvent } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { font, spacing } from "../theme/colors";

export type TabItem = {
  id: string;
  label: string;
  badge?: number;
};

export type TabsProps = {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  variant?: "underline" | "pill";
};

export default function Tabs({ items, activeId, onChange, variant = "underline" }: TabsProps) {
  const { colors } = useTheme();
  
  // Implementation details for animated tabs would require measuring 
  // layouts which is complex in React Native. For a robust cross-platform
  // Tab component, we implement a simpler animated indicator or fallback to basic styling.
  
  if (variant === "pill") {
    return (
      <View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.pillContainer, { paddingHorizontal: spacing.lg }]}
        >
          {items.map((item) => {
            const isActive = item.id === activeId;
            return (
              <Pressable
                key={item.id}
                onPress={() => onChange(item.id)}
                style={[
                  styles.pillTab,
                  {
                    backgroundColor: isActive ? (colors.textPrimary || colors.onSurface) : colors.surface,
                    borderColor: isActive ? (colors.textPrimary || colors.onSurface) : (colors.borderStrong || colors.border),
                  }
                ]}
              >
                <Text 
                  style={{ 
                    color: isActive ? colors.surface : (colors.textPrimary || colors.onSurface),
                    fontWeight: "500",
                    fontSize: font.base
                  }}
                >
                  {item.label}
                </Text>
                {item.badge ? (
                  <View style={[styles.badge, { backgroundColor: isActive ? "#ffffff44" : colors.brandSecondary }]}>
                    <Text style={[styles.badgeText, { color: isActive ? colors.surface : "#FFF" }]}>{item.badge}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // Underline variant
  return (
    <View style={[styles.underlineContainer, { borderBottomColor: colors.border }]}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
      >
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <Pressable
              key={item.id}
              onPress={() => onChange(item.id)}
              style={styles.underlineTab}
            >
              <Text 
                style={{ 
                  color: isActive ? (colors.textPrimary || colors.onSurface) : (colors.textSecondary || colors.onSurfaceTertiary),
                  fontWeight: isActive ? "600" : "500",
                  fontSize: font.base
                }}
              >
                {item.label}
              </Text>
              {item.badge ? (
                <View style={[styles.badge, { backgroundColor: colors.brandSecondary, marginLeft: 6 }]}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              ) : null}
              
              {isActive && (
                <View style={[styles.indicator, { backgroundColor: colors.brandPrimary }]} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pillContainer: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  pillTab: {
    height: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  underlineContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  underlineTab: {
    paddingVertical: spacing.md,
    marginRight: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.xs,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  indicator: {
    position: "absolute",
    bottom: -1,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  }
});
