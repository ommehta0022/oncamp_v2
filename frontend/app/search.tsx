import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import EmptyState from "@/src/components/EmptyState";
import { api } from "@/src/lib/api";

const TABS = ["Top", "Groups", "People", "Posts"];

export default function Search() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState("Top");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      api.search.query(q)
        .then((response: any) => {
          const groups = (response.groups || []).map((item: any) => ({ ...item, kind: "GROUP" }));
          const people = (response.users || []).map((item: any) => ({ ...item, kind: "PERSON" }));
          const posts = (response.posts || []).map((item: any) => ({ ...item, name: item.title || item.content, kind: "POST" }));
          setResults([...groups, ...people, ...posts]);
        })
        .catch(() => setResults([]));
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const visible = results.filter((item) => {
    if (tab === "Top") return true;
    if (tab === "Groups") return item.kind === "GROUP";
    if (tab === "People") return item.kind === "PERSON";
    if (tab === "Posts") return item.kind === "POST";
    return true;
  });

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

      {!query.trim() ? (
        <EmptyState icon="search" title="Search OnCampus" message="Find real groups, people, and posts from your database." />
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          data={visible}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          contentContainerStyle={{ paddingVertical: spacing.md }}
          ListEmptyComponent={<EmptyState icon="search" title="No results" message="No real database records match this search." />}
          renderItem={({ item }) => (
            <Pressable
              style={styles.resultRow}
              onPress={() => {
                if (item.kind === "GROUP") router.push(`/group/info/${item.id}`);
                if (item.kind === "POST") router.push(`/post/${item.id}`);
              }}
            >
              <Avatar uri={item.avatarUrl || item.mediaUrl} name={item.name || "Result"} size={44} verified={item.verified || item.official} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }} numberOfLines={1}>
                  {item.name || item.title || "Post"}
                </Text>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }} numberOfLines={1}>
                  {item.kind === "PERSON"
                    ? item.bio || item.city || "User"
                    : item.kind === "POST"
                      ? item.content
                      : `${item.city || "Campus"} - ${(item.memberCount || 0).toLocaleString()} members`}
                </Text>
              </View>
              <View style={[styles.tagBadge, { backgroundColor: colors.brandTertiary }]}>
                <Text style={{ color: colors.onBrandTertiary, fontSize: 10, fontWeight: "500" }}>
                  {item.kind}
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
  resultRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
});
