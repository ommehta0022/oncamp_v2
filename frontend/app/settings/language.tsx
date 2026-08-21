import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Header from "@/src/components/Header";
import { useToast } from "@/src/components/Toast";
import { AppLanguage, useLanguage } from "@/src/context/LanguageProvider";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/colors";

export default function LanguageSettings() {
  const { colors } = useTheme();
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const { showToast } = useToast();
  const [saving, setSaving] = useState<AppLanguage | null>(null);

  const options: { code: AppLanguage; title: string; subtitle: string }[] = [
    { code: "en", title: t("language.english"), subtitle: "English" },
    { code: "hi", title: t("language.hindi"), subtitle: "Hindi" },
    { code: "mr", title: t("language.marathi"), subtitle: "Marathi" },
  ];

  const select = async (code: AppLanguage) => {
    if (saving || code === language) return;
    setSaving(code);
    try {
      await setLanguage(code);
      showToast({ message: t("language.saved"), variant: "success" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background || colors.surface }} edges={["top"]}>
      <Header title={t("language.title")} onBack={() => router.back()} />
      <View style={{ padding: spacing.xl }}>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg }}>{t("language.subtitle")}</Text>
        <View style={{ borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceSecondary }}>
          {options.map((option, index) => {
            const selected = option.code === language;
            return (
              <Pressable
                key={option.code}
                onPress={() => void select(option.code)}
                disabled={saving !== null}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: saving !== null }}
                accessibilityLabel={`${option.title}, ${option.subtitle}`}
                style={{
                  minHeight: 68,
                  paddingHorizontal: spacing.lg,
                  flexDirection: "row",
                  alignItems: "center",
                  borderBottomWidth: index === options.length - 1 ? 0 : 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "700" }}>{option.title}</Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 3 }}>{option.subtitle}</Text>
                </View>
                <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={24} color={selected ? colors.brandPrimary : colors.onSurfaceTertiary} />
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.lg }}>
          User-generated posts, group names and institution content stay in the language they were published in.
        </Text>
      </View>
    </SafeAreaView>
  );
}
