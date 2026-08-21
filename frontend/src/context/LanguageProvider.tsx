import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type AppLanguage = "en" | "hi" | "mr";

type Key =
  | "nav.feed" | "nav.groups" | "nav.campus" | "nav.alerts" | "nav.profile" | "nav.dashboard"
  | "settings.title" | "settings.preferences" | "settings.appearance" | "settings.notifications" | "settings.language"
  | "settings.privacySafety" | "settings.privacy" | "settings.blocked" | "settings.report"
  | "settings.yourCampus" | "settings.saved" | "settings.activity" | "settings.storage" | "settings.whatsNew"
  | "settings.support" | "settings.checkUpdates" | "settings.help" | "settings.about" | "settings.logout"
  | "language.title" | "language.subtitle" | "language.english" | "language.hindi" | "language.marathi" | "language.saved";

const STORAGE_KEY = "oncampus.language.v1";

const messages: Record<AppLanguage, Record<Key, string>> = {
  en: {
    "nav.feed": "Feed", "nav.groups": "Groups", "nav.campus": "Campus", "nav.alerts": "Alerts", "nav.profile": "Profile", "nav.dashboard": "Dashboard",
    "settings.title": "Settings", "settings.preferences": "Preferences", "settings.appearance": "Appearance", "settings.notifications": "Notifications", "settings.language": "Language",
    "settings.privacySafety": "Privacy & safety", "settings.privacy": "Privacy", "settings.blocked": "Blocked users", "settings.report": "Report a problem",
    "settings.yourCampus": "Your OnCampus", "settings.saved": "Saved posts", "settings.activity": "Recent activity", "settings.storage": "Storage & data", "settings.whatsNew": "What’s new",
    "settings.support": "Support", "settings.checkUpdates": "Check for updates", "settings.help": "Help center", "settings.about": "About & policies", "settings.logout": "Log Out",
    "language.title": "Language", "language.subtitle": "Choose the language used for core navigation and settings.", "language.english": "English", "language.hindi": "हिन्दी", "language.marathi": "मराठी", "language.saved": "Language updated",
  },
  hi: {
    "nav.feed": "फ़ीड", "nav.groups": "ग्रुप", "nav.campus": "कैंपस", "nav.alerts": "अलर्ट", "nav.profile": "प्रोफ़ाइल", "nav.dashboard": "डैशबोर्ड",
    "settings.title": "सेटिंग्स", "settings.preferences": "पसंद", "settings.appearance": "दिखावट", "settings.notifications": "नोटिफ़िकेशन", "settings.language": "भाषा",
    "settings.privacySafety": "प्राइवेसी और सुरक्षा", "settings.privacy": "प्राइवेसी", "settings.blocked": "ब्लॉक किए उपयोगकर्ता", "settings.report": "समस्या रिपोर्ट करें",
    "settings.yourCampus": "आपका OnCampus", "settings.saved": "सेव पोस्ट", "settings.activity": "हाल की गतिविधि", "settings.storage": "स्टोरेज और डेटा", "settings.whatsNew": "नया क्या है",
    "settings.support": "सहायता", "settings.checkUpdates": "अपडेट जाँचें", "settings.help": "सहायता केंद्र", "settings.about": "जानकारी और नीतियाँ", "settings.logout": "लॉग आउट",
    "language.title": "भाषा", "language.subtitle": "मुख्य नेविगेशन और सेटिंग्स के लिए भाषा चुनें।", "language.english": "English", "language.hindi": "हिन्दी", "language.marathi": "मराठी", "language.saved": "भाषा अपडेट हुई",
  },
  mr: {
    "nav.feed": "फीड", "nav.groups": "ग्रुप", "nav.campus": "कॅम्पस", "nav.alerts": "अलर्ट", "nav.profile": "प्रोफाइल", "nav.dashboard": "डॅशबोर्ड",
    "settings.title": "सेटिंग्ज", "settings.preferences": "प्राधान्ये", "settings.appearance": "दिसणे", "settings.notifications": "सूचना", "settings.language": "भाषा",
    "settings.privacySafety": "गोपनीयता आणि सुरक्षा", "settings.privacy": "गोपनीयता", "settings.blocked": "ब्लॉक केलेले वापरकर्ते", "settings.report": "समस्या नोंदवा",
    "settings.yourCampus": "तुमचे OnCampus", "settings.saved": "जतन केलेल्या पोस्ट", "settings.activity": "अलीकडील हालचाल", "settings.storage": "स्टोरेज आणि डेटा", "settings.whatsNew": "नवीन काय",
    "settings.support": "मदत", "settings.checkUpdates": "अपडेट तपासा", "settings.help": "मदत केंद्र", "settings.about": "माहिती आणि धोरणे", "settings.logout": "लॉग आउट",
    "language.title": "भाषा", "language.subtitle": "मुख्य नेव्हिगेशन आणि सेटिंग्जसाठी भाषा निवडा.", "language.english": "English", "language.hindi": "हिन्दी", "language.marathi": "मराठी", "language.saved": "भाषा अपडेट झाली",
  },
};

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (key: Key) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("en");

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (mounted && (stored === "en" || stored === "hi" || stored === "mr")) setLanguageState(stored);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage: async (next) => {
      setLanguageState(next);
      await AsyncStorage.setItem(STORAGE_KEY, next);
    },
    t: (key) => messages[language][key] || messages.en[key] || key,
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used inside LanguageProvider");
  return value;
}
