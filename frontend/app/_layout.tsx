import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { useEffect, useState } from "react";
import { LogBox, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { ThemeProvider, useTheme } from "@/src/theme/ThemeProvider";
import { AccessibilityProvider } from "@/src/context/AccessibilityProvider";
import { RoleProvider } from "@/src/context/RoleProvider";
import { LanguageProvider } from "@/src/context/LanguageProvider";
import { NotificationProvider } from "@/src/context/NotificationProvider";
import { PushNotificationProvider } from "@/src/context/PushNotificationProvider";
import { FeatureFlagsProvider } from "@/src/context/FeatureFlagsProvider";
import { PinnedContentProvider } from "@/src/context/PinnedContentProvider";
import { ToastProvider } from "@/src/components/Toast";
import AppErrorBoundary from "@/src/components/AppErrorBoundary";
import OptionalFeatureBoundary from "@/src/components/OptionalFeatureBoundary";
import AppUpdateGate from "@/src/components/AppUpdateGate";
import BackgroundOtaCoordinator from "@/src/components/BackgroundOtaCoordinator";
import NativeOtaStartupGuard from "@/src/components/NativeOtaStartupGuard";
import ServerUpdateCoordinator from "@/src/components/ServerUpdateCoordinator";
import { SessionExpiredModal } from "@/src/components/SessionExpiredModal";
import { api } from "@/src/lib/api";
import { installAlertPromptCompat } from "@/src/lib/alertPromptCompat";

const STARTUP_BACKGROUND = "#071A2F";

installAlertPromptCompat();
LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync().catch(() => undefined);

function ThemedStack() {
  const { colors, isDark } = useTheme();
  const [platformSettings, setPlatformSettings] = useState<{
    appName?: string;
    maintenanceMode?: boolean;
    maintenanceMessage?: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    api.platform
      .settings()
      .then((settings) => {
        if (mounted) setPlatformSettings(settings);
      })
      .catch(() => {
        // Startup must remain usable offline or when the platform settings API is unavailable.
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (platformSettings?.maintenanceMode) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, padding: 24, justifyContent: "center" }}>
        <StatusBar style={isDark ? "light" : "dark"} translucent backgroundColor="transparent" />
        <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "800", textAlign: "center" }}>{platformSettings.appName || "OnCampus"}</Text>
        <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "700", textAlign: "center", marginTop: 20 }}>Maintenance Mode</Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 10 }}>{platformSettings.maintenanceMessage || "System under maintenance. We'll be back soon!"}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, width: "100%", backgroundColor: colors.surface }}>
      <StatusBar style={isDark ? "light" : "dark"} translucent backgroundColor="transparent" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { flex: 1, backgroundColor: colors.surface }, animation: "slide_from_right" }} />
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(STARTUP_BACKGROUND).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, width: "100%", backgroundColor: STARTUP_BACKGROUND }}>
        <SafeAreaProvider>
          <ActionSheetProvider>
            <AccessibilityProvider>
              <ThemeProvider>
                <LanguageProvider>
                  <RoleProvider>
                    <PinnedContentProvider>
                      <FeatureFlagsProvider>
                        <NotificationProvider>
                          <PushNotificationProvider>
                            <ToastProvider>
                              <ThemedStack />
                              <OptionalFeatureBoundary name="background-ota-coordinator">
                                <BackgroundOtaCoordinator />
                              </OptionalFeatureBoundary>
                              <OptionalFeatureBoundary name="native-ota-startup-guard">
                                <NativeOtaStartupGuard />
                              </OptionalFeatureBoundary>
                              <OptionalFeatureBoundary name="app-update-gate">
                                <AppUpdateGate />
                              </OptionalFeatureBoundary>
                              <OptionalFeatureBoundary name="server-update-coordinator">
                                <ServerUpdateCoordinator />
                              </OptionalFeatureBoundary>
                              <OptionalFeatureBoundary name="session-expired-modal">
                                <SessionExpiredModal />
                              </OptionalFeatureBoundary>
                            </ToastProvider>
                          </PushNotificationProvider>
                        </NotificationProvider>
                      </FeatureFlagsProvider>
                    </PinnedContentProvider>
                  </RoleProvider>
                </LanguageProvider>
              </ThemeProvider>
            </AccessibilityProvider>
          </ActionSheetProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}
