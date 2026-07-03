import React, { useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import Button from "@/src/components/Button";

export default function DataExport() {
  const { colors } = useTheme();
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);

  const requestExport = () => {
    Alert.alert(
      "Request data export",
      "We'll prepare a file with all your data and send you a download link via email within 48 hours.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Request", 
          onPress: () => {
            setRequesting(true);
            setTimeout(() => {
              Alert.alert("Request submitted", "You'll receive an email with your data within 48 hours.");
              setRequesting(false);
            }, 1000);
          }
        },
      ]
    );
  };

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
            Request a copy of all your data including posts, messages, groups, and profile information.
          </Text>
        </View>

        <View style={{ marginBottom: spacing.xl }}>
          <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500", marginBottom: spacing.sm }}>
            What&apos;s included:
          </Text>
          <InfoItem icon="person" text="Profile information and settings" />
          <InfoItem icon="chatbubbles" text="All your posts and comments" />
          <InfoItem icon="mail" text="Group messages you've sent" />
          <InfoItem icon="bookmark" text="Saved posts and bookmarks" />
          <InfoItem icon="people" text="Groups you've joined" />
        </View>

        <Button
          label="Request export"
          onPress={requestExport}
          disabled={requesting}
          fullWidth
        />

        <Text style={{ 
          color: colors.muted, 
          fontSize: font.sm, 
          textAlign: "center", 
          marginTop: spacing.lg,
          lineHeight: 18 
        }}>
          You&apos;ll receive a download link via email within 48 hours
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
