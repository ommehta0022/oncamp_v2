import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import EmptyState from "@/src/components/EmptyState";
import { api, GroupDto } from "@/src/lib/api";

const CATEGORIES = ["Trending", "Official", "Batch", "Clubs", "Study", "Events", "Sports", "Tech", "Arts", "Career"];

export default function Discover() {
  const { colors } = useTheme();
  const router = useRouter();
  const [category, setCategory] = useState("Trending");
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<GroupDto[]>([]);
  const { width } = useWindowDimensions();
  const cardWidth = (width - spacing.lg * 2 - spacing.md) / 2;

  const loadGroups = useCallback(async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category !== "Trending" && category !== "Official") params.set("category", category);
    const response = await api.groups.discover(params.toString() ? `?${params.toString()}` : "");
    setGroups(Array.isArray(response) ? response : response.groups || []);
  }, [category, query]);

  useEffect(() => {
    loadGroups().catch(() => setGroups([]));
  }, [loadGroups]);

  const filtered = useMemo(() => {
    if (category === "Official") return groups.filter((group) => group.official);
    return groups;
  }, [category, groups]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="discover-screen">
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Discover</Text>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xs }}>
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceTertiary }]}>
          <Ionicons name="search" size={18} color={colors.onSurfaceTertiary} />
          <TextInput
            testID="discover-search"
            value={query}
            onChangeText={setQuery}
            placeholder="Search groups, cities..."
            placeholderTextColor={colors.muted}
            style={{ flex: 1, color: colors.onSurface, fontSize: font.base, marginLeft: spacing.sm }}
          />
        </View>
      </View>

      <View style={{ height: 56, marginTop: spacing.md }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" }}>
          {CATEGORIES.map((item) => {
            const active = category === item;
            return (
              <Pressable
                key={item}
                onPress={() => setCategory(item)}
                style={[styles.chip, { backgroundColor: active ? "#111414" : colors.surface, borderColor: active ? "#111414" : colors.borderStrong }]}
                testID={`discover-chip-${item}`}
              >
                <Text style={{ color: active ? "#fff" : colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{item}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={[styles.sectionLabel, { color: colors.onSurfaceTertiary }]}>
          {category === "Trending" ? "PUBLIC GROUPS" : category.toUpperCase()}
        </Text>

        <View style={styles.grid}>
          {filtered.map((group) => (
            <DiscoverCardTile key={group.id} group={group} width={cardWidth} onPress={() => router.push(`/group/info/${group.id}`)} />
          ))}
        </View>

        {filtered.length === 0 && (
          <EmptyState icon="search" title="No public groups yet" message="Real discoverable groups will appear after they are created in Supabase." />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DiscoverCardTile({ group, width, onPress }: { group: GroupDto; width: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.card, { width, height: width * 1.35 }]} testID={`discover-card-${group.id}`}>
      {group.avatarUrl && <Image source={{ uri: group.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />}
      <LinearGradient colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.9)"]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />

      <View style={styles.cardTop}>
        <View style={styles.categoryPill}>
          <Text style={styles.categoryPillText}>{group.category}</Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.titleRow}>
          <Text style={styles.cardTitle} numberOfLines={2}>{group.name}</Text>
          {group.official && (
            <View style={styles.verifiedDot}>
              <Ionicons name="checkmark" size={10} color="#fff" />
            </View>
          )}
        </View>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {(group.memberCount || 0).toLocaleString()} members - {group.city}
        </Text>
        <View style={styles.joinBtn} testID={`join-${group.id}`}>
          <Text style={styles.joinBtnText}>View group</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: 30, fontWeight: "500", letterSpacing: -0.5 },
  searchBox: { flexDirection: "row", alignItems: "center", height: 46, borderRadius: radius.pill, paddingHorizontal: spacing.md },
  chip: { height: 38, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sectionLabel: { fontSize: 12, fontWeight: "500", letterSpacing: 0.5, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, paddingHorizontal: spacing.lg },
  card: { borderRadius: 20, overflow: "hidden", backgroundColor: "#222" },
  cardTop: { padding: spacing.md },
  categoryPill: { alignSelf: "flex-start", backgroundColor: "#ffffffee", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  categoryPillText: { color: "#111414", fontSize: 10, fontWeight: "500", letterSpacing: 0.3 },
  cardBottom: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.md },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 4 },
  cardTitle: { flex: 1, color: "#fff", fontSize: font.lg, fontWeight: "500", letterSpacing: -0.3, lineHeight: 22 },
  verifiedDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#ffffff33", alignItems: "center", justifyContent: "center", marginTop: 3 },
  cardMeta: { color: "#ffffffcc", fontSize: 11, marginTop: 4 },
  joinBtn: { backgroundColor: "#2E5C4E", height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  joinBtnText: { color: "#fff", fontSize: font.sm, fontWeight: "500" },
});
