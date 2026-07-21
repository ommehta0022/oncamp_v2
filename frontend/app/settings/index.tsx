import React, { useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import SettingsRow from "@/src/components/SettingsRow";
import Avatar from "@/src/components/Avatar";
import Button from "@/src/components/Button";
import { useRole } from "@/src/context/RoleProvider";
import { clearSession } from "@/src/lib/api";

export default function Settings() {
  const { colors, mode } = useTheme();
  const { user } = useRole();
  const router = useRouter();
  const version = Constants.expoConfig?.version || "1.0.0";
  
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const logout = async () => {
    if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await clearSession();
    router.replace("/(auth)/welcome");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background || colors.surface }} edges={["top"]} testID="settings-screen">
      <Header title="Settings" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        
        <Pressable
          onPress={() => router.push("/settings/edit-profile")}
          onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start()}
          onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
        >
          <Animated.View style={[
            styles.profileCard, 
            { 
              backgroundColor: colors.surfaceSecondary || colors.surface, 
              borderColor: colors.border,
              transform: [{ scale: scaleAnim }],
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.05,
              shadowRadius: 10,
              elevation: 2,
            }
          ]}>
            <Avatar uri={user?.avatarUrl} name={user?.name || "You"} size={64} verified={user?.verified} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary || colors.onSurface, fontSize: 18, fontWeight: "700", letterSpacing: 0 }}>
                {user?.name || "Complete your profile"}
              </Text>
              <Text style={{ color: colors.textSecondary || colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 4, fontWeight: "500" }}>
                {user?.bio || user?.course || "Tap to view and edit profile"}
              </Text>
            </View>
            <View style={[styles.editIcon, { backgroundColor: colors.surfaceTertiary || "rgba(0,0,0,0.05)" }]}>
              <Ionicons name="pencil" size={16} color={colors.textSecondary || colors.onSurfaceTertiary} />
            </View>
          </Animated.View>
        </Pressable>

        <Section title="Account">
          <SettingsRow icon="person" title="Edit Profile" onPress={() => router.push("/settings/edit-profile")} />
          <Divider />
          <SettingsRow icon="lock-closed" title="Privacy & Safety" onPress={() => router.push("/settings/privacy")} />
          <Divider />
          <SettingsRow icon="shield-checkmark" title="Blocked Users" onPress={() => router.push("/settings/blocked")} />
        </Section>

        <Section title="Preferences">
          <SettingsRow
            icon="color-palette"
            title="Appearance"
            value={mode === "system" ? "Auto" : mode === "dark" ? "Dark" : "Light"}
            onPress={() => router.push("/settings/theme")}
          />
          <Divider />
          <SettingsRow icon="notifications" title="Notifications" onPress={() => router.push("/settings/notifications")} />
          <Divider />
          <SettingsRow icon="cloud-download" title="Storage & Data" onPress={() => router.push("/settings/storage")} />
          <Divider />
          <SettingsRow icon="language" title="Language" value="English" onPress={() => router.push("/settings/language")} />
        </Section>

        <Section title="Community">
          <SettingsRow icon="bookmark" title="Saved Posts" onPress={() => router.push("/saved")} />
          <Divider />
          <SettingsRow icon="time" title="Activity Log" onPress={() => router.push("/settings/activity")} />
        </Section>

        <Section title="Support">
          <SettingsRow icon="help-circle" title="Help Center" onPress={() => router.push("/settings/help")} />
          <Divider />
          <SettingsRow icon="document-text" title="Terms & Policies" onPress={() => router.push("/settings/about")} />
          <Divider />
          <SettingsRow icon="bug" title="Report a Problem" onPress={() => router.push("/settings/report")} />
        </Section>

        <View style={{ padding: spacing.xl, marginTop: spacing.lg }}>
          <Button 
            label="Log Out" 
            variant="outline" 
            onPress={logout}
            style={{ borderColor: colors.error || "#ef4444" }}
            textStyle={{ color: colors.error || "#ef4444" }}
            leftIcon={<Ionicons name="log-out-outline" size={20} color={colors.error || "#ef4444"} />}
            testID="logout-btn"
          />
          <Text style={{ color: colors.textSecondary || colors.muted, fontSize: 12, fontWeight: "600", textAlign: "center", marginTop: spacing.xl, letterSpacing: 0.5 }}>
            ONCAMPUS v{version}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={{ 
        color: colors.textSecondary || colors.onSurfaceTertiary, 
        fontSize: 12, 
        fontWeight: "700", 
        paddingHorizontal: spacing.xl, 
        marginTop: spacing.md, 
        marginBottom: spacing.sm, 
        textTransform: "uppercase", 
        letterSpacing: 1 
      }}>
        {title}
      </Text>
      <View style={[
        styles.section, 
        { 
          backgroundColor: colors.surfaceSecondary || colors.surface, 
        }
      ]}>
        {children}
      </View>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border || colors.divider, marginLeft: 56 }} />;
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    marginHorizontal: spacing.xl, marginTop: spacing.lg, marginBottom: spacing.sm,
    padding: spacing.md, borderRadius: radius.lg, borderWidth: 1,
  },
  editIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  section: {
    marginHorizontal: spacing.xl, borderRadius: radius.lg, overflow: "hidden",
  },
});
