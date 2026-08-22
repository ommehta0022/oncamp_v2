import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, View } from "react-native";
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

  const icon = (outline: any, filled: any, color: string, focused: boolean, size = 25) => (
    <View style={focused ? styles.activeIcon : undefined}>
      <Ionicons name={focused ? filled : outline} size={focused ? size - 2 : size} color={focused ? "#FFFFFF" : color} />
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.onSurfaceTertiary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginTop: 0 },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.OS === "ios" ? "transparent" : colors.surfaceSecondary,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === "ios" ? 88 : 72,
          paddingBottom: Platform.OS === "ios" ? 24 : 9,
          paddingTop: 7,
          shadowColor: "#0B1947",
          shadowOpacity: 0.06,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: -4 },
          elevation: 10,
        },
        tabBarBackground: () => Platform.OS === "ios" ? <BlurView intensity={95} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : null,
      }}
    >
      <Tabs.Screen name="feed" options={{ title: t("nav.feed"), tabBarIcon: ({ color, focused }) => icon("home-outline", "home", color, focused) }} />
      <Tabs.Screen name="groups" options={{ title: t("nav.groups"), tabBarIcon: ({ color, focused }) => icon("people-outline", "people", color, focused, 26), tabBarBadge: groupsUnread > 0 ? groupsUnread : undefined, tabBarBadgeStyle: { backgroundColor: "#E6465B", color: "#fff", fontSize: 10, fontWeight: "700" } }} />
      <Tabs.Screen name="discover" options={{ title: "Discover", tabBarIcon: ({ color, focused }) => icon("compass-outline", "compass", color, focused, 26) }} />
      <Tabs.Screen name="notifications" options={{ title: t("nav.alerts"), tabBarIcon: ({ color, focused }) => icon("notifications-outline", "notifications", color, focused), tabBarBadge: notificationsUnread > 0 ? notificationsUnread : undefined, tabBarBadgeStyle: { backgroundColor: "#E6465B", color: "#fff", fontSize: 10, fontWeight: "700" } }} />
      <Tabs.Screen name="profile" options={{ title: canManageInstitution ? t("nav.dashboard") : t("nav.profile"), tabBarIcon: ({ color, focused }) => canManageInstitution ? icon("business-outline", "business", color, focused) : icon("person-circle-outline", "person-circle", color, focused) }} />
      <Tabs.Screen name="profile/my-requests" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#1267F4", alignItems: "center", justifyContent: "center", marginTop: -2 },
});
