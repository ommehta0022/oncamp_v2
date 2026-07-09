import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, useWindowDimensions, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import EmptyState from "@/src/components/EmptyState";
import SearchBar from "@/src/components/SearchBar";
import Chip from "@/src/components/Chip";
import SkeletonLoader from "@/src/components/SkeletonLoader";
import { api, GroupDto } from "@/src/lib/api";
import { typography } from "@/src/theme/typography";

const CATEGORIES = ["Trending", "Official", "Batch", "Clubs", "Study", "Events", "Sports", "Tech", "Arts", "Career"];

export default function Discover() {
  const { colors } = useTheme();
  const router = useRouter();
  const [category, setCategory] = useState("Trending");
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { width } = useWindowDimensions();
  const cardWidth = (width - spacing.xl * 2 - spacing.md) / 2;

  const loadGroups = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category !== "Trending" && category !== "Official") params.set("category", category);
    
    try {
      const response = await api.groups.discover(params.toString() ? `?${params.toString()}` : "");
      setGroups(Array.isArray(response) ? response : response.groups || []);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [category, query]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const filtered = useMemo(() => {
    if (category === "Official") return groups.filter((group) => group.official);
    return groups;
  }, [category, groups]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background || colors.surface }} edges={["top"]} testID="discover-screen">
      <View style={[styles.header, { backgroundColor: colors.background || colors.surface }]}>
        <Text style={[styles.title, { color: colors.textPrimary || colors.onSurface }]}>Discover</Text>
      </View>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, backgroundColor: colors.background || colors.surface }}>
        <SearchBar 
          value={query} 
          onChangeText={setQuery} 
          placeholder="Search groups, interests, locations..." 
        />
      </View>

      <View style={{ height: 44, marginBottom: spacing.sm }}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm, alignItems: "center" }}
        >
          {CATEGORIES.map((item) => {
            const active = category === item;
            return (
              <Chip 
                key={item}
                label={item} 
                selected={active}
                onPress={() => {
                  setCategory(item);
                  if (Platform.OS === 'ios') Haptics.selectionAsync();
                }}
                size="sm"
              />
            );
          })}
        </ScrollView>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <Text style={[styles.sectionLabel, { color: colors.textSecondary || colors.onSurfaceTertiary }]}>
          {category === "Trending" ? "TRENDING PUBLIC GROUPS" : category.toUpperCase()}
        </Text>

        <View style={styles.grid}>
          {loading ? (
            // Skeleton rendering
            Array.from({ length: 4 }).map((_, i) => (
              <View key={i} style={{ width: cardWidth, marginBottom: spacing.md }}>
                <SkeletonLoader type="groupRow" />
              </View>
            ))
          ) : filtered.length > 0 ? (
            filtered.map((group) => (
              <DiscoverCardTile 
                key={group.id} 
                group={group} 
                width={cardWidth} 
                onPress={() => {
                  if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/group/info/${group.id}`);
                }} 
              />
            ))
          ) : null}
        </View>

        {!loading && filtered.length === 0 && (
          <View style={{ marginTop: spacing.xl * 2 }}>
            <EmptyState 
              icon="search" 
              title="No groups found" 
              message="We couldn't find any public groups matching your search or filter." 
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DiscoverCardTile({ group, width, onPress }: { group: GroupDto; width: number; onPress: () => void }) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  return (
    <Pressable 
      onPress={onPress} 
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      testID={`discover-card-${group.id}`}
    >
      <Animated.View style={[
        styles.card, 
        { 
          width, 
          height: width * 1.4,
          transform: [{ scale: scaleAnim }],
          shadowColor: colors.brandPrimary || "#000",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.15,
          shadowRadius: 15,
          elevation: 5,
        }
      ]}>
        {group.avatarUrl ? (
          <Image source={{ uri: group.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceTertiary || "#333", alignItems: "center", justifyContent: "center" }]}>
            <Ionicons name="people" size={48} color={colors.onSurfaceTertiary || "#666"} />
          </View>
        )}
        <LinearGradient 
          colors={["transparent", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.95)"]} 
          locations={[0, 0.4, 1]} 
          style={StyleSheet.absoluteFill} 
        />

        <View style={styles.cardTop}>
          <View style={styles.categoryPill}>
            <Text style={styles.categoryPillText}>{group.category}</Text>
          </View>
        </View>

        <View style={styles.cardBottom}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle} numberOfLines={2}>{group.name}</Text>
            {group.official && (
              <View style={[styles.verifiedDot, { backgroundColor: colors.info || "#3b82f6" }]}>
                <Ionicons name="checkmark" size={10} color="#fff" />
              </View>
            )}
          </View>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {(group.memberCount || 0).toLocaleString()} members • {group.city}
          </Text>
          
          <LinearGradient
            colors={[colors.brandPrimary || "#2E5C4E", colors.brandSecondary || "#1a362d"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.joinBtn}
          >
            <Text style={styles.joinBtnText}>View Group</Text>
          </LinearGradient>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    paddingHorizontal: spacing.xl, 
    paddingTop: spacing.md, 
    paddingBottom: spacing.sm 
  },
  title: { 
    ...typography.h2,
    fontSize: 28, 
    letterSpacing: -0.5 
  },
  sectionLabel: { 
    fontSize: 12, 
    fontWeight: "700", 
    letterSpacing: 0.8, 
    paddingHorizontal: spacing.xl, 
    marginTop: spacing.md,
    marginBottom: spacing.md 
  },
  grid: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    gap: spacing.md, 
    paddingHorizontal: spacing.xl 
  },
  card: { 
    borderRadius: radius.lg, 
    overflow: "hidden", 
    backgroundColor: "#222",
  },
  cardTop: { 
    padding: spacing.sm,
    paddingTop: spacing.md,
  },
  categoryPill: { 
    alignSelf: "flex-start", 
    backgroundColor: "rgba(255,255,255,0.9)", 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: radius.pill 
  },
  categoryPillText: { 
    color: "#000", 
    fontSize: 10, 
    fontWeight: "700", 
    letterSpacing: 0.5 
  },
  cardBottom: { 
    position: "absolute", 
    left: 0, 
    right: 0, 
    bottom: 0, 
    padding: spacing.md 
  },
  titleRow: { 
    flexDirection: "row", 
    alignItems: "flex-start", 
    gap: 6 
  },
  cardTitle: { 
    flex: 1, 
    color: "#fff", 
    fontSize: font.lg, 
    fontWeight: "700", 
    letterSpacing: -0.3, 
    lineHeight: 22 
  },
  verifiedDot: { 
    width: 16, 
    height: 16, 
    borderRadius: 8, 
    alignItems: "center", 
    justifyContent: "center", 
    marginTop: 3 
  },
  cardMeta: { 
    color: "rgba(255,255,255,0.8)", 
    fontSize: 11, 
    fontWeight: "500",
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  joinBtn: { 
    height: 36, 
    borderRadius: radius.md, 
    alignItems: "center", 
    justifyContent: "center",
  },
  joinBtnText: { 
    color: "#fff", 
    fontSize: font.sm, 
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
