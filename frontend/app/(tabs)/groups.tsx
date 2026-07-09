import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, Animated, Platform } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import EmptyState from "@/src/components/EmptyState";
import SearchBar from "@/src/components/SearchBar";
import Chip from "@/src/components/Chip";
import Card from "@/src/components/Card";
import Badge from "@/src/components/Badge";
import SkeletonLoader from "@/src/components/SkeletonLoader";
import { useRole } from "@/src/context/RoleProvider";
import { api, GroupDto } from "@/src/lib/api";
import { cache } from "@/src/lib/cache";
import { typography } from "@/src/theme/typography";

const FILTERS = ["All", "Unread", "Announcements", "Muted"];

type RowItem =
  | { type: "section"; id: string; label: string; count: number }
  | { type: "group"; id: string; group: Group };

type Group = {
  id: string;
  name: string;
  description: string;
  image?: string;
  institution: string;
  city: string;
  category: string;
  visibility: "public" | "private";
  members: number;
  unread?: number;
  lastMessage?: string;
  lastMessageAt?: string;
  pinned?: boolean;
  muted?: boolean;
  verified?: boolean;
  role?: "owner" | "admin" | "moderator" | "member";
};

export default function Groups() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { canCreateGroups } = useRole();
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Group[]>([]);

  // FAB animation
  const scrollY = useRef(new Animated.Value(0)).current;
  const fabTranslateY = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 100],
    extrapolate: "clamp",
  });

  const loadGroups = useCallback(async () => {
    try {
      const cached = await cache.get<Group[]>("my_groups");
      if (cached && items.length === 0) setItems(cached);
      
      const response = await api.groups.listMine();
      const mapped = response.map(toGroup);
      setItems(mapped);
      await cache.set("my_groups", mapped);
    } catch {
      if (items.length === 0) {
        const cached = await cache.get<Group[]>("my_groups");
        if (cached) setItems(cached);
        else setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, [items.length]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadGroups().finally(() => setRefreshing(false));
  }, [loadGroups]);

  const filtered = useMemo(() => {
    let list = items;
    if (filter === "Unread") list = list.filter((g) => (g.unread || 0) > 0);
    else if (filter === "Announcements") list = list.filter((g) => g.category === "Official");
    else if (filter === "Muted") list = list.filter((g) => g.muted);
    if (query) list = list.filter((g) => g.name.toLowerCase().includes(query.toLowerCase()) || g.institution.toLowerCase().includes(query.toLowerCase()));
    return list;
  }, [filter, items, query]);

  const pinned = filtered.filter((g) => g.pinned);
  const others = filtered.filter((g) => !g.pinned);
  const totalUnread = items.reduce((s, g) => s + (g.unread || 0), 0);

  const data: RowItem[] = [];
  if (pinned.length > 0) {
    data.push({ type: "section", id: "s-pinned", label: "Pinned", count: pinned.length });
    pinned.forEach((g) => data.push({ type: "group", id: g.id, group: g }));
  }
  if (others.length > 0) {
    data.push({ type: "section", id: "s-all", label: filter === "All" ? "All Groups" : filter, count: others.length });
    others.forEach((g) => data.push({ type: "group", id: g.id, group: g }));
  }

  const renderSkeletons = () => (
    <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
      {[1, 2, 3, 4, 5].map(i => (
        <View key={i} style={{ marginBottom: spacing.sm }}>
          <SkeletonLoader type="groupRow" />
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background || colors.surface }} edges={["top"]} testID="groups-screen">
      <View style={[styles.header, { backgroundColor: colors.background || colors.surface }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.textPrimary || colors.onSurface }]}>Groups</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
            <View style={[styles.livedot, { backgroundColor: totalUnread > 0 ? colors.brandSecondary : (colors.textSecondary || colors.muted) }]} />
            <Text style={{ color: colors.textSecondary || colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "500" }}>
              {items.length} joined • {totalUnread} unread
            </Text>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.background || colors.surface }}>
        <SearchBar 
          value={query} 
          onChangeText={setQuery} 
          placeholder="Search your groups..." 
        />
      </View>

      <View style={{ height: 44, marginBottom: spacing.xs }}>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(f) => f}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" }}
          renderItem={({ item }) => {
            const active = filter === item;
            const unreadCount = item === "Unread" ? totalUnread : 0;
            return (
              <Chip 
                label={item + (unreadCount > 0 ? ` (${unreadCount})` : "")} 
                selected={active}
                onPress={() => {
                  setFilter(item);
                  if (Platform.OS === 'ios') Haptics.selectionAsync();
                }}
                size="sm"
              />
            );
          }}
        />
      </View>

      {loading ? (
        renderSkeletons()
      ) : (
        <Animated.FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120, paddingTop: spacing.xs }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brandPrimary}
              colors={[colors.brandPrimary]}
            />
          }
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            if (item.type === "section") {
              return (
                <View style={styles.sectionHead}>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary || colors.onSurfaceTertiary }]}>
                    {item.label.toUpperCase()}
                  </Text>
                  <Text style={{ color: colors.textSecondary || colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "600" }}>{item.count}</Text>
                </View>
              );
            }
            return <GroupRow group={item.group} onPress={() => router.push(`/group/${item.group.id}`)} />;
          }}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title={items.length === 0 ? "No joined groups yet" : "No groups match this filter"}
              message={items.length === 0 ? "Join a real campus group from Discover to start chatting." : undefined}
              actionLabel={items.length === 0 ? "Discover Groups" : undefined}
              onAction={items.length === 0 ? () => router.push("/(tabs)/discover") : undefined}
            />
          }
        />
      )}

      {canCreateGroups && (
        <Animated.View style={[styles.fabContainer, { transform: [{ translateY: fabTranslateY }] }]}>
          <Pressable
            onPress={() => {
              if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/create-group");
            }}
            testID="new-group-fab"
          >
            <LinearGradient
              colors={[colors.gradientStart || colors.brandPrimary, colors.gradientEnd || colors.brandTertiary]}
              style={styles.fab}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="add" size={32} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

function toGroup(group: GroupDto): Group {
  const institution =
    typeof group.institution === "string"
      ? group.institution
      : group.institution?.name || group.city || "OnCampus";

  return {
    id: group.id,
    name: group.name,
    description: group.description || "",
    image: group.avatarUrl || group.image,
    institution,
    city: group.city || "",
    category: group.category,
    visibility: group.visibility,
    members: group.memberCount || 0,
    unread: group.unread || 0,
    lastMessage: group.lastMessage || group.description || "",
    lastMessageAt: group.lastMessageAt || "",
    verified: group.official,
    role: group.role === "owner" || group.role === "admin" || group.role === "member" ? group.role : "member",
  };
}

function GroupRow({ group, onPress }: { group: Group; onPress: () => void }) {
  const { colors } = useTheme();
  const hasUnread = (group.unread || 0) > 0;

  // Parse sender + message
  const lastMsg = group.lastMessage || group.description;
  const senderMatch = lastMsg.match(/^([^:]+):\s(.*)$/);
  const sender = senderMatch?.[1];
  const msgBody = senderMatch?.[2] || lastMsg;

  const categoryColors: Record<string, string> = {
    Batch: colors.info || "#3b82f6",
    Clubs: colors.brandPrimary,
    Official: colors.brandSecondary,
    Events: colors.warning || "#f59e0b",
    Study: "#B85E9F",
    Sports: colors.success || "#10b981",
    Tech: colors.info || "#3b82f6",
    Arts: colors.brandSecondary,
    Career: colors.brandPrimary,
  };
  const catColor = categoryColors[group.category] || (colors.textSecondary || colors.muted);

  return (
    <Card 
      padding={spacing.sm} 
      style={{ 
        marginBottom: spacing.sm, 
        borderRadius: radius.md,
        overflow: "hidden",
        borderWidth: hasUnread ? 1.5 : 1,
        borderColor: hasUnread ? (catColor + "40") : (colors.border || colors.borderStrong)
      }}
      onPress={onPress}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {/* Left accent bar shows unread + category color */}
        {hasUnread && <View style={[styles.leftBar, { backgroundColor: catColor }]} />}

        <View style={{ paddingLeft: hasUnread ? spacing.xs : 0 }}>
          <Avatar uri={group.image} name={group.name} size={52} verified={group.verified} />
        </View>

        <View style={{ flex: 1, marginLeft: spacing.md, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {group.pinned && <Ionicons name="pin" size={12} color={colors.brandPrimary} />}
            <Text
              style={{
                color: colors.textPrimary || colors.onSurface,
                fontSize: font.lg,
                fontWeight: hasUnread ? "700" : "500",
                flex: 1,
                letterSpacing: -0.2,
              }}
              numberOfLines={1}
            >
              {group.name}
            </Text>
            {!!group.lastMessageAt && (
              <Text
                style={{
                  color: hasUnread ? catColor : (colors.textSecondary || colors.onSurfaceTertiary),
                  fontSize: font.sm,
                  fontWeight: hasUnread ? "600" : "400",
                }}
              >
                {group.lastMessageAt}
              </Text>
            )}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Badge 
              label={group.category.toUpperCase()}
              size="sm"
              style={{ backgroundColor: catColor + "20" }}
              textStyle={{ color: catColor }}
            />
            <Text style={{ color: (colors.textSecondary || colors.onSurfaceTertiary), fontSize: font.sm, flex: 1 }} numberOfLines={1}>
              {sender && (
                <Text style={{ color: (colors.textPrimary || colors.onSurface), fontWeight: "600" }}>{sender}: </Text>
              )}
              {msgBody}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Ionicons name="people" size={12} color={colors.textSecondary || colors.muted} />
              <Text style={{ color: colors.textSecondary || colors.muted, fontSize: 11, fontWeight: "500" }}>
                {group.members.toLocaleString()}
              </Text>
            </View>
            
            {group.role && group.role !== "member" && (
              <Badge 
                label={group.role.toUpperCase()}
                size="sm"
                variant="brand"
                style={{ paddingHorizontal: 4, paddingVertical: 1, height: 16 }}
                textStyle={{ fontSize: 8 }}
              />
            )}
            
            {group.muted && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Ionicons name="volume-mute" size={12} color={colors.textSecondary || colors.muted} />
              </View>
            )}
            
            <View style={{ flex: 1 }} />
            
            {hasUnread && (
              <Badge 
                label={(group.unread || 0) > 99 ? "99+" : String(group.unread)} 
                variant="error" 
                style={{ backgroundColor: catColor }}
              />
            )}
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md,
  },
  title: { 
    ...typography.h2,
    fontSize: 28, 
    letterSpacing: -0.5 
  },
  livedot: { width: 8, height: 8, borderRadius: 4 },
  
  sectionHead: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: spacing.md, marginBottom: spacing.sm, paddingHorizontal: 2,
  },
  sectionLabel: {
    fontSize: 12, fontWeight: "700", letterSpacing: 0.8,
  },

  leftBar: {
    position: "absolute", left: -spacing.sm, top: -spacing.sm, bottom: -spacing.sm, width: 4,
  },

  fabContainer: {
    position: "absolute", right: spacing.xl, bottom: spacing.xl,
    zIndex: 10,
  },
  fab: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
});
