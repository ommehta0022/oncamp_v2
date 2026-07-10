import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import EmptyState from "@/src/components/EmptyState";
import ReportModal from "@/src/components/ReportModal";
import PostCard from "@/src/components/PostCard";
import { useRole } from "@/src/context/RoleProvider";
import { api, SessionUser, FeedPostDto } from "@/src/lib/api";

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const { user: me } = useRole();
  
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [followers, setFollowers] = useState<SessionUser[]>([]);
  const [following, setFollowing] = useState<SessionUser[]>([]);
  const [posts, setPosts] = useState<FeedPostDto[]>([]);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadUser = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [u, fers, fing, userPosts] = await Promise.all([
        api.users.get(id),
        api.users.followers(id).catch(() => []),
        api.users.following(id).catch(() => []),
        api.users.posts(id).catch(() => []),
      ]);
      setUser(u);
      setFollowers(fers || []);
      setFollowing(fing || []);
      setPosts(userPosts || []);
      
      if (me?.id) {
        setIsFollowing((fers || []).some(f => f.id === me.id));
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not load profile.");
    } finally {
      setLoading(false);
    }
  }, [id, me?.id]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const toggleFollow = async () => {
    if (!id || actionLoading) return;
    try {
      setActionLoading(true);
      if (isFollowing) {
        await api.users.unfollow(id);
        setIsFollowing(false);
        setFollowers(prev => prev.filter(f => f.id !== me?.id));
      } else {
        await api.users.follow(id);
        setIsFollowing(true);
        if (me) setFollowers(prev => [...prev, me]);
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to update follow status.");
    } finally {
      setActionLoading(false);
    }
  };
  
  const shareProfile = async () => {
    if (!user) return;
    try {
      await Share.share({
        title: user.name,
        message: `Check out ${user.name}'s profile on OnCampus! https://oncampus.app/user/${user.id}`,
      });
    } catch (error) {}
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="arrow-back" size={20} color={colors.onSurface} />
          </Pressable>
        </View>
        <EmptyState icon="person-outline" title="User not found" message="This profile might have been deleted or doesn't exist." />
      </SafeAreaView>
    );
  }

  const displayName = user.name || "Unknown User";
  const handle = user.handle ? `@${user.handle}` : user.city || "No handle";
  const bio = user.bio || user.course || "No bio available.";

  const isMe = me?.id === user.id;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="user-profile-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={{ position: "relative" }}>
          <View style={[styles.cover, { backgroundColor: colors.brandPrimary }]} />
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={styles.coverScrim} />
          <View style={styles.topBar}>
            <Pressable
              onPress={() => router.back()}
              style={[styles.iconBtn, { backgroundColor: "#00000055" }]}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </Pressable>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable onPress={shareProfile} style={[styles.iconBtn, { backgroundColor: "#00000055" }]}>
                <Ionicons name="share-outline" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.profileHeader}>
          <View style={{ marginTop: -50, alignSelf: "flex-start" }}>
            <Avatar uri={user.avatarUrl} name={displayName} size={100} verified={user.verified} />
          </View>
          <View style={{ flex: 1, marginTop: spacing.md, flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
            {!isMe && (
              <Pressable
                onPress={toggleFollow}
                disabled={actionLoading}
                style={[
                  styles.outlineBtn,
                  isFollowing ? { borderColor: colors.borderStrong } : { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }
                ]}
                testID="follow-btn"
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={isFollowing ? colors.onSurface : "#fff"} />
                ) : (
                  <Text style={{ color: isFollowing ? colors.onSurface : "#fff", fontSize: font.base, fontWeight: "500" }}>
                    {isFollowing ? "Following" : "Follow"}
                  </Text>
                )}
              </Pressable>
            )}
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "500", letterSpacing: -0.5 }}>
              {displayName}
            </Text>
            {user.verified && (
              <View style={[styles.badgeChip, { backgroundColor: colors.brandTertiary }]}>
                <Text style={{ color: colors.onBrandTertiary, fontSize: 10, fontWeight: "500" }}>VERIFIED</Text>
              </View>
            )}
          </View>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base, marginTop: 2 }}>
            {handle}
          </Text>
          <Text style={{ color: colors.onSurface, fontSize: font.base, marginTop: spacing.md, lineHeight: 22 }}>
            {bio}
          </Text>

          <View style={{ flexDirection: "row", gap: spacing.lg, marginTop: spacing.md, flexWrap: "wrap" }}>
            {!!user.course && <MetaRow icon="school-outline" text={user.course} />}
            {!!user.city && <MetaRow icon="location-outline" text={user.city} />}
          </View>

          <View style={styles.statsRow}>
            <Pressable onPress={() => router.push({ pathname: "/user/connections", params: { id, type: "followers" } })} style={{ flex: 1 }}>
              <Stat label="Followers" value={String(followers.length)} />
            </Pressable>
            <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
            <Pressable onPress={() => router.push({ pathname: "/user/connections", params: { id, type: "following" } })} style={{ flex: 1 }}>
              <Stat label="Following" value={String(following.length)} />
            </Pressable>
          </View>
        </View>
        
        <View style={{ marginTop: spacing.xl, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
          <View style={styles.sectionHeader}>
            <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }}>Recent Activity</Text>
          </View>
          {posts.length > 0 ? (
            <View style={{ gap: spacing.md }}>
              {posts.map(post => (
                <PostCard key={post.id} post={post} />
              ))}
            </View>
          ) : (
            <EmptyState icon="time-outline" title="No activity yet" message={`${displayName} hasn't posted anything recently.`} />
          )}
        </View>

        {!isMe && (
          <Pressable style={{ padding: spacing.xl, alignItems: "center" }} onPress={() => setReportModalVisible(true)}>
            <Text style={{ color: colors.danger, fontSize: font.base, fontWeight: "500" }}>Report User</Text>
          </Pressable>
        )}

      </ScrollView>

      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        onSubmit={async (reason, details) => {
          if (id) await api.reports.reportUser(id, { reason, details });
        }}
        title="Report User"
      />
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
    zIndex: 10,
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
  badgeChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 4 },
  statsRow: {
    flexDirection: "row", alignItems: "center",
    marginTop: spacing.xl, paddingVertical: spacing.md,
  },
  statDiv: { width: 1, height: 30 },
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: spacing.md,
  },
});
