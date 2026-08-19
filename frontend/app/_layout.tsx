import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { useEffect, useState } from "react";
import { ActivityIndicator, LogBox, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { ThemeProvider, useTheme } from "@/src/theme/ThemeProvider";
import { RoleProvider } from "@/src/context/RoleProvider";
import { NotificationProvider } from "@/src/context/NotificationProvider";
import { PushNotificationProvider } from "@/src/context/PushNotificationProvider";
import { FeatureFlagsProvider } from "@/src/context/FeatureFlagsProvider";
import { ToastProvider } from "@/src/components/Toast";
import AppUpdateGate from "@/src/components/AppUpdateGate";
import { api } from "@/src/lib/api";

// Temporarily disabled per current QA requirement.
// import { SessionExpiredModal } from "@/src/components/SessionExpiredModal";

const STARTUP_BACKGROUND = "#2E5C4E";

LogBox.ignoreAllLogs(true);
void SystemUI.setBackgroundColorAsync(STARTUP_BACKGROUND).catch(() => undefined);
SplashScreen.preventAutoHideAsync();

function ThemedStack() {
  const { colors, isDark } = useTheme();
  const [platformSettings, setPlatformSettings] = useState<{
    appName?: string;
    maintenanceMode?: boolean;
    maintenanceMessage?: string;
  } | null>(null);
  const [checkingSettings, setCheckingSettings] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.platform
      .settings()
      .then((settings) => {
        if (mounted) setPlatformSettings(settings);
      })
      .catch(() => {
        if (mounted) setPlatformSettings(null);
      })
      .finally(() => {
        if (mounted) setCheckingSettings(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (checkingSettings) {
    return (
      <View style={{ flex: 1, width: "100%", alignItems: "center", justifyContent: "center", backgroundColor: STARTUP_BACKGROUND }}>
        <StatusBar hidden animated={false} />
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  if (platformSettings?.maintenanceMode) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, padding: 24, justifyContent: "center" }}>
        <StatusBar style={isDark ? "light" : "dark"} translucent backgroundColor="transparent" />
        <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "700", textAlign: "center" }}>
          {platformSettings.appName || "OnCampus"}
        </Text>
        <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "600", textAlign: "center", marginTop: 20 }}>
          Maintenance Mode
        </Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 10 }}>
          {platformSettings.maintenanceMessage || "System under maintenance. We'll be back soon!"}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, width: "100%", backgroundColor: colors.surface }}>
      <StatusBar style={isDark ? "light" : "dark"} translucent backgroundColor="transparent" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { flex: 1, backgroundColor: colors.surface },
          animation: "slide_from_right",
        }}
      />
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, width: "100%", backgroundColor: STARTUP_BACKGROUND }}>
      <SafeAreaProvider>
        <ActionSheetProvider>
          <ThemeProvider>
            <RoleProvider>
              <FeatureFlagsProvider>
                <NotificationProvider>
                  <PushNotificationProvider>
                    <ToastProvider>
                      <ThemedStack />
                      <AppUpdateGate />
                      {/* SessionExpiredModal temporarily disabled. */}
                    </ToastProvider>
                  </PushNotificationProvider>
                </NotificationProvider>
              </FeatureFlagsProvider>
            </RoleProvider>
          </ThemeProvider>
        </ActionSheetProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
