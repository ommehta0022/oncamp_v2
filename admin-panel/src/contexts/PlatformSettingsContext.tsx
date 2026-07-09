"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "@/lib/api";

interface PlatformSettings {
  platform_name: string;
  support_email: string;
  logo_url: string;
  maintenance_mode: boolean;
  maintenance_message: string;
}

interface PlatformSettingsContextType {
  settings: PlatformSettings;
  refreshSettings: () => Promise<void>;
  isLoading: boolean;
}

const defaultSettings: PlatformSettings = {
  platform_name: "OnCampus",
  support_email: "support@oncampus.app",
  logo_url: "/logo.png",
  maintenance_mode: false,
  maintenance_message: "System under maintenance. We'll be back soon!",
};

const PlatformSettingsContext = createContext<PlatformSettingsContextType>({
  settings: defaultSettings,
  refreshSettings: async () => {},
  isLoading: true,
});

export const usePlatformSettings = () => useContext(PlatformSettingsContext);

export const PlatformSettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

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
      console.error("Failed to load platform settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  return (
    <PlatformSettingsContext.Provider value={{ settings, refreshSettings, isLoading }}>
      {children}
    </PlatformSettingsContext.Provider>
  );
};
