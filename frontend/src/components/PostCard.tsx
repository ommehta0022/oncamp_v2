import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Avatar from "@/src/components/Avatar";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import { normalizePost } from "@/src/lib/mappers";

type Props = {
  post: any;
  onPress?: () => void;
};

export default function PostCard({ post, onPress }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const item = normalizePost(post);

  return (
    <Pressable
      onPress={onPress || (() => router.push(`/post/${item.id}`))}
      style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
    >
      <View style={styles.header}>
        <Avatar uri={item.author.avatarUrl || item.author.avatar} name={item.author.name} size={42} verified={item.author.verified} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }} numberOfLines={1}>
            {item.author.name}
          </Text>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }} numberOfLines={1}>
            {item.group?.name || item.author.institution || "OnCampus"}{item.createdAt ? ` - ${item.createdAt}` : ""}
          </Text>
        </View>
      </View>

      {!!item.content && (
        <Text style={{ color: colors.onSurface, fontSize: font.base, lineHeight: 22, marginTop: spacing.md }}>
          {item.content}
        </Text>
      )}

      {!!item.image && <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" />}

      <View style={[styles.metrics, { borderTopColor: colors.border }]}>
        <Metric icon="heart-outline" value={item.likes} />
        <Metric icon="chatbubble-outline" value={item.comments} />
      </View>
    </Pressable>
  );
}

function Metric({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={18} color={colors.onSurfaceTertiary} />
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "500" }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  image: { width: "100%", aspectRatio: 16 / 10, borderRadius: radius.md, marginTop: spacing.md },
  metrics: { flexDirection: "row", gap: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md, marginTop: spacing.md },
  metric: { flexDirection: "row", alignItems: "center", gap: 6 },
});
