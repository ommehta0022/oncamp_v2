import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "react-native";
import { lightColors, darkColors, ThemeColors } from "./colors";
import { useAccessibilityPreferences } from "@/src/context/AccessibilityProvider";

type ThemeMode = "light" | "dark" | "system";

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (m: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "oncampus.theme.mode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const { highContrast } = useAccessibilityPreferences();
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;

    void AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (!mounted) return;
        if (v === "light" || v === "dark" || v === "system") setModeState(v);
      })
      .catch(() => {
        // Storage failures must never block the application shell.
      })
      .finally(() => {
        if (mounted) setHydrated(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    void AsyncStorage.setItem(STORAGE_KEY, m).catch(() => undefined);
  }, []);

  const isDark = mode === "system" ? system === "dark" : mode === "dark";
  const colors = useMemo<ThemeColors>(() => {
    const base = isDark ? darkColors : lightColors;
    if (!highContrast) return base;
    return {
      ...base,
      onSurface: isDark ? "#FFFFFF" : "#000000",
      onSurfaceSecondary: isDark ? "#FFFFFF" : "#000000",
      onSurfaceTertiary: isDark ? "#F2F2F2" : "#1A1A1A",
      muted: isDark ? "#D6D6D6" : "#333333",
      border: isDark ? "#777777" : "#8A8A8A",
      borderStrong: isDark ? "#A5A5A5" : "#555555",
      divider: isDark ? "#777777" : "#8A8A8A",
      textPrimary: isDark ? "#FFFFFF" : "#000000",
      textSecondary: isDark ? "#F2F2F2" : "#1A1A1A",
      textDisabled: isDark ? "#CFCFCF" : "#3A3A3A",
      placeholder: isDark ? "#D6D6D6" : "#333333",
      inputBorder: isDark ? "#A5A5A5" : "#555555",
    };
  }, [highContrast, isDark]);

  if (!hydrated) return null;

  return <ThemeContext.Provider value={{ mode, isDark, colors, setMode }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
