import React from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";

export default function DataExport() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Download your data" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={{ 
          backgroundColor: colors.surfaceSecondary, 
          padding: spacing.lg, 
          borderRadius: radius.md,
          marginBottom: spacing.xl 
        }}>
          <Ionicons name="download-outline" size={48} color={colors.brandPrimary} style={{ marginBottom: spacing.md }} />
          <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500", marginBottom: spacing.sm }}>
            Export your data
          </Text>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base, lineHeight: 22 }}>
            Data export is not enabled by this service yet. No request will be sent from this screen.
          </Text>
        </View>

        <View style={{ marginBottom: spacing.xl }}>
          <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500", marginBottom: spacing.sm }}>
            What&apos;s included:
          </Text>
          <InfoItem icon="person" text="Profile information and settings" />
          <InfoItem icon="document-text" text="All your posts and comments" />
          <InfoItem icon="mail" text="Group messages you've sent" />
          <InfoItem icon="bookmark" text="Saved posts and bookmarks" />
          <InfoItem icon="people" text="Groups you've joined" />
        </View>

        <Text style={{ 
          color: colors.muted, 
          fontSize: font.sm, 
          textAlign: "center", 
          marginTop: spacing.lg,
          lineHeight: 18 
        }}>
          Contact support if you need help with your account data.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoItem({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
      <Ionicons name={icon} size={20} color={colors.brandPrimary} style={{ marginRight: spacing.md }} />
      <Text style={{ color: colors.onSurface, fontSize: font.base, flex: 1 }}>{text}</Text>
    </View>
  );
}
