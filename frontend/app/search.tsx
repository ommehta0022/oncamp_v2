import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, FlatList, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import { api } from "@/src/lib/api";

const TABS = ["Top", "Groups", "People", "Posts"];
const RECENT = ["Robotics", "Placement 2026", "IIT Bombay", "Photography"];
const TRENDING = ["#MoodIndigo2026", "Placement Season", "Guest Lecture", "Sports Meet", "Coding Hackathon"];

export default function Search() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState("Top");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);

  React.useEffect(() => {
    if (!query) return;
    const delay = setTimeout(async () => {
      try {
        const res: any = await api.search.query(query);
        const groups = (res.groups || []).map((g: any) => ({ ...g, isUser: false }));
        const users = (res.users || []).map((u: any) => ({ ...u, isUser: true }));
        setResults([...groups, ...users]);
      } catch (e) {}
    }, 300);
    return () => clearTimeout(delay);
  }, [query]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="search-screen">
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceTertiary }]}>
          <Ionicons name="search" size={18} color={colors.onSurfaceTertiary} />
          <TextInput
            testID="search-input"
            value={query}
            onChangeText={setQuery}
            placeholder="Search OnCampus"
            placeholderTextColor={colors.muted}
            autoFocus
            style={{ flex: 1, color: colors.onSurface, fontSize: font.base, marginLeft: spacing.sm }}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.onSurfaceTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={{ flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.md }}>
        {TABS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, { backgroundColor: tab === t ? colors.brandPrimary : colors.surfaceTertiary }]}
          >
            <Text style={{ color: tab === t ? colors.onBrandPrimary : colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {!query ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
          <Text style={[styles.section, { color: colors.onSurfaceTertiary }]}>RECENT</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }}>
            {RECENT.map((r) => (
              <Pressable key={r} onPress={() => setQuery(r)} style={[styles.chip, { backgroundColor: colors.surfaceTertiary }]}>
                <Ionicons name="time-outline" size={14} color={colors.onSurfaceTertiary} />
                <Text style={{ color: colors.onSurface, fontSize: font.sm }}>{r}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.section, { color: colors.onSurfaceTertiary, marginTop: spacing.xl }]}>TRENDING ON CAMPUS</Text>
          {TRENDING.map((t, i) => (
            <Pressable key={t} onPress={() => setQuery(t.replace("#", ""))} style={styles.trendRow}>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base, width: 24 }}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "500" }}>{t}</Text>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{Math.floor(Math.random() * 500) + 100} posts</Text>
              </View>
              <Ionicons name="trending-up" size={18} color={colors.brandSecondary} />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <FlatList showsVerticalScrollIndicator={false}
          data={results}
          keyExtractor={(item) => item.id || item.userId || String(Math.random())}
          contentContainerStyle={{ paddingVertical: spacing.md }}
          renderItem={({ item }) => (
            <Pressable style={styles.resultRow}>
              <Avatar
                uri={item.image || item.avatar}
                name={item.name}
                size={44}
                verified={item.verified}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{item.name}</Text>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }} numberOfLines={1}>
                  {item.isUser ? item.bio : `${item.institution} · ${item.members?.toLocaleString?.() || 0} members`}
                </Text>
              </View>
              <View style={[styles.tagBadge, { backgroundColor: colors.brandTertiary }]}>
                <Text style={{ color: colors.onBrandTertiary, fontSize: 10, fontWeight: "500" }}>
                  {item.isUser ? "PERSON" : "GROUP"}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 60 },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", height: 42, borderRadius: radius.pill, paddingHorizontal: spacing.md },
  tab: { height: 34, paddingHorizontal: spacing.lg, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  section: { fontSize: font.sm, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill },
  trendRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  resultRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
});
