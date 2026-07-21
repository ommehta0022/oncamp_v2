import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/src/lib/api";

type FeatureFlagsContextValue = {
  flags: Record<string, boolean>;
  loading: boolean;
  enabled: (key: string, fallback?: boolean) => boolean;
  refreshFlags: () => Promise<void>;
};

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const refreshFlags = useCallback(async () => {
    setLoading(true);
    try {
      const next = await api.platform.featureFlags();
      setFlags(next || {});
    } catch {
      setFlags({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFlags();
  }, [refreshFlags]);

  const value = useMemo<FeatureFlagsContextValue>(() => ({
    flags,
    loading,
    enabled: (key, fallback = false) => flags[key] ?? fallback,
    refreshFlags,
  }), [flags, loading, refreshFlags]);

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error("useFeatureFlags must be used inside FeatureFlagsProvider");
  }
  return context;
}
