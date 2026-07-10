import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import { useRole } from "@/src/context/RoleProvider";
import { api } from "@/src/lib/api";

export default function Profile() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useRole();
  const [myGroups, setMyGroups] = useState<any[]>([]);

  useEffect(() => {
    api.groups.listMine().then(res => setMyGroups(((res as any).groups || res || []).slice(0, 4))).catch(() => {});
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="profile-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={{ position: "relative" }}>
          <Image
            source={{ uri: "https://images.unsplash.com/photo-1562774053-701939374585?w=1200&q=80" }}
            style={styles.cover}
            contentFit="cover"
          />
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={styles.coverScrim} />
          <View style={styles.topBar}>
            <View />
            <Pressable
              onPress={() => router.push("/settings")}
              style={[styles.iconBtn, { backgroundColor: "#00000055" }]}
              testID="profile-settings-btn"
            >
              <Ionicons name="settings-outline" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>

        <View style={styles.profileHeader}>
          <View style={{ marginTop: -50, alignSelf: "flex-start" }}>
            <Avatar uri={(user as any)?.avatar} name={user?.name || "User"} size={100} verified={(user as any)?.verified} />
          </View>
          <View style={{ flex: 1, marginTop: spacing.md, flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
            <Pressable
              onPress={() => router.push("/settings/edit-profile")}
              style={[styles.outlineBtn, { borderColor: colors.borderStrong }]}
              testID="edit-profile-btn"
            >
              <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>Edit profile</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/settings/invite")}
              style={[styles.filledBtn, { backgroundColor: colors.brandPrimary }]}
            >
              <Ionicons name="share-outline" size={16} color={colors.onBrandPrimary} />
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "500", letterSpacing: -0.5 }}>
              {user?.name}
            </Text>
            {(user as any)?.roles?.includes("student") && (
              <View style={[styles.badgeChip, { backgroundColor: colors.brandTertiary }]}>
                <Text style={{ color: colors.onBrandTertiary, fontSize: 10, fontWeight: "500" }}>STUDENT</Text>
              </View>
            )}
          </View>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base, marginTop: 2 }}>
            {(user as any)?.email}
          </Text>

          <View style={[styles.statsRow, { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
            <Stat label="POSTS" value="-" />
            <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
            <Stat label="FOLLOWERS" value="-" />
            <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
            <Stat label="FOLLOWING" value="-" />
          </View>

          <Text style={{ color: colors.onSurface, fontSize: font.base, marginTop: spacing.md, lineHeight: 22 }}>
            {user?.bio || "No bio yet."}
          </Text>

          <View style={{ flexDirection: "row", gap: spacing.lg, marginTop: spacing.md, flexWrap: "wrap" }}>
            <MetaRow icon="school-outline" text={(user as any)?.institution?.name || "Unknown"} />
            <MetaRow icon="location-outline" text={(user as any)?.location || "Unknown"} />
          </View>

          <View style={styles.statsRow}>
            <Stat label="Groups" value="12" />
            <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
            <Stat label="Posts" value="48" />
            <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
            <Stat label="Following" value="284" />
          </View>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <View style={styles.sectionHeader}>
            <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }}>Your groups</Text>
            <Pressable onPress={() => router.push("/(tabs)/groups")}>
              <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "500" }}>See all</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
            {myGroups.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => router.push(`/group/${g.id}`)}
                style={[styles.groupTile, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              >
                <Image source={{ uri: g.image }} style={styles.groupTileImg} contentFit="cover" />
                <View style={{ padding: spacing.md }}>
                  <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }} numberOfLines={1}>
                    {g.name}
                  </Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>
                    {g.members.toLocaleString()} members
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Text style={[styles.sectionHeaderTitle, { color: colors.onSurface }]}>Achievements</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
            {[
              { i: "trophy", label: "Top Contributor", c: colors.warning },
              { i: "rocket", label: "Early Adopter", c: colors.brandSecondary },
              { i: "medal", label: "Verified Student", c: colors.success },
              { i: "flame", label: "30 Day Streak", c: colors.error },
            ].map((a, i) => (
              <View
                key={i}
                style={[styles.achievement, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              >
                <View style={[styles.achIcon, { backgroundColor: a.c + "22" }]}>
                  <Ionicons name={a.i as any} size={22} color={a.c} />
                </View>
                <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500", marginTop: spacing.sm, textAlign: "center" }}>
                  {a.label}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaRow({ icon, text }: { icon: any; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Ionicons name={icon} size={15} color={colors.onSurfaceTertiary} />
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base }}>{text}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ color: colors.onSurface, fontSize: font.xl, fontWeight: "500" }}>{value}</Text>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: "100%", height: 160 },
  coverScrim: { position: "absolute", left: 0, right: 0, top: 0, height: 160 },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", justifyContent: "space-between",
    padding: spacing.md,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  profileHeader: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
  },
  outlineBtn: {
    paddingHorizontal: spacing.lg, height: 40, borderRadius: radius.pill,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  filledBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
  },
  badgeChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 4 },
  statsRow: {
    flexDirection: "row", alignItems: "center",
    marginTop: spacing.xl, paddingVertical: spacing.md,
  },
  statDiv: { width: 1, height: 30 },
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  sectionHeaderTitle: {
    fontSize: font.lg, fontWeight: "500", paddingHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  groupTile: {
    width: 200, borderRadius: radius.md, borderWidth: 1, overflow: "hidden",
  },
  groupTileImg: { width: "100%", height: 100 },
  achievement: {
    width: 130, borderRadius: radius.md, borderWidth: 1,
    padding: spacing.md, alignItems: "center",
  },
  achIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
});
