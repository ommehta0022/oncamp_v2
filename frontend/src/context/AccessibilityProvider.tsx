import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AccessibilityInfo } from "react-native";

const KEY = "oncampus.accessibility.preferences";

type Preferences = {
  highContrast: boolean;
  reduceMotion: boolean;
};

type ContextValue = Preferences & {
  screenReaderEnabled: boolean;
  hydrated: boolean;
  setHighContrast: (value: boolean) => void;
  setReduceMotion: (value: boolean) => void;
};

const AccessibilityContext = createContext<ContextValue | null>(null);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>({ highContrast: false, reduceMotion: false });
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      AsyncStorage.getItem(KEY),
      AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
      AccessibilityInfo.isScreenReaderEnabled().catch(() => false),
    ]).then(([stored, systemReduceMotion, reader]) => {
      if (!alive) return;
      let parsed: Partial<Preferences> = {};
      try { parsed = stored ? JSON.parse(stored) : {}; } catch { parsed = {}; }
      setPreferences({
        highContrast: Boolean(parsed.highContrast),
        reduceMotion: typeof parsed.reduceMotion === "boolean" ? parsed.reduceMotion : Boolean(systemReduceMotion),
      });
      setScreenReaderEnabled(Boolean(reader));
      setHydrated(true);
    });

    const reduceSubscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      if (!alive) return;
      AsyncStorage.getItem(KEY).then((stored) => {
        try {
          const parsed = stored ? JSON.parse(stored) : {};
          if (typeof parsed.reduceMotion !== "boolean") setPreferences((current) => ({ ...current, reduceMotion: enabled }));
        } catch { /* keep current preference */ }
      });
    });
    const readerSubscription = AccessibilityInfo.addEventListener("screenReaderChanged", setScreenReaderEnabled);

    return () => {
      alive = false;
      reduceSubscription.remove();
      readerSubscription.remove();
    };
  }, []);

  const persist = useCallback((next: Preferences) => {
    setPreferences(next);
    void AsyncStorage.setItem(KEY, JSON.stringify(next));
  }, []);
  const setHighContrast = useCallback((value: boolean) => persist({ ...preferences, highContrast: value }), [persist, preferences]);
  const setReduceMotion = useCallback((value: boolean) => persist({ ...preferences, reduceMotion: value }), [persist, preferences]);

  const value = useMemo(() => ({ ...preferences, screenReaderEnabled, hydrated, setHighContrast, setReduceMotion }), [preferences, screenReaderEnabled, hydrated, setHighContrast, setReduceMotion]);
  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export function useAccessibilityPreferences() {
  const value = useContext(AccessibilityContext);
  if (!value) throw new Error("useAccessibilityPreferences must be used within AccessibilityProvider");
  return value;
}
