import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "react-native";
import { lightColors, darkColors, ThemeColors } from "./colors";
import { useAccessibilityPreferences } from "@/src/context/AccessibilityProvider";

export type ThemeMode = "light" | "dark";

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
      .then((value) => {
        if (!mounted) return;
        if (value === "dark" || value === "light") {
          setModeState(value);
          return;
        }
        // Migrate the removed "system" option once into an explicit mode so
        // users always know which of the two polished themes is active.
        const migrated: ThemeMode = system === "dark" ? "dark" : "light";
        setModeState(migrated);
        void AsyncStorage.setItem(STORAGE_KEY, migrated).catch(() => undefined);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setHydrated(true);
      });
    return () => {
      mounted = false;
    };
  }, [system]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const isDark = mode === "dark";
  const colors = useMemo<ThemeColors>(() => {
    const base = isDark ? darkColors : lightColors;
    if (!highContrast) return base;
    return {
      ...base,
      onSurface: isDark ? "#FFFFFF" : "#000000",
      onSurfaceSecondary: isDark ? "#FFFFFF" : "#000000",
      onSurfaceTertiary: isDark ? "#F5F5F5" : "#1B2630",
      muted: isDark ? "#DEE7EC" : "#35434C",
      border: isDark ? "#738A99" : "#7B7163",
      borderStrong: isDark ? "#9CB0BC" : "#554C41",
      divider: isDark ? "#738A99" : "#7B7163",
      textPrimary: isDark ? "#FFFFFF" : "#000000",
      textSecondary: isDark ? "#F5F5F5" : "#1B2630",
      textDisabled: isDark ? "#D0DCE3" : "#35434C",
      placeholder: isDark ? "#D0DCE3" : "#35434C",
      inputBorder: isDark ? "#9CB0BC" : "#554C41",
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
