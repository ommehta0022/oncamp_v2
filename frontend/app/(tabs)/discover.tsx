import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import { discoverGroups, categories, Group } from "@/src/data/mock";

export default function Discover() {
  const { colors } = useTheme();
  const router = useRouter();
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    let list = discoverGroups;
    if (category !== "All") list = list.filter((g) => g.category === category);
    if (query)
      list = list.filter(
        (g) =>
          g.name.toLowerCase().includes(query.toLowerCase()) ||
          g.institution.toLowerCase().includes(query.toLowerCase())
      );
    return list;
  }, [category, query]);

  const trending = discoverGroups.slice(0, 3);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="discover-screen">
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.onSurface }]}>Discover</Text>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>
            Find groups, channels and communities
          </Text>
        </View>
        <Pressable style={styles.iconBtn} testID="discover-filter-btn">
          <Ionicons name="options-outline" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      <FlatList showsVerticalScrollIndicator={false}
        data={filtered}
        keyExtractor={(g) => g.id}
        numColumns={1}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          <View>
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
              <View style={[styles.searchBox, { backgroundColor: colors.surfaceTertiary }]}>
                <Ionicons name="search" size={18} color={colors.onSurfaceTertiary} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search by institution, city, category"
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
                {categories.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: category === c ? colors.brandPrimary : colors.surfaceTertiary,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: category === c ? colors.onBrandPrimary : colors.onSurface,
                        fontSize: font.base,
                        fontWeight: "500",
                      }}
                    >
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Trending on campus</Text>
            <FlatList
              horizontal
              data={trending}
              keyExtractor={(g) => "t-" + g.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => router.push(`/group/info/${item.id}`)}
                  style={{ width: 260, borderRadius: radius.md, overflow: "hidden" }}
                >
                  <Image source={{ uri: item.image }} style={{ width: "100%", height: 140 }} contentFit="cover" />
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.85)"]}
                    style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 100, padding: spacing.md, justifyContent: "flex-end" }}
                  >
                    <Text style={{ color: "#fff", fontSize: font.lg, fontWeight: "500" }} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={{ color: "#ffffffcc", fontSize: font.sm }}>
                      {item.members.toLocaleString()} members
                    </Text>
                  </LinearGradient>
                </Pressable>
              )}
            />

            <Text style={[styles.sectionTitle, { color: colors.onSurface, marginTop: spacing.xl }]}>
              {category === "All" ? "Browse all" : category}
            </Text>
          </View>
        }
        renderItem={({ item }) => <DiscoverCard group={item} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      />
    </SafeAreaView>
  );
}

function DiscoverCard({ group }: { group: Group }) {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/group/info/${group.id}`)}
      style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
      testID={`discover-card-${group.id}`}
    >
      <Image source={{ uri: group.image }} style={styles.cardImage} contentFit="cover" />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.7)"]} style={styles.cardScrim} />
      <View style={styles.cardOverlay}>
        <View style={[styles.categoryPill, { backgroundColor: "#ffffff33" }]}>
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "500" }}>{group.category}</Text>
        </View>
        {group.verified && (
          <View style={[styles.verifiedPill, { backgroundColor: colors.brandSecondary }]}>
            <Ionicons name="checkmark" size={11} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "500" }}>Verified</Text>
          </View>
        )}
      </View>
      <View style={{ padding: spacing.lg }}>
        <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>
          {group.institution} · {group.city}
        </Text>
        <Text style={{ color: colors.onSurfaceSecondary, fontSize: font.base, marginTop: spacing.sm, lineHeight: 20 }} numberOfLines={2}>
          {group.description}
        </Text>
        <View style={styles.cardFooter}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="people" size={14} color={colors.onSurfaceTertiary} />
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>
              {group.members.toLocaleString()} members
            </Text>
          </View>
          <Pressable
            onPress={() => router.push(`/group/info/${group.id}`)}
            style={[styles.joinBtn, { backgroundColor: colors.brandPrimary }]}
          >
            <Text style={{ color: colors.onBrandPrimary, fontSize: font.sm, fontWeight: "500" }}>
              {group.visibility === "private" ? "Request" : "Join"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 26, fontWeight: "500", letterSpacing: -0.5 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  searchBox: {
    flexDirection: "row", alignItems: "center",
    height: 42, borderRadius: radius.pill, paddingHorizontal: spacing.md,
  },
  chip: {
    height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  sectionTitle: {
    fontSize: font.lg, fontWeight: "500", paddingHorizontal: spacing.lg,
    marginTop: spacing.lg, marginBottom: spacing.md,
  },
  card: {
    marginHorizontal: spacing.lg, borderRadius: radius.md,
    borderWidth: 1, overflow: "hidden",
  },
  cardImage: { width: "100%", height: 140 },
  cardScrim: { position: "absolute", left: 0, right: 0, top: 60, height: 80 },
  cardOverlay: {
    position: "absolute", top: spacing.md, left: spacing.md, right: spacing.md,
    flexDirection: "row", justifyContent: "space-between",
  },
  categoryPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  verifiedPill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill,
  },
  cardFooter: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: spacing.md,
  },
  joinBtn: { paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: radius.pill },
});
