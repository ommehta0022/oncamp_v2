import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";

const LANGUAGES = [
  { code: "en", name: "English", native: "English" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", name: "Malayalam", native: "മലയാളം" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
];

export default function Language() {
  const { colors } = useTheme();
  const router = useRouter();
  const [selected, setSelected] = useState("en");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Language" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg }}>
        <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          {LANGUAGES.map((l, i) => (
            <React.Fragment key={l.code}>
              {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: spacing.lg }} />}
              <Pressable onPress={() => setSelected(l.code)} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{l.name}</Text>
                  {l.native !== l.name && (
                    <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>{l.native}</Text>
                  )}
                </View>
                {selected === l.code && <Ionicons name="checkmark" size={22} color={colors.brandPrimary} />}
              </Pressable>
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 60 },
});
