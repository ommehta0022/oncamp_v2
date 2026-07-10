import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import { api, SessionUser } from "@/src/lib/api";
import EmptyState from "@/src/components/EmptyState";

export default function UserConnections() {
  const { id, type } = useLocalSearchParams<{ id: string; type: "followers" | "following" }>();
  const { colors } = useTheme();
  const router = useRouter();
  
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id || !type) return;
    try {
      setLoading(true);
      const data = type === "followers" 
        ? await api.users.followers(id)
        : await api.users.following(id);
      setUsers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, type]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const renderItem = ({ item }: { item: SessionUser }) => (
    <Pressable 
      style={[styles.userRow, { borderBottomColor: colors.border }]} 
      onPress={() => router.push(`/user/${item.id}`)}
    >
      <Avatar uri={item.avatarUrl} name={item.name || "User"} size={48} verified={item.verified} />
      <View style={{ marginLeft: spacing.md, flex: 1 }}>
        <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>
          {item.name || "Unknown User"}
        </Text>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>
          {item.handle ? `@${item.handle}` : (item.course || "Member")}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceTertiary} />
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background || colors.surface }} edges={["top"]}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background || colors.surface }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={15}>
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface }]}>
          {type === "followers" ? "Followers" : "Following"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : users.length === 0 ? (
        <View style={{ flex: 1, marginTop: 40 }}>
          <EmptyState 
            icon="people-outline" 
            title={`No ${type === "followers" ? "followers" : "following"}`} 
            message="This list is empty right now." 
          />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: spacing.sm }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    height: 60,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
