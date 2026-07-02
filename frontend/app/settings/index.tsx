import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import SettingsRow from "@/src/components/SettingsRow";
import Avatar from "@/src/components/Avatar";
import { currentUser } from "@/src/data/mock";
import { useRole, ROLE_LABELS, Role } from "@/src/context/RoleProvider";
import { clearSession } from "@/src/lib/api";

export default function Settings() {
  const { colors, mode } = useTheme();
  const { role, setRole } = useRole();
  const router = useRouter();

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
          <Avatar uri={currentUser.avatar} name={currentUser.name} size={56} verified={currentUser.verified} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }}>{currentUser.name}</Text>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{currentUser.bio}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceTertiary} />
        </Pressable>

        <Section title="Account">
          <SettingsRow icon="person-outline" title="Edit profile" onPress={() => router.push("/settings/edit-profile")} />
          <Divider />
          <SettingsRow icon="lock-closed-outline" title="Privacy" onPress={() => router.push("/settings/privacy")} />
          <Divider />
          <SettingsRow icon="shield-checkmark-outline" title="Blocked users" onPress={() => router.push("/settings/blocked")} />
          <Divider />
          <SettingsRow icon="key-outline" title="Security" onPress={() => {}} />
        </Section>

        <Section title="Preferences">
          <SettingsRow
            icon="moon-outline"
            title="Theme"
            value={mode === "system" ? "System" : mode === "dark" ? "Dark" : "Light"}
            onPress={() => router.push("/settings/theme")}
          />
          <Divider />
          <SettingsRow icon="notifications-outline" title="Notifications" onPress={() => router.push("/settings/notifications")} />
          <Divider />
          <SettingsRow icon="language-outline" title="Language" value="English" onPress={() => router.push("/settings/language")} />
          <Divider />
          <SettingsRow icon="cloud-download-outline" title="Storage & data" onPress={() => router.push("/settings/storage")} />
        </Section>

        <Section title="Community">
          <SettingsRow icon="gift-outline" title="Invite friends" onPress={() => router.push("/settings/invite")} />
          <Divider />
          <SettingsRow icon="bookmark-outline" title="Saved posts" onPress={() => router.push("/saved")} />
          <Divider />
          <SettingsRow icon="help-circle-outline" title="Help & support" onPress={() => router.push("/settings/help")} />
          <Divider />
          <SettingsRow icon="information-circle-outline" title="About" onPress={() => router.push("/settings/about")} />
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
            OnCampus v1.0.0
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
