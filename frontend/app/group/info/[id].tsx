import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import SettingsRow from "@/src/components/SettingsRow";
import { getGroup, users } from "@/src/data/mock";
import { useRole } from "@/src/context/RoleProvider";

export default function GroupInfo() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = getGroup(id!);
  if (!group) return null;
  const admins = users.slice(1, 4);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="group-info-screen">
      <View style={{ position: "relative" }}>
        <Image source={{ uri: group.image }} style={styles.cover} contentFit="cover" />
        <LinearGradient colors={["rgba(0,0,0,0.4)", "transparent", "rgba(0,0,0,0.8)"]} style={styles.scrim} />
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: "#00000055" }]}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <Pressable style={[styles.iconBtn, { backgroundColor: "#00000055" }]}>
            <Ionicons name="share-outline" size={20} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.coverContent}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <View style={[styles.pill, { backgroundColor: "#ffffff33" }]}>
              <Text style={{ color: "#fff", fontSize: font.sm, fontWeight: "500" }}>{group.category}</Text>
            </View>
            {group.verified && (
              <View style={[styles.pill, { backgroundColor: colors.brandSecondary }]}>
                <Ionicons name="checkmark" size={12} color="#fff" />
                <Text style={{ color: "#fff", fontSize: font.sm, fontWeight: "500" }}>Verified</Text>
              </View>
            )}
          </View>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.groupMeta}>
            {group.institution} · {group.city} · {group.members.toLocaleString()} members
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ padding: spacing.lg }}>
          <Text style={{ color: colors.onSurface, fontSize: font.base, lineHeight: 22 }}>
            {group.description}
          </Text>

          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
            <Pressable
              onPress={() => router.push(`/group/${group.id}`)}
              style={[styles.primaryBtn, { backgroundColor: colors.brandPrimary }]}
              testID="open-chat-btn"
            >
              <Ionicons name="chatbubbles" size={18} color={colors.onBrandPrimary} />
              <Text style={{ color: colors.onBrandPrimary, fontSize: font.base, fontWeight: "500" }}>Open chat</Text>
            </Pressable>
            <Pressable style={[styles.outlineBtn, { borderColor: colors.borderStrong }]}>
              <Ionicons name="notifications-off-outline" size={18} color={colors.onSurface} />
            </Pressable>
            <Pressable style={[styles.outlineBtn, { borderColor: colors.borderStrong }]}>
              <Ionicons name="search" size={18} color={colors.onSurface} />
            </Pressable>
          </View>
        </View>

        <Section title="Admins">
          {admins.map((u) => (
            <Pressable key={u.id} style={styles.memberRow}>
              <Avatar uri={u.avatar} name={u.name} size={44} verified={u.verified} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{u.name}</Text>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{u.bio}</Text>
              </View>
              <View style={[styles.roleTag, { backgroundColor: colors.brandTertiary }]}>
                <Text style={{ color: colors.onBrandTertiary, fontSize: 10, fontWeight: "500" }}>ADMIN</Text>
              </View>
            </Pressable>
          ))}
          <Pressable
            onPress={() => router.push(`/group/members/${group.id}`)}
            style={styles.seeAll}
            testID="see-all-members-btn"
          >
            <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "500" }}>See all {group.members.toLocaleString()} members</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.brandPrimary} />
          </Pressable>
        </Section>

        <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <SettingsRow icon="pin" title="Pinned messages" value="3" onPress={() => {}} />
          <SettingsRow icon="images-outline" title="Media, links & docs" value="128" onPress={() => {}} />
          <SettingsRow icon="notifications-outline" title="Notifications" value="On" onPress={() => {}} />
          {isGroupAdmin && (
            <SettingsRow icon="person-add-outline" title="Join requests" value="3" onPress={() => router.push(`/group/requests/${group.id}`)} />
          )}
          {role === "normal_user" && (
            <SettingsRow
              icon="clipboard-outline"
              title="Submit a post / poster request"
              subtitle="Ask admins to publish your poster in this group"
              onPress={() => router.push(`/group/post-request/${group.id}`)}
              testID="submit-post-request-btn"
            />
          )}
        </View>

        {isGroupAdmin && (
          <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <SettingsRow
              icon="shield-checkmark-outline"
              title="Admin panel"
              subtitle="Manage requests, roles, and content"
              onPress={() => router.push(`/group/admin/${group.id}`)}
              testID="open-admin-panel-btn"
            />
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <SettingsRow icon="flag-outline" title="Report group" destructive onPress={() => {}} />
          <SettingsRow icon="exit-outline" title="Leave group" destructive onPress={() => {}} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "500", paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {title}
      </Text>
      <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: "100%", height: 220 },
  scrim: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  topBar: {
    position: "absolute", top: 12, left: spacing.md, right: spacing.md,
    flexDirection: "row", justifyContent: "space-between",
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  coverContent: {
    position: "absolute", bottom: spacing.lg, left: spacing.lg, right: spacing.lg,
  },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  groupName: { color: "#fff", fontSize: 22, fontWeight: "500", marginTop: spacing.sm, letterSpacing: -0.5 },
  groupMeta: { color: "#ffffffcc", fontSize: font.sm, marginTop: 4 },
  primaryBtn: {
    flex: 1, height: 48, borderRadius: radius.pill,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
  },
  outlineBtn: {
    width: 48, height: 48, borderRadius: radius.pill,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  section: {
    marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1,
    marginBottom: spacing.md, overflow: "hidden",
  },
  memberRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  roleTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  seeAll: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 4,
    paddingVertical: spacing.md,
  },
});
