import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import Header from "@/src/components/Header";
import { users, getGroup } from "@/src/data/mock";

export default function Members() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = getGroup(id!);
  const [query, setQuery] = useState("");

  const list = users.filter((u) => u.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="members-screen">
      <Header title="Members" subtitle={group ? `${group.members.toLocaleString()} in ${group.name}` : ""} onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceTertiary }]}>
          <Ionicons name="search" size={18} color={colors.onSurfaceTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search members"
            placeholderTextColor={colors.muted}
            style={{ flex: 1, color: colors.onSurface, fontSize: font.base, marginLeft: spacing.sm }}
          />
        </View>
      </View>
      <FlatList showsVerticalScrollIndicator={false}
        data={list}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ paddingVertical: spacing.md }}
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <Avatar uri={item.avatar} name={item.name} size={44} verified={item.verified} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{item.name}</Text>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }} numberOfLines={1}>{item.bio}</Text>
            </View>
            {index < 2 && (
              <View style={[styles.tag, { backgroundColor: colors.brandTertiary }]}>
                <Text style={{ color: colors.onBrandTertiary, fontSize: 10, fontWeight: "500" }}>
                  {index === 0 ? "OWNER" : "ADMIN"}
                </Text>
              </View>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: "row", alignItems: "center", height: 42,
    borderRadius: radius.pill, paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
});
