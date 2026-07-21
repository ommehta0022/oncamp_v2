import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import EmptyState from "@/src/components/EmptyState";
import { api } from "@/src/lib/api";
import { normalizeGroup, normalizePost, normalizeUser } from "@/src/lib/mappers";

const TABS = ["Top", "Groups", "People", "Posts"];
const SEARCH_RECENTS_KEY = "oncampus.search.recents";

type SearchItem = any & { resultType: "group" | "user" | "post" };

export default function Search() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState("Top");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SEARCH_RECENTS_KEY)
      .then((value) => setRecent(value ? JSON.parse(value) : []))
      .catch(() => setRecent([]));
  }, []);

  const saveRecent = useCallback((value: string) => {
    const clean = value.trim();
    if (clean.length < 2) return;
    setRecent((current) => {
      const next = [clean, ...current.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
      AsyncStorage.setItem(SEARCH_RECENTS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  useEffect(() => {
    const clean = query.trim();
    if (clean.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const delay = setTimeout(async () => {
      try {
        const res: any = await api.search.query(clean);
        const groups = (res.groups || []).map((item: any) => ({ ...normalizeGroup(item), resultType: "group" as const }));
        const users = (res.users || []).map((item: any) => ({ ...normalizeUser(item), resultType: "user" as const }));
        const posts = (res.posts || []).map((item: any) => ({ ...normalizePost(item), resultType: "post" as const }));
        setResults([...groups, ...users, ...posts]);
        saveRecent(clean);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delay);
  }, [query, saveRecent]);

  const visibleResults = useMemo(() => {
    if (tab === "Groups") return results.filter((item) => item.resultType === "group");
    if (tab === "People") return results.filter((item) => item.resultType === "user");
    if (tab === "Posts") return results.filter((item) => item.resultType === "post");
    return results;
  }, [results, tab]);

  const openResult = (item: SearchItem) => {
    if (item.resultType === "group") router.push(`/group/info/${item.id}`);
    else if (item.resultType === "user") router.push(`/user/${item.id}`);
    else router.push(`/post/${item.id}`);
  };

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
        {TABS.map((item) => (
          <Pressable
            key={item}
            onPress={() => setTab(item)}
            style={[styles.tab, { backgroundColor: tab === item ? colors.brandPrimary : colors.surfaceTertiary }]}
          >
            <Text style={{ color: tab === item ? colors.onBrandPrimary : colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>
              {item}
            </Text>
          </Pressable>
        ))}
      </View>

      {!query ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
          {recent.length > 0 ? (
            <>
              <Text style={[styles.section, { color: colors.onSurfaceTertiary }]}>RECENT</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }}>
                {recent.map((item) => (
                  <Pressable key={item} onPress={() => setQuery(item)} style={[styles.chip, { backgroundColor: colors.surfaceTertiary }]}>
                    <Ionicons name="time-outline" size={14} color={colors.onSurfaceTertiary} />
                    <Text style={{ color: colors.onSurface, fontSize: font.sm }}>{item}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <EmptyState icon="search-outline" title="Search OnCampus" message="Find real groups, people, and posts from your campus network." />
          )}
        </ScrollView>
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          data={visibleResults}
          keyExtractor={(item) => `${item.resultType}-${item.id}`}
          contentContainerStyle={{ paddingVertical: spacing.md, flexGrow: 1 }}
          ListHeaderComponent={loading ? <ActivityIndicator color={colors.brandPrimary} style={{ marginVertical: spacing.lg }} /> : null}
          ListEmptyComponent={!loading ? <EmptyState icon="search-outline" title="No results" message="Try a different group, person, or post search." /> : null}
          renderItem={({ item }) => (
            <Pressable style={styles.resultRow} onPress={() => openResult(item)}>
              <Avatar
                uri={avatarFor(item)}
                name={titleFor(item)}
                size={44}
                verified={item.resultType === "post" ? item.author?.verified : item.verified}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }} numberOfLines={1}>
                  {titleFor(item)}
                </Text>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }} numberOfLines={1}>
                  {subtitleFor(item)}
                </Text>
              </View>
              <View style={[styles.tagBadge, { backgroundColor: colors.brandTertiary }]}>
                <Text style={{ color: colors.onBrandTertiary, fontSize: 10, fontWeight: "500" }}>
                  {item.resultType.toUpperCase()}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function titleFor(item: SearchItem) {
  if (item.resultType === "post") return item.author?.name || "Campus post";
  return item.name || "OnCampus";
}

function avatarFor(item: SearchItem) {
  if (item.resultType === "post") return item.author?.avatarUrl || item.author?.avatar;
  return item.image || item.avatarUrl || item.avatar;
}

function subtitleFor(item: SearchItem) {
  if (item.resultType === "user") return item.bio || [item.city, item.course].filter(Boolean).join(" - ") || "OnCampus member";
  if (item.resultType === "post") return item.content || "Campus post";
  return `${item.institution || item.city || "Campus"} - ${Number(item.members || item.memberCount || 0).toLocaleString()} members`;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 60,
  },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", height: 42, borderRadius: radius.pill, paddingHorizontal: spacing.md },
  tab: { height: 34, paddingHorizontal: spacing.lg, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  section: { fontSize: font.sm, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill },
  resultRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
});
