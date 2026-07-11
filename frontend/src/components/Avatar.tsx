import React, { useState } from "react";
import { View, Text, StyleSheet, StyleProp, ViewStyle, Pressable, Animated } from "react-native";
import { Image } from "expo-image";
import { useTheme } from "../theme/ThemeProvider";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
const sizeMap: Record<AvatarSize, number> = { xs: 24, sm: 32, md: 40, lg: 56, xl: 72, xxl: 96 };

type Props = {
  uri?: string | null;
  name?: string;
  size?: AvatarSize | number;
  verified?: boolean;
  isGroup?: boolean;
  isOnline?: boolean;
  withBorder?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  badgeColor?: string;
};

export default function Avatar({ 
  uri, name = "?", size = "md", verified, isGroup, isOnline, withBorder, onPress, style, badgeColor 
}: Props) {
  const { colors } = useTheme();
  const [imgOpacity] = useState(new Animated.Value(0));
  
  const numSize = typeof size === "number" ? size : sizeMap[size];
  const initials = name.trim()
    .split(/\s+/)
    .map(s => s[0])
    .slice(0, isGroup ? 1 : 2)
    .join("")
    .toUpperCase() || "?";

  const onImageLoad = () => {
    Animated.timing(imgOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const content = (
    <View 
      style={[
        { 
          width: numSize, 
          height: numSize, 
          borderRadius: numSize / 2,
          backgroundColor: isGroup ? colors.brandSecondary + "33" : colors.brandTertiary,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: withBorder ? 2 : 0,
          borderColor: colors.surface,
          overflow: "hidden"
        },
        style
      ]}
    >
      <Text 
        style={{ 
          color: isGroup ? colors.brandSecondary : colors.onBrandTertiary, 
          fontSize: numSize * 0.36, 
          fontWeight: "600" 
        }}
      >
        {initials}
      </Text>
      
      {uri ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: imgOpacity }]}>
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            onLoad={onImageLoad}
          />
        </Animated.View>
      ) : null}
    </View>
  );

  return (
    <View style={[{ width: numSize, height: numSize }, withBorder && { margin: -2 }]}>
      {onPress ? (
        <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
          {content}
        </Pressable>
      ) : content}

      {/* Badges container - positioned relative to the avatar bounds */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {verified && !isOnline && (
          <View
            style={[
              styles.badge,
              {
                width: numSize * 0.32,
                height: numSize * 0.32,
                borderRadius: numSize * 0.16,
                backgroundColor: badgeColor || colors.brandPrimary,
                borderColor: colors.surface,
              },
            ]}
          >
            <View
              style={{
                width: numSize * 0.12,
                height: numSize * 0.12,
                backgroundColor: "#fff",
                borderRadius: numSize * 0.06,
              }}
            />
          </View>
        )}
        
        {isOnline && (
          <View
            style={[
              styles.badge,
              {
                width: numSize * 0.28,
                height: numSize * 0.28,
                borderRadius: numSize * 0.14,
                backgroundColor: colors.success,
                borderColor: colors.surface,
                borderWidth: 2.5,
              },
            ]}
          />
        )}
      </View>
    </View>
  );
}

export function AvatarGroup({ avatars, size = "md", max = 3 }: { avatars: {uri?: string, name: string}[], size?: AvatarSize, max?: number }) {
  const { colors } = useTheme();
  const numSize = sizeMap[size];
  const overlap = numSize * 0.3;
  
  const display = avatars.slice(0, max);
  const excess = Math.max(0, avatars.length - max);
  
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {display.map((a, i) => (
        <View key={i} style={{ zIndex: display.length - i, marginLeft: i > 0 ? -overlap : 0 }}>
          <Avatar uri={a.uri} name={a.name} size={size} withBorder />
        </View>
      ))}
      {excess > 0 && (
        <View 
          style={{ 
            zIndex: 0, 
            marginLeft: -overlap, 
            width: numSize, 
            height: numSize, 
            borderRadius: numSize/2, 
            backgroundColor: colors.surfaceTertiary,
            borderWidth: 2,
            borderColor: colors.surface,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: numSize * 0.3, fontWeight: "600" }}>
            +{excess}
          </Text>
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
