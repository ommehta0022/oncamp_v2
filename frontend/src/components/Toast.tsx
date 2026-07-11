import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, Animated, PanResponder } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing, font } from "../theme/colors";

export type ToastVariant = "success" | "error" | "warning" | "info";

export type ToastOptions = {
  message: string;
  variant?: ToastVariant;
  duration?: number;
  position?: "top" | "bottom";
  icon?: keyof typeof Ionicons.glyphMap;
};

type ToastContextValue = {
  showToast: (options: ToastOptions | string) => void;
  hideToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const toastPositionRef = useRef<"top" | "bottom">("top");

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: toastPositionRef.current === "bottom" ? 100 : -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast(null);
    });
  }, [opacityAnim, slideAnim]);

  const showToast = useCallback((options: ToastOptions | string) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const opts = typeof options === "string" ? { message: options } : options;
    const finalOpts = {
      variant: "info" as ToastVariant,
      duration: 3000,
      position: "top" as const,
      ...opts,
    };

    toastPositionRef.current = finalOpts.position;
    setToast(finalOpts);

    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    if (finalOpts.duration > 0) {
      timerRef.current = setTimeout(() => {
        hideToast();
      }, finalOpts.duration);
    }
  }, [hideToast, opacityAnim, slideAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_evt, gestureState) => {
        if (toastPositionRef.current === "top" && gestureState.dy < 0) {
          slideAnim.setValue(gestureState.dy);
        } else if (toastPositionRef.current === "bottom" && gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (Math.abs(gestureState.dy) > 20) {
          hideToast();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toast && (
        <SafeAreaView
          style={[styles.container, toast.position === "top" ? { top: 0 } : { bottom: spacing.xl }]}
          pointerEvents="box-none"
        >
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.toast,
              {
                opacity: opacityAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <ToastContent options={toast} />
          </Animated.View>
        </SafeAreaView>
      )}
    </ToastContext.Provider>
  );
}

function ToastContent({ options }: { options: ToastOptions }) {
  const { colors } = useTheme();

  const vStyles = {
    success: { bg: colors.success, fg: "#FFF", icon: "checkmark-circle" as const },
    error: { bg: colors.danger || colors.error, fg: "#FFF", icon: "alert-circle" as const },
    warning: { bg: colors.warning, fg: "#111", icon: "warning" as const },
    info: { bg: colors.surfaceInverse || "#333", fg: colors.onSurfaceInverse || "#FFF", icon: "information-circle" as const },
  };

  const style = vStyles[options.variant || "info"];
  const icon = options.icon || style.icon;

  return (
    <View style={[styles.content, { backgroundColor: style.bg }]}>
      <Ionicons name={icon} size={22} color={style.fg} />
      <Text style={[styles.message, { color: style.fg }]}>{options.message}</Text>
    </View>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: "center",
    paddingTop: spacing.md,
  },
  toast: {
    marginHorizontal: spacing.lg,
    width: "90%",
    maxWidth: 400,
    borderRadius: radius.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  message: {
    fontSize: font.base,
    fontWeight: "500",
    marginLeft: spacing.md,
    flex: 1,
  },
});
