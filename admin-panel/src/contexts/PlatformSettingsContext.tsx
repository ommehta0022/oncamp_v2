"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "@/lib/api";

interface PlatformSettings {
  platform_name: string;
  maintenance_mode: boolean;
  maintenance_message: string;
}

interface PlatformSettingsContextType {
  settings: PlatformSettings;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: PlatformSettings = {
  platform_name: "OnCampus",
  maintenance_mode: false,
  maintenance_message: "System under maintenance",
};

const PlatformSettingsContext = createContext<PlatformSettingsContextType>({
  settings: defaultSettings,
  refreshSettings: async () => {},
});

export const PlatformSettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);

  const refreshSettings = async () => {
    try {
      const response = await api.getSettings();
      if (response) {
        setSettings((prev) => ({
          ...prev,
          ...response,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch platform settings:", error);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  return (
    <PlatformSettingsContext.Provider value={{ settings, refreshSettings }}>
      {children}
    </PlatformSettingsContext.Provider>
  );
};

export const usePlatformSettings = () => useContext(PlatformSettingsContext);
