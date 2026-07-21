import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform, DeviceEventEmitter } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeProvider";
import { spacing, radius } from "@/src/theme/colors";
import { SESSION_EXPIRED_EVENT } from "@/src/lib/api";

export function SessionExpiredModal() {
  const [visible, setVisible] = useState(false);
  const { colors } = useTheme();
  const router = useRouter();
  const handledRef = useRef(false);

  const redirectToLogin = useCallback(() => {
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.replace("/(auth)/login");
  }, [router]);

  useEffect(() => {
    const handleExpired = () => {
      if (handledRef.current) return;
      handledRef.current = true;
      setVisible(true);
      redirectToLogin();
    };

    let subscription: any = null;
    if (Platform.OS !== "web") {
      subscription = DeviceEventEmitter.addListener(SESSION_EXPIRED_EVENT, handleExpired);
    } else {
      window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    }

    return () => {
      if (Platform.OS !== "web" && subscription) {
        subscription.remove();
      } else if (Platform.OS === "web") {
        window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
      }
    };
  }, [redirectToLogin]);

  const handleLogin = () => {
    setVisible(false);
    handledRef.current = false;
    redirectToLogin();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleLogin}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <View style={[styles.iconContainer, { backgroundColor: colors.warning + "22" }]}>
            <Ionicons name="time-outline" size={32} color={colors.warning} />
          </View>
          <Text style={[styles.title, { color: colors.onSurface }]}>Session Expired</Text>
          <Text style={[styles.message, { color: colors.muted }]}>
            For your security, your session has expired due to inactivity or a password change. Please log in again to continue.
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.brandPrimary }]}
            onPress={handleLogin}
          >
            <Text style={[styles.buttonText, { color: colors.onBrandPrimary }]}>Log In Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  dialog: {
    width: "100%",
    maxWidth: 400,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  button: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
