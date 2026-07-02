import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import { joinRequests } from "@/src/data/mock";

export default function Requests() {
  const { colors } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState(joinRequests);

  const handleAction = (id: string) => {
    setItems((x) => x.filter((r) => r.id !== id));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="requests-screen">
      <Header title="Join requests" subtitle={`${items.length} pending`} onBack={() => router.back()} />
      {items.length === 0 ? (
        <EmptyState icon="checkmark-done" title="All caught up" message="No pending join requests right now." />
      ) : (
        <FlatList showsVerticalScrollIndicator={false}
          data={items}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Avatar uri={item.avatar} name={item.name} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }}>{item.name}</Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{item.bio}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>Requested {item.requestedAt} ago</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                <Pressable
                  onPress={() => handleAction(item.id)}
                  style={[styles.reject, { borderColor: colors.borderStrong }]}
                  testID={`reject-${item.id}`}
                >
                  <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>Reject</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleAction(item.id)}
                  style={[styles.approve, { backgroundColor: colors.brandPrimary }]}
                  testID={`approve-${item.id}`}
                >
                  <Ionicons name="checkmark" size={16} color={colors.onBrandPrimary} />
                  <Text style={{ color: colors.onBrandPrimary, fontSize: font.base, fontWeight: "500" }}>Approve</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: 1, padding: spacing.lg },
  reject: {
    flex: 1, height: 42, borderRadius: radius.pill, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  approve: {
    flex: 1, height: 42, borderRadius: radius.pill,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
  },
});
