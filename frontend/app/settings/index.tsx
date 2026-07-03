import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import SettingsRow from "@/src/components/SettingsRow";
import Avatar from "@/src/components/Avatar";
import { useRole, ROLE_LABELS, Role } from "@/src/context/RoleProvider";
import { clearSession } from "@/src/lib/api";

export default function Settings() {
  const { colors, mode } = useTheme();
  const { role, setRole, user } = useRole();
  const router = useRouter();
  const version = Constants.expoConfig?.version || "1.0.0";

  const logout = async () => {
    await clearSession();
    router.replace("/(auth)/welcome");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="settings-screen">
      <Header title="Settings" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <Pressable
          onPress={() => router.push("/settings/edit-profile")}
          style={[styles.profileCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
        >
          <Avatar uri={user?.avatarUrl} name={user?.name || "You"} size={56} verified={user?.verified} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }}>{user?.name || "Complete your profile"}</Text>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>
              {user?.bio || user?.course || "Complete your profile"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceTertiary} />
        </Pressable>

        <Section title="Account">
          <SettingsRow icon="person-outline" title="Edit profile" onPress={() => router.push("/settings/edit-profile")} />
          <Divider />
          <SettingsRow icon="lock-closed-outline" title="Privacy & safety" onPress={() => router.push("/settings/privacy")} />
          <Divider />
          <SettingsRow icon="shield-checkmark-outline" title="Blocked users" onPress={() => router.push("/settings/blocked")} />
          <Divider />
          <SettingsRow 
            icon="person-add-outline" 
            title="Account type" 
            value={role === "institution_admin" ? "Institution Admin" : "User"}
            disabled 
          />
        </Section>

        <Section title="Preferences">
          <SettingsRow
            icon="moon-outline"
            title="Appearance"
            value={mode === "system" ? "Auto" : mode === "dark" ? "Dark" : "Light"}
            onPress={() => router.push("/settings/theme")}
          />
          <Divider />
          <SettingsRow icon="notifications-outline" title="Notifications" onPress={() => router.push("/settings/notifications")} />
          <Divider />
          <SettingsRow icon="cloud-download-outline" title="Storage & data" onPress={() => router.push("/settings/storage")} />
          <Divider />
          <SettingsRow icon="language-outline" title="Language" value="English" onPress={() => router.push("/settings/language")} />
        </Section>

        <Section title="Community">
          <SettingsRow icon="bookmark-outline" title="Saved posts" onPress={() => router.push("/saved")} />
          <Divider />
          <SettingsRow icon="time-outline" title="Activity log" onPress={() => router.push("/settings/activity")} />
          <Divider />
          <SettingsRow icon="download-outline" title="Download your data" onPress={() => router.push("/settings/data-export")} />
        </Section>

        <Section title="Support">
          <SettingsRow icon="help-circle-outline" title="Help center" onPress={() => router.push("/settings/help")} />
          <Divider />
          <SettingsRow icon="document-text-outline" title="Terms & policies" onPress={() => router.push("/settings/about")} />
          <Divider />
          <SettingsRow icon="bug-outline" title="Report a problem" onPress={() => router.push("/settings/report")} />
        </Section>

        {__DEV__ && (
          <Section title="Developer preview">
            <View style={{ padding: spacing.md }}>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, lineHeight: 18, marginBottom: spacing.md }}>
                Local preview only. Production roles are assigned server-side after verification.
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setRole(r)}
                    style={{
                      paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill,
                      borderWidth: 1,
                      backgroundColor: role === r ? colors.brandPrimary : "transparent",
                      borderColor: role === r ? colors.brandPrimary : colors.borderStrong,
                      alignItems: "center", justifyContent: "center",
                    }}
                    testID={`role-${r}`}
                  >
                    <Text style={{ color: role === r ? colors.onBrandPrimary : colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>
                      {ROLE_LABELS[r]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {role === "institution_admin" && (
                <Pressable
                  onPress={() => router.push("/institution/dashboard")}
                  style={{
                    marginTop: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                    backgroundColor: colors.brandTertiary, height: 40, borderRadius: radius.pill,
                  }}
                  testID="open-institution-dashboard-btn"
                >
                  <Ionicons name="business" size={16} color={colors.onBrandTertiary} />
                  <Text style={{ color: colors.onBrandTertiary, fontSize: font.sm, fontWeight: "500" }}>Open institution dashboard</Text>
                </Pressable>
              )}
            </View>
          </Section>
        )}

        <View style={{ padding: spacing.lg }}>
          <Pressable
            onPress={logout}
            style={[styles.logout, { borderColor: colors.error }]}
            testID="logout-btn"
          >
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <Text style={{ color: colors.error, fontSize: font.base, fontWeight: "500" }}>Log out</Text>
          </Pressable>
          <Text style={{ color: colors.muted, fontSize: font.sm, textAlign: "center", marginTop: spacing.lg }}>
            OnCampus v{version}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "500", paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {title}
      </Text>
      <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 68 }} />;
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    marginHorizontal: spacing.lg, marginTop: spacing.lg,
    padding: spacing.md, borderRadius: radius.md, borderWidth: 1,
  },
  section: {
    marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, overflow: "hidden",
  },
  logout: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    height: 48, borderRadius: radius.pill, borderWidth: 1,
  },
});
