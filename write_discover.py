content = r'''import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import { api } from "@/src/lib/api";
import { cache } from "@/src/lib/cache";
import { normalizeGroup } from "@/src/lib/mappers";
import { useToast } from "@/src/components/Toast";

type DiscoverCard = any;

const discoverCategories = ["Trending", "Institution", "Exam Prep", "Entrepreneurship", "Creative", "Sports", "Culture"];
const categoryAliases: Record<string, string[]> = {
  Institution: ["institution", "official", "batch"],
  "Exam Prep": ["exam", "study", "career"],
  Entrepreneurship: ["entrepreneurship", "startup", "tech", "career"],
  Creative: ["creative", "arts", "design"],
  Sports: ["sports"],
  Culture: ["culture", "clubs", "events"],
};

const MAHARASHTRA_CITIES = [
  "Mumbai", "Pune", "Nagpur", "Nashik", "Aurangabad", "Thane", "Solapur",
  "Amravati", "Kolhapur", "Nanded", "Sangli", "Malegaon", "Jalgaon",
  "Dhule", "Latur", "Ahmednagar", "Ratnagiri", "Satara", "Yavatmal", "Akola",
];

export default function Discover() {
  const { colors } = useTheme();
  const router = useRouter();
  const { showToast } = useToast();
  const [category, setCategory] = useState("Trending");
  const [query, setQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [discoverCards, setDiscoverCards] = useState<DiscoverCard[]>([]);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const { width } = useWindowDimensions();

  useEffect(() => {
    const fetchDiscover = async () => {
      try {
        const cached = await cache.get<DiscoverCard[]>("discover_groups");
        if (cached?.length) setDiscoverCards(cached.map(normalizeGroup));
        const res = await api.groups.discover("");
        const next = ((res as any).groups || res || []).map(normalizeGroup);
        setDiscoverCards(next);
        await cache.set("discover_groups", next);
      } catch {}
    };
    void fetchDiscover();
  }, []);

  const cardWidth = (width - spacing.lg * 2 - spacing.md) / 2;

  const filtered = useMemo(() => {
    let list = discoverCards;
    if (category !== "Trending") {
      list = list.filter((card) => {
        const haystack = ${card.category || ""}  .toLowerCase();
        if (category === "Institution") return card.official || card.verified || categoryAliases.Institution.some((alias) => haystack.includes(alias));
        return (categoryAliases[category] || [category]).some((alias) => haystack.includes(alias.toLowerCase()));
      });
    }
    // City filter
    if (selectedCity) {
      list = list.filter((card) => {
        const cityHaystack = ${card.city || ""}  .toLowerCase();
        return cityHaystack.includes(selectedCity.toLowerCase());
      });
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((card) =>
        String(card.title || card.name || "").toLowerCase().includes(q) ||
        String(card.city || card.institution || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [category, discoverCards, query, selectedCity]);

  const joinGroup = async (groupId: string) => {
    if (joiningId) return;
    setJoiningId(groupId);
    try {
      await api.groups.join(groupId);
      showToast({ message: "Join request sent", variant: "success" });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : "Could not request to join this group.", variant: "error" });
    } finally {
      setJoiningId(null);
    }
  };

  const trendingLabel = category !== "Trending"
    ? category.toUpperCase()
    : selectedCity
    ? TRENDING IN 
    : "TRENDING";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="discover-screen">
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Discover</Text>
        <Pressable
          style={[styles.filterBtn, { borderColor: selectedCity ? colors.brandPrimary : colors.borderStrong, backgroundColor: selectedCity ? colors.brandPrimary + "15" : colors.surface }]}
          onPress={() => setCityModalVisible(true)}
          testID="discover-filter-btn"
        >
          <Ionicons name="options-outline" size={18} color={selectedCity ? colors.brandPrimary : colors.onSurface} />
          {selectedCity && <Text style={{ color: colors.brandPrimary, fontSize: 11, fontWeight: "600", marginLeft: 4 }}>{selectedCity}</Text>}
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
          {!!query && (
            <Pressable onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color={colors.onSurfaceTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={{ height: 56, marginTop: spacing.md }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" }}
        >
          {discoverCategories.map((item) => {
            const active = category === item;
            return (
              <Pressable
                key={item}
                onPress={() => setCategory(item)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? "#111414" : colors.surface,
                    borderColor: active ? "#111414" : colors.borderStrong,
                  },
                ]}
                testID={discover-chip-}
              >
                <Text style={{ color: active ? "#fff" : colors.onSurface, fontSize: font.base, fontWeight: "500" }}>
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, marginBottom: spacing.md, gap: spacing.sm }}>
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceTertiary, marginBottom: 0 }]}>{trendingLabel}</Text>
          {selectedCity && (
            <Pressable onPress={() => setSelectedCity(null)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="close-circle" size={16} color={colors.brandPrimary} />
              <Text style={{ color: colors.brandPrimary, fontSize: 11 }}>Clear</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.grid}>
          {filtered.map((card) => (
            <DiscoverCardTile
              key={card.id}
              card={card}
              width={cardWidth}
              joining={joiningId === card.id}
              onJoin={() => joinGroup(card.id)}
              onPress={() => router.push(/group/info/)}
              onInstitutionRequest={card.institutionId ? () => router.push({
                pathname: "/institution/post-request/[id]",
                params: { id: card.institutionId, name: card.institution || card.city || card.name },
              }) : undefined}
            />
          ))}
        </View>

        {filtered.length === 0 && (
          <View style={{ padding: spacing["2xl"], alignItems: "center" }}>
            <Ionicons name="search" size={32} color={colors.muted} />
            <Text style={{ color: colors.onSurfaceTertiary, marginTop: spacing.md, fontSize: font.base }}>
              {query ? No matches for "" : selectedCity ? No groups found in  : "No groups found"}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* City Filter Modal */}
      <Modal
        visible={cityModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCityModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCityModalVisible(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHandle} />
            <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "600", marginBottom: spacing.md }}>
              Filter by City
            </Text>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginBottom: spacing.lg }}>
              Maharashtra cities
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Pressable
                onPress={() => { setSelectedCity(null); setCityModalVisible(false); }}
                style={[styles.cityRow, { borderColor: colors.border, backgroundColor: !selectedCity ? colors.brandPrimary + "18" : "transparent" }]}
              >
                <Ionicons name="globe-outline" size={20} color={!selectedCity ? colors.brandPrimary : colors.onSurface} />
                <Text style={{ flex: 1, color: !selectedCity ? colors.brandPrimary : colors.onSurface, fontSize: font.base, fontWeight: "500" }}>All India (No filter)</Text>
                {!selectedCity && <Ionicons name="checkmark" size={18} color={colors.brandPrimary} />}
              </Pressable>
              {MAHARASHTRA_CITIES.map((city) => (
                <Pressable
                  key={city}
                  onPress={() => { setSelectedCity(city); setCityModalVisible(false); }}
                  style={[styles.cityRow, { borderColor: colors.border, backgroundColor: selectedCity === city ? colors.brandPrimary + "18" : "transparent" }]}
                >
                  <Ionicons name="location-outline" size={20} color={selectedCity === city ? colors.brandPrimary : colors.onSurface} />
                  <Text style={{ flex: 1, color: selectedCity === city ? colors.brandPrimary : colors.onSurface, fontSize: font.base }}>{city}</Text>
                  {selectedCity === city && <Ionicons name="checkmark" size={18} color={colors.brandPrimary} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function DiscoverCardTile({
  card,
  width,
  joining,
  onJoin,
  onPress,
  onInstitutionRequest,
}: {
  card: DiscoverCard;
  width: number;
  joining: boolean;
  onJoin: () => void;
  onPress: () => void;
  onInstitutionRequest?: () => void;
}) {
  const { colors } = useTheme();
  const title = card.title || card.name || "Group";
  const members = card.membersText || ${Number(card.members || card.memberCount || 0).toLocaleString()} members;
  const location = [card.city, card.institution].filter(Boolean).join(" - ");

  return (
    <Pressable onPress={onPress} style={[styles.card, { width, height: width * 1.35 }]} testID={discover-card-}>
      {card.image ? (
        <Image source={{ uri: card.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.cardFallback, { backgroundColor: colors.brandPrimary }]}>
          <Ionicons name="school" size={38} color={colors.onBrandPrimary} />
        </View>
      )}
      <LinearGradient
        colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.9)"]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.cardTop}>
        <View style={styles.categoryPill}>
          <Text style={styles.categoryPillText}>{String(card.category || "Community").toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.titleRow}>
          <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
          {card.verified && (
            <View style={styles.verifiedDot}>
              <Ionicons name="checkmark" size={10} color="#fff" />
            </View>
          )}
        </View>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {members}{location ?  -  : ""}
        </Text>
        <Pressable
          style={[styles.joinBtn, { opacity: joining ? 0.75 : 1 }]}
          onPress={(event) => {
            event.stopPropagation();
            onJoin();
          }}
          disabled={joining}
          testID={join-}
        >
          {joining ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.joinBtnText}>Request to join</Text>}
        </Pressable>
        {onInstitutionRequest ? (
          <Pressable
            style={styles.institutionRequestBtn}
            onPress={(event) => {
              event.stopPropagation();
              onInstitutionRequest();
            }}
            testID={institution-request-}
          >
            <Text style={styles.institutionRequestText}>Send post request</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  title: { fontSize: 30, fontWeight: "500", letterSpacing: 0 },
  filterBtn: {
    height: 40, borderRadius: 20, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", paddingHorizontal: 12, gap: 4,
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
    fontSize: 12, fontWeight: "500", letterSpacing: 0,
    paddingHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  grid: {
    flexDirection: "row", flexWrap: "wrap", gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  card: {
    borderRadius: 20, overflow: "hidden", backgroundColor: "#222",
  },
  cardFallback: {
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
    color: "#111414", fontSize: 10, fontWeight: "500", letterSpacing: 0,
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
    letterSpacing: 0, lineHeight: 22,
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
  institutionRequestBtn: {
    backgroundColor: "#ffffffee",
    height: 32, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    marginTop: 6,
  },
  institutionRequestText: {
    color: "#111414", fontSize: 12, fontWeight: "600",
  },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: 48,
    maxHeight: "80%",
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#ccc", alignSelf: "center",
    marginBottom: spacing.lg,
  },
  cityRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    borderRadius: 10, borderWidth: 1, marginBottom: spacing.sm,
  },
});
'''

with open('frontend/app/(tabs)/discover.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Written discover.tsx!")
