import React from "react";
import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from "react-native";
import { Image } from "expo-image";
import { useTheme } from "../theme/ThemeProvider";

type Props = {
  uri?: string;
  name?: string;
  size?: number;
  verified?: boolean;
  style?: StyleProp<ViewStyle>;
  badgeColor?: string;
};

export default function Avatar({ uri, name = "?", size = 44, verified, style, badgeColor }: Props) {
  const { colors } = useTheme();
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <View style={[{ width: size, height: size }, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceTertiary }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.brandTertiary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.onBrandTertiary, fontSize: size * 0.36, fontWeight: "500" } as TextStyle}>
            {initials}
          </Text>
        </View>
      )}
      {verified && (
        <View
          style={[
            styles.badge,
            {
              width: size * 0.32,
              height: size * 0.32,
              borderRadius: size * 0.16,
              backgroundColor: badgeColor || colors.brandPrimary,
              borderColor: colors.surface,
            },
          ]}
        >
          <View
            style={{
              width: size * 0.12,
              height: size * 0.12,
              backgroundColor: "#fff",
              borderRadius: size * 0.06,
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
