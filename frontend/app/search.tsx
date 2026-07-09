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
              style={({ pressed }) => [
                styles.resultRow,
                { backgroundColor: pressed ? colors.surfaceSecondary : "transparent", borderBottomColor: colors.border }
              ]}
              onPress={() => {
                if (item.kind === "GROUP") router.push(`/group/info/${item.id}`);
                if (item.kind === "POST") router.push(`/post/${item.id}`);
                if (item.kind === "PERSON") router.push(`/user/${item.id}`);
              }}
            >
              {item.kind === "POST" ? (
                <View style={[styles.postIconWrap, { backgroundColor: colors.brandPrimary + "15" }]}>
                  <Ionicons name="document-text" size={24} color={colors.brandPrimary} />
                </View>
              ) : (
                <Avatar uri={item.avatarUrl || item.mediaUrl} name={item.name || "Result"} size={48} verified={item.verified || item.official} />
              )}
              
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "600", letterSpacing: -0.2 }} numberOfLines={1}>
                    {item.name || item.title || "Post"}
                  </Text>
                  {item.kind === "PERSON" && item.verified && <Ionicons name="checkmark-circle" size={14} color={colors.brandPrimary} />}
                </View>
                
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: 14, marginTop: 2, lineHeight: 20 }} numberOfLines={2}>
                  {item.kind === "PERSON"
                    ? item.bio || item.handle || item.city || "User"
                    : item.kind === "POST"
                      ? item.content
                      : `${item.category || "Campus"} • ${(item.memberCount || 0).toLocaleString()} members`}
                </Text>
              </View>
              
              <View style={[
                styles.tagBadge, 
                { backgroundColor: item.kind === "GROUP" ? colors.success + "20" : item.kind === "PERSON" ? colors.info + "20" : colors.warning + "20" }
              ]}>
                <Text style={{ 
                  color: item.kind === "GROUP" ? colors.success : item.kind === "PERSON" ? colors.info : colors.warning, 
                  fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 
                }}>
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
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", height: 44, borderRadius: radius.pill, paddingHorizontal: spacing.md },
  tab: { height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  resultRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  postIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
});
