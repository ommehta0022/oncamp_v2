import React, { useState, useMemo, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import { api } from "@/src/lib/api";
import { cache } from "@/src/lib/cache";
type DiscoverCard = any;
const discoverCategories = ["Trending", "Academics", "Sports", "Social", "Career", "Tech", "Arts"];

export default function Discover() {
  const { colors } = useTheme();
  const router = useRouter();
  const [category, setCategory] = useState<string>("Trending");
  const [query, setQuery] = useState("");
  const [discoverCards, setDiscoverCards] = useState<DiscoverCard[]>([]);

  useEffect(() => {
    const fetchDiscover = async () => {
      try {
        const cached = await cache.get("discover_groups");
        if (cached) setDiscoverCards(cached as any);
        const res = await api.groups.discover("");
        setDiscoverCards((res as any).groups || res || []);
        await cache.set("discover_groups", (res as any).groups || res || []);
      } catch {}
    };
    fetchDiscover();
  }, []);
  const { width } = useWindowDimensions();

  const cardWidth = (width - spacing.lg * 2 - spacing.md) / 2;

  const filtered = useMemo(() => {
    let list = discoverCards;
    if (category !== "Trending") {
      list = list.filter((c) => c.category.toLowerCase().includes(category.toLowerCase()));
    }
    if (query) {
      list = list.filter((c) =>
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        c.city.toLowerCase().includes(query.toLowerCase())
      );
    }
    return list;
  }, [category, discoverCards, query]);

  const sectionLabel = category === "Trending" ? "TRENDING IN MUMBAI" : category.toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="discover-screen">
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Discover</Text>
        <Pressable
          style={[styles.filterBtn, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}
          testID="discover-filter-btn"
        >
          <Ionicons name="options-outline" size={18} color={colors.onSurface} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xs }}>
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceTertiary }]}>
          <Ionicons name="search" size={18} color={colors.onSurfaceTertiary} />
          <TextInput
            testID="discover-search"
            value={query}
            onChangeText={setQuery}
            placeholder="Search colleges, groups, cities..."
            placeholderTextColor={colors.muted}
            style={{ flex: 1, color: colors.onSurface, fontSize: font.base, marginLeft: spacing.sm }}
          />
        </View>
      </View>

      <View style={{ height: 56, marginTop: spacing.md }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" }}
        >
          {discoverCategories.map((c) => {
            const active = category === c;
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? "#111414" : colors.surface,
                    borderColor: active ? "#111414" : colors.borderStrong,
                  },
                ]}
                testID={`discover-chip-${c}`}
              >
                <Text
                  style={{
                    color: active ? "#fff" : colors.onSurface,
                    fontSize: font.base,
                    fontWeight: "500",
                  }}
                >
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <Text style={[styles.sectionLabel, { color: colors.onSurfaceTertiary }]}>{sectionLabel}</Text>

        <View style={styles.grid}>
          {filtered.map((card) => (
            <DiscoverCardTile key={card.id} card={card} width={cardWidth} onPress={() => router.push(`/group/info/${card.id}`)} />
          ))}
        </View>

        {filtered.length === 0 && (
          <View style={{ padding: spacing["2xl"], alignItems: "center" }}>
            <Ionicons name="search" size={32} color={colors.muted} />
            <Text style={{ color: colors.onSurfaceTertiary, marginTop: spacing.md, fontSize: font.base }}>
              No matches for &quot;{query}&quot;
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DiscoverCardTile({ card, width, onPress }: { card: DiscoverCard; width: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { width, height: width * 1.35 }]}
      testID={`discover-card-${card.id}`}
    >
      <Image source={{ uri: card.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.9)"]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.cardTop}>
        <View style={styles.categoryPill}>
          <Text style={styles.categoryPillText}>{card.category}</Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.titleRow}>
          <Text style={styles.cardTitle} numberOfLines={2}>{card.title}</Text>
          {card.verified && (
            <View style={styles.verifiedDot}>
              <Ionicons name="checkmark" size={10} color="#fff" />
            </View>
          )}
        </View>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {card.members} · {card.city}
        </Text>
        <Pressable style={styles.joinBtn} testID={`join-${card.id}`}>
          <Text style={styles.joinBtnText}>Request to join</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  title: { fontSize: 30, fontWeight: "500", letterSpacing: -0.5 },
  filterBtn: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  searchBox: {
    flexDirection: "row", alignItems: "center",
    height: 46, borderRadius: radius.pill, paddingHorizontal: spacing.md,
  },
  chip: {
    height: 38, paddingHorizontal: spacing.lg, borderRadius: radius.pill,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  sectionLabel: {
    fontSize: 12, fontWeight: "500", letterSpacing: 0.5,
    paddingHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  grid: {
    flexDirection: "row", flexWrap: "wrap", gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  card: {
    borderRadius: 20, overflow: "hidden", backgroundColor: "#222",
  },
  cardTop: {
    padding: spacing.md,
  },
  categoryPill: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffffee",
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 6,
  },
  categoryPillText: {
    color: "#111414", fontSize: 10, fontWeight: "500", letterSpacing: 0.3,
  },
  cardBottom: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    padding: spacing.md,
  },
  titleRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 4,
  },
  cardTitle: {
    flex: 1, color: "#fff", fontSize: font.lg, fontWeight: "500",
    letterSpacing: -0.3, lineHeight: 22,
  },
  verifiedDot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: "#ffffff33", alignItems: "center", justifyContent: "center",
    marginTop: 3,
  },
  cardMeta: {
    color: "#ffffffcc", fontSize: 11, marginTop: 4,
  },
  joinBtn: {
    backgroundColor: "#2E5C4E",
    height: 34, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    marginTop: spacing.sm,
  },
  joinBtnText: {
    color: "#fff", fontSize: font.sm, fontWeight: "500",
  },
});
