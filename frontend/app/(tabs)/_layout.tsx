import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useTabBadges } from "@/src/hooks/useTabBadges";
import { useRole } from "@/src/context/RoleProvider";
import { useLanguage } from "@/src/context/LanguageProvider";

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const { groupsUnread, notificationsUnread } = useTabBadges();
  const { canManageInstitution } = useRole();
  const { t } = useLanguage();

  const icon = (outline: any, filled: any, color: string, focused: boolean, size = 24) => (
    <Ionicons name={focused ? filled : outline} size={size} color={color} />
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.onSurfaceTertiary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginTop: -1 },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.OS === "ios" ? "transparent" : colors.surfaceSecondary,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === "ios" ? 84 : 68,
          paddingBottom: Platform.OS === "ios" ? 24 : 9,
          paddingTop: 7,
          shadowColor: colors.shadow,
          shadowOpacity: isDark ? 0.18 : 0.05,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -3 },
          elevation: 8,
        },
        tabBarBackground: () => Platform.OS === "ios" ? (
          <BlurView intensity={88} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        ) : null,
      }}
    >
      <Tabs.Screen name="feed" options={{ title: t("nav.feed"), tabBarIcon: ({ color, focused }) => icon("home-outline", "home", color, focused) }} />
      <Tabs.Screen name="groups" options={{
        title: t("nav.groups"),
        tabBarIcon: ({ color, focused }) => icon("people-outline", "people", color, focused, 25),
        tabBarBadge: groupsUnread > 0 ? groupsUnread : undefined,
        tabBarBadgeStyle: { backgroundColor: colors.brandSecondary, color: colors.onBrandSecondary, fontSize: 10, fontWeight: "700" },
      }} />
      <Tabs.Screen name="discover" options={{ title: "Discover", tabBarIcon: ({ color, focused }) => icon("compass-outline", "compass", color, focused, 25) }} />
      <Tabs.Screen name="notifications" options={{
        title: t("nav.alerts"),
        tabBarIcon: ({ color, focused }) => icon("notifications-outline", "notifications", color, focused),
        tabBarBadge: notificationsUnread > 0 ? notificationsUnread : undefined,
        tabBarBadgeStyle: { backgroundColor: colors.brandSecondary, color: colors.onBrandSecondary, fontSize: 10, fontWeight: "700" },
      }} />
      <Tabs.Screen name="profile" options={{
        title: canManageInstitution ? t("nav.dashboard") : t("nav.profile"),
        tabBarIcon: ({ color, focused }) => canManageInstitution
          ? icon("business-outline", "business", color, focused)
          : icon("person-outline", "person", color, focused),
      }} />
      <Tabs.Screen name="profile/my-requests" options={{ href: null }} />
    </Tabs>
  );
}
