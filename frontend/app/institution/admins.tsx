import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import Avatar from "@/src/components/Avatar";
import { users } from "@/src/data/mock";

const ROLES = ["Owner", "Admin", "Content admin", "Moderator"];

export default function InstitutionAdmins() {
  const { colors } = useTheme();
  const router = useRouter();
  const admins = users.slice(1, 5).map((u, i) => ({ ...u, adminRole: ROLES[i] }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="institution-admins-screen">
      <Header
        title="Institution admins"
        subtitle={`${admins.length} admins`}
        onBack={() => router.back()}
        right={
          <Pressable hitSlop={8}>
            <Ionicons name="person-add" size={22} color={colors.brandPrimary} />
          </Pressable>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.md }}>
        {admins.map((a) => (
          <View key={a.id} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Avatar uri={a.avatar} name={a.name} size={48} verified={a.verified} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }}>{a.name}</Text>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }} numberOfLines={1}>{a.bio}</Text>
              </View>
              <View style={[styles.roleTag, { backgroundColor: colors.brandTertiary }]}>
                <Text style={{ color: colors.onBrandTertiary, fontSize: 10, fontWeight: "500", letterSpacing: 0.3 }}>{a.adminRole.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable style={[styles.actionBtn, { borderColor: colors.borderStrong }]}>
                <Ionicons name="mail-outline" size={14} color={colors.onSurface} />
                <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>Message</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, { borderColor: colors.borderStrong }]}>
                <Ionicons name="swap-horizontal-outline" size={14} color={colors.onSurface} />
                <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>Change role</Text>
              </Pressable>
              {a.adminRole !== "Owner" && (
                <Pressable style={[styles.actionBtn, { borderColor: colors.error }]}>
                  <Ionicons name="remove-circle-outline" size={14} color={colors.error} />
                  <Text style={{ color: colors.error, fontSize: font.sm, fontWeight: "500" }}>Remove</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}

        <Pressable
          style={[styles.inviteBtn, { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}
        >
          <Ionicons name="add-circle" size={20} color={colors.brandPrimary} />
          <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "500" }}>Invite new admin</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  roleTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, borderWidth: 1,
  },
  inviteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    height: 48, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed",
  },
});
