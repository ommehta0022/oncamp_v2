import React, { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import EmptyState from "@/src/components/EmptyState";
import { api } from "@/src/lib/api";
import { normalizeGroup, normalizePost, normalizeUser } from "@/src/lib/mappers";

const TABS = ["Top", "Groups", "People", "Posts"];

type Result =
  | { kind: "group"; id: string; title: string; subtitle: string; avatar?: string | null; verified?: boolean }
  | { kind: "user"; id: string; title: string; subtitle: string; avatar?: string | null; verified?: boolean }
  | { kind: "post"; id: string; title: string; subtitle: string; avatar?: string | null; verified?: boolean };

export default function Search() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState("Top");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const delay = setTimeout(async () => {
      try {
        const res: any = await api.search.query(query.trim());
        const groups = (res.groups || []).map((row: any) => {
          const group = normalizeGroup(row);
          return {
            kind: "group" as const,
            id: group.id,
            title: group.name,
            subtitle: `${group.institutionName || group.category} - ${group.members.toLocaleString()} members`,
            avatar: group.avatarUrl || group.image,
            verified: group.verified,
          };
        });
        const users = (res.users || []).map((row: any) => {
          const user = normalizeUser(row);
          return {
            kind: "user" as const,
            id: user.id,
            title: user.name || "User",
            subtitle: user.bio || user.course || user.city || "OnCampus member",
            avatar: user.avatarUrl,
            verified: user.verified,
          };
        });
        const posts = (res.posts || []).map((row: any) => {
          const post = normalizePost(row);
          return {
            kind: "post" as const,
            id: post.id,
            title: post.content || "Post",
            subtitle: `${post.author.name} - ${post.createdAt}`,
            avatar: post.author.avatarUrl,
            verified: post.author.verified,
          };
        });
        const next = tab === "Groups" ? groups : tab === "People" ? users : tab === "Posts" ? posts : [...groups, ...users, ...posts];
        setResults(next);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [query, tab]);

  const openResult = (item: Result) => {
    if (item.kind === "group") router.push(`/group/info/${item.id}`);
    else if (item.kind === "user") router.push(`/user/${item.id}`);
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
        <EmptyState icon="search" title="Search OnCampus" message="Find real groups, people, and posts from your campus network." />
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          data={results}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          contentContainerStyle={{ paddingVertical: spacing.md, flexGrow: 1 }}
          ListEmptyComponent={
            <EmptyState
              icon={loading ? "hourglass-outline" : "search"}
              title={loading ? "Searching" : "No results found"}
              message={loading ? "Checking real campus records." : "Try a different name, group, or keyword."}
            />
          }
          renderItem={({ item }) => (
            <Pressable style={styles.resultRow} onPress={() => openResult(item)}>
              <Avatar uri={item.avatar} name={item.title} size={44} verified={item.verified} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }} numberOfLines={1}>{item.title}</Text>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              </View>
              <View style={[styles.tagBadge, { backgroundColor: colors.brandTertiary }]}>
                <Text style={{ color: colors.onBrandTertiary, fontSize: 10, fontWeight: "500" }}>
                  {item.kind.toUpperCase()}
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
