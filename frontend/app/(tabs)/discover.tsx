import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import { api } from "@/src/lib/api";
import { cache } from "@/src/lib/cache";
import EmptyState from "@/src/components/EmptyState";
import { NetworkError } from "@/src/components/NetworkError";
import { asArray, normalizeGroup } from "@/src/lib/mappers";

type DiscoverCard = ReturnType<typeof normalizeGroup>;

const discoverCategories = ["Trending", "Academics", "Sports", "Social", "Career", "Tech", "Arts", "Clubs", "Official"];

export default function Discover() {
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [category, setCategory] = useState("Trending");
  const [query, setQuery] = useState("");
  const [discoverCards, setDiscoverCards] = useState<DiscoverCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cardWidth = (width - spacing.lg * 2 - spacing.md) / 2;

  const fetchDiscover = async (useCached = true) => {
    try {
      setError(null);
      if (useCached) {
        const cached = await cache.get("discover_groups");
        if (cached) setDiscoverCards(asArray(cached).map(normalizeGroup));
      }
      const res = await api.groups.discover("");
      const normalized = asArray(res, "groups").map(normalizeGroup);
      setDiscoverCards(normalized);
      await cache.set("discover_groups", normalized);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load discovery");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscover();
  }, []);

  const filtered = useMemo(() => {
    let list = discoverCards;
    if (category !== "Trending") {
      list = list.filter((c) => c.category.toLowerCase().includes(category.toLowerCase()));
    }
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((c) =>
        c.title.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q) ||
        c.institutionName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [category, discoverCards, query]);

  const joinGroup = async (groupId: string) => {
    if (joiningId) return;
    setJoiningId(groupId);
    try {
      await api.groups.join(groupId);
      await fetchDiscover(false);
    } finally {
      setJoiningId(null);
    }
  };

  if (error && discoverCards.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="discover-screen">
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.onSurface }]}>Discover</Text>
        </View>
        <NetworkError onRetry={() => fetchDiscover(false)} message={error} />
      </SafeAreaView>
    );
  }

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
                <Text style={{ color: active ? "#fff" : colors.onSurface, fontSize: font.base, fontWeight: "500" }}>
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={[styles.sectionLabel, { color: colors.onSurfaceTertiary }]}>
          {category === "Trending" ? "TRENDING GROUPS" : category.toUpperCase()}
        </Text>

        {loading && discoverCards.length === 0 ? (
          <View style={{ padding: spacing["2xl"], alignItems: "center" }}>
            <ActivityIndicator color={colors.brandPrimary} />
          </View>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="search"
            title="No groups match your criteria"
            message={query ? `No real groups found for "${query}".` : "Try a different category."}
          />
        ) : (
          <View style={styles.grid}>
            {filtered.map((card) => (
              <DiscoverCardTile
                key={card.id}
                card={card}
                width={cardWidth}
                joining={joiningId === card.id}
                onJoin={() => joinGroup(card.id)}
                onPress={() => router.push(`/group/info/${card.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DiscoverCardTile({
  card,
  width,
  joining,
  onJoin,
  onPress,
}: {
  card: DiscoverCard;
  width: number;
  joining: boolean;
  onJoin: () => void;
  onPress: () => void;
}) {
  const imageUri = card.image || card.avatarUrl;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { width, height: width * 1.35 }]}
      testID={`discover-card-${card.id}`}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noImage]}>
          <Ionicons name="people" size={44} color="#ffffffcc" />
        </View>
      )}
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
          {card.members.toLocaleString()} members{card.city ? ` - ${card.city}` : ""}
        </Text>
        <Pressable style={styles.joinBtn} testID={`join-${card.id}`} onPress={onJoin} disabled={joining}>
          {joining ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.joinBtnText}>Request to join</Text>}
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
  noImage: {
    backgroundColor: "#2E5C4E",
    alignItems: "center",
    justifyContent: "center",
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
