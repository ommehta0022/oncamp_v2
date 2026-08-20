import React from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, spacing } from "@/src/theme/colors";

const inlinePattern = /(\*\*[^*]+\*\*|_[^_]+_|https?:\/\/[^\s]+)/g;

export default function RichPostText({ content, numberOfLines }: { content: string; numberOfLines?: number }) {
  const { colors } = useTheme();
  const lines = String(content || "").split("\n");
  return (
    <View style={{ gap: 3 }}>
      {lines.map((raw, index) => {
        const heading = raw.match(/^#{1,3}\s+(.+)/);
        const bullet = raw.match(/^[-•]\s+(.+)/);
        const quote = raw.match(/^>\s+(.+)/);
        const value = heading?.[1] ?? bullet?.[1] ?? quote?.[1] ?? raw;
        if (bullet) {
          return <View key={index} style={{ flexDirection: "row", gap: 8, paddingLeft: 4 }}><Text style={{ color: colors.brandPrimary, fontSize: font.base }}>•</Text><Text style={{ flex: 1, color: colors.onSurface, fontSize: font.base, lineHeight: 22 }}>{renderInline(value, colors.brandPrimary)}</Text></View>;
        }
        if (quote) {
          return <View key={index} style={{ borderLeftWidth: 3, borderLeftColor: colors.brandPrimary, paddingLeft: spacing.sm }}><Text style={{ color: colors.onSurfaceSecondary, fontSize: font.base, fontStyle: "italic", lineHeight: 22 }}>{renderInline(value, colors.brandPrimary)}</Text></View>;
        }
        return (
          <Text
            key={index}
            numberOfLines={numberOfLines}
            style={{
              color: colors.onSurface,
              fontSize: heading ? (raw.startsWith("# ") ? font.xl : font.lg) : font.base,
              fontWeight: heading ? "700" : "400",
              lineHeight: heading ? 26 : 22,
            }}
          >
            {renderInline(value, colors.brandPrimary)}
          </Text>
        );
      })}
    </View>
  );
}

function renderInline(value: string, linkColor: string) {
  const parts = value.split(inlinePattern).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <Text key={index} style={{ fontWeight: "700" }}>{part.slice(2, -2)}</Text>;
    if (part.startsWith("_") && part.endsWith("_")) return <Text key={index} style={{ fontStyle: "italic" }}>{part.slice(1, -1)}</Text>;
    if (/^https?:\/\//.test(part)) {
      return <Text key={index} style={{ color: linkColor, textDecorationLine: "underline" }} onPress={() => void Linking.openURL(part)}>{part}</Text>;
    }
    return part;
  });
}
