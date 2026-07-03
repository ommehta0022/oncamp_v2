import React, { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import Avatar from "@/src/components/Avatar";
import { api, SessionUser } from "@/src/lib/api";
import { font, spacing } from "@/src/theme/colors";

export default function Blocked() {
  const { colors } = useTheme();
  const router = useRouter();
  const [blockedUsers, setBlockedUsers] = useState<SessionUser[]>([]);

  useEffect(() => {
    api.blocked.list().then(setBlockedUsers).catch(() => setBlockedUsers([]));
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Blocked users" onBack={() => router.back()} />
      {blockedUsers.length === 0 ? (
        <EmptyState icon="shield-checkmark-outline" title="No blocked users" message="Users you block won't be able to see your posts or interact with you in groups." />
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: spacing.md }}
          renderItem={({ item }) => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
              <Avatar uri={item.avatarUrl} name={item.name || "User"} size={44} verified={item.verified} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{item.name || "User"}</Text>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{item.city || "Blocked user"}</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
