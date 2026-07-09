import React, { useCallback, useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import EmptyState from "@/src/components/EmptyState";
import Button from "@/src/components/Button";
import Card from "@/src/components/Card";
import Badge from "@/src/components/Badge";
import SkeletonLoader from "@/src/components/SkeletonLoader";
import { useRole } from "@/src/context/RoleProvider";
import { api, GroupDto } from "@/src/lib/api";
import { typography } from "@/src/theme/typography";

export default function Profile() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, refreshUser } = useRole();
  const [myGroups, setMyGroups] = useState<GroupDto[]>([]);
  const [stats, setStats] = useState({ groups: 0, posts: 0, followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);

  // Animations
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [0, -50],
    extrapolate: "clamp",
  });

  const load = useCallback(async () => {
    setLoading(true);
    await refreshUser().catch(() => {});
    
    try {
      const [groupsData, statsData] = await Promise.all([
        api.groups.listMine().catch(() => []),
        api.users.stats().catch(() => ({ groups: 0, posts: 0, followers: 0, following: 0 }))
      ]);
      setMyGroups(groupsData);
      setStats(statsData);
    } catch {
      setMyGroups([]);
      setStats({ groups: 0, posts: 0, followers: 0, following: 0 });
    } finally {
      setLoading(false);
    }
  }, [refreshUser]);

  useEffect(() => {
    load();
  }, [load]);

  const displayName = user?.name || "Complete your profile";
  const handle = user?.handle ? `@${user.handle}` : user?.city || "Complete your profile";
  const bio = user?.bio || user?.course || "Add your course, bio, and campus details.";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background || colors.surface }} testID="profile-screen">
      <Animated.ScrollView 
        contentContainerStyle={{ paddingBottom: 120 }} 
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        <Animated.View style={{ position: "relative", transform: [{ translateY: headerTranslateY }] }}>
          {user?.avatarUrl ? (
            <Image 
              source={{ uri: user.avatarUrl }} 
              style={[styles.cover, { opacity: 0.8 }]} 
              contentFit="cover" 
              blurRadius={10} 
            />
          ) : (
            <LinearGradient 
              colors={[colors.brandPrimary || "#2E5C4E", colors.brandTertiary || "#1a362d"]} 
              style={styles.cover} 
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          )}
          <LinearGradient 
            colors={["rgba(0,0,0,0.3)", colors.background || colors.surface]} 
            locations={[0, 1]}
            style={styles.coverScrim} 
          />
          <SafeAreaView edges={["top"]} style={styles.topBar}>
            <View />
            <Pressable
              onPress={() => {
                if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/settings");
              }}
              style={({ pressed }) => [
                styles.iconBtn, 
                { backgroundColor: "rgba(0,0,0,0.3)", opacity: pressed ? 0.7 : 1 }
              ]}
              testID="profile-settings-btn"
            >
              <Ionicons name="settings-outline" size={22} color="#fff" />
            </Pressable>
          </SafeAreaView>
        </Animated.View>

        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Avatar uri={user?.avatarUrl} name={displayName} size={110} verified={user?.verified} />
            <View style={[styles.avatarBorder, { borderColor: colors.background || colors.surface }]} />
          </View>
          
          <View style={styles.actionRow}>
            <Button
              label="Edit Profile"
              variant="outline"
              size="sm"
              onPress={() => router.push("/settings/edit-profile")}
              testID="edit-profile-btn"
            />
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={[styles.name, { color: colors.textPrimary || colors.onSurface }]}>
              {displayName}
            </Text>
            {user?.verified && (
              <Badge label="VERIFIED" variant="brand" size="sm" />
            )}
          </View>
          <Text style={{ color: colors.textSecondary || colors.onSurfaceTertiary, fontSize: font.base, marginTop: 4, fontWeight: "500" }}>
            {handle}
          </Text>
          <Text style={{ color: colors.textPrimary || colors.onSurface, marginTop: spacing.md, ...typography.body }}>
            {bio}
          </Text>

          <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.lg, flexWrap: "wrap" }}>
            {!!user?.course && <MetaRow icon="school" text={user.course} />}
            {!!user?.city && <MetaRow icon="location" text={user.city} />}
          </View>

          {loading ? (
            <View style={{ marginTop: spacing.xl }}>
              <SkeletonLoader type="card" />
            </View>
          ) : (
            <Card padding={spacing.md} style={styles.statsCard}>
              <View style={styles.statsRow}>
                <Stat label="Groups" value={String(stats.groups || myGroups.length)} />
                <View style={[styles.statDiv, { backgroundColor: colors.border || colors.borderStrong }]} />
                <Stat label="Posts" value={String(stats.posts)} />
                <View style={[styles.statDiv, { backgroundColor: colors.border || colors.borderStrong }]} />
                <Pressable 
                  onPress={() => user?.id && router.push({ pathname: "/user/connections", params: { id: user.id, type: "followers" } })} 
                  style={{ flex: 1 }}
                >
                  <Stat label="Followers" value={String(stats.followers)} />
                </Pressable>
                <View style={[styles.statDiv, { backgroundColor: colors.border || colors.borderStrong }]} />
                <Pressable 
                  onPress={() => user?.id && router.push({ pathname: "/user/connections", params: { id: user.id, type: "following" } })} 
                  style={{ flex: 1 }}
                >
                  <Stat label="Following" value={String(stats.following)} />
                </Pressable>
              </View>
            </Card>
          )}
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <View style={styles.sectionHeader}>
            <Text style={{ color: colors.textPrimary || colors.onSurface, ...typography.h3 }}>Your Groups</Text>
            <Pressable 
              onPress={() => router.push("/(tabs)/groups")}
              hitSlop={15}
            >
              <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "600" }}>See all</Text>
            </Pressable>
          </View>
          
          {loading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
              {[1, 2].map(i => (
                <View key={i} style={{ width: 220, height: 160 }}>
                  <SkeletonLoader type="card" />
                </View>
              ))}
            </ScrollView>
          ) : myGroups.length === 0 ? (
            <View style={{ minHeight: 180 }}>
              <EmptyState icon="people-outline" title="No groups yet" message="Your joined groups will show here." />
            </View>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: spacing.lg }}
              decelerationRate="fast"
              snapToInterval={220 + spacing.md}
            >
              {myGroups.map((g) => (
                <GroupTile key={g.id} group={g} onPress={() => router.push(`/group/${g.id}`)} />
              ))}
            </ScrollView>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function MetaRow({ icon, text }: { icon: any; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.metaBadge}>
      <Ionicons name={icon} size={14} color={colors.textSecondary || colors.onSurfaceTertiary} />
      <Text style={{ color: colors.textSecondary || colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "500" }}>{text}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ color: colors.textPrimary || colors.onSurface, fontSize: 22, fontWeight: "700" }}>{value}</Text>
      <Text style={{ color: colors.textSecondary || colors.onSurfaceTertiary, fontSize: 10, marginTop: 4, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Text>
    </View>
  );
}

function GroupTile({ group, onPress }: { group: GroupDto, onPress: () => void }) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
    >
      <Animated.View style={[styles.groupTile, { transform: [{ scale: scaleAnim }] }]}>
        <Card padding={0} style={{ width: 220, overflow: "hidden" }}>
          {group.avatarUrl ? (
            <Image source={{ uri: group.avatarUrl }} style={styles.groupTileImg} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.groupTileImg, { backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }]}>
              <Ionicons name="people" size={32} color={colors.onSurfaceTertiary} />
            </View>
          )}
          <View style={{ padding: spacing.md }}>
            <Text style={{ color: colors.textPrimary || colors.onSurface, fontSize: font.base, fontWeight: "700" }} numberOfLines={1}>
              {group.name}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
              <Ionicons name="people" size={12} color={colors.textSecondary || colors.onSurfaceTertiary} />
              <Text style={{ color: colors.textSecondary || colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "500" }}>
                {(group.memberCount || 0).toLocaleString()} members
              </Text>
            </View>
          </View>
        </Card>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cover: { width: "100%", height: 180 },
  coverScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 180 },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", justifyContent: "space-between",
    padding: spacing.md,
    zIndex: 10,
  },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)" },
  profileHeader: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    marginTop: -55,
  },
  avatarContainer: {
    position: "relative",
  },
  avatarBorder: {
    position: "absolute",
    top: -4, left: -4, right: -4, bottom: -4,
    borderWidth: 4,
    borderRadius: 100,
    zIndex: -1,
  },
  actionRow: {
    marginBottom: spacing.sm,
  },
  name: { 
    ...typography.h2,
    fontSize: 26, 
    letterSpacing: -0.5 
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: "rgba(128,128,128,0.1)",
    borderRadius: radius.pill,
  },
  statsCard: {
    marginTop: spacing.xl,
    borderRadius: radius.lg,
  },
  statsRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: spacing.xs,
  },
  statDiv: { width: 1, height: 30, opacity: 0.5 },
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.xl, marginBottom: spacing.md,
  },
  groupTile: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  groupTileImg: { width: "100%", height: 110 },
});
