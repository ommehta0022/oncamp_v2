import React, { useState } from "react";
import { Alert, Platform, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import Button from "@/src/components/Button";
import { api, getUserErrorMessage } from "@/src/lib/api";

export default function DataExport() {
  const { colors } = useTheme();
  const router = useRouter();
  const [exporting, setExporting] = useState(false);

  const buildExport = async () => {
    const [profile, stats, groups, savedPosts, notifications, postRequests, blockedUsers] = await Promise.all([
      api.users.me(),
      api.users.stats().catch(() => null),
      api.groups.listMine().catch(() => []),
      api.saved.list().catch(() => []),
      api.notifications.list().catch(() => []),
      api.users.myPostRequests().catch(() => []),
      api.blocked.list().catch(() => []),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      profile,
      stats,
      groups,
      savedPosts,
      notifications,
      postRequests,
      blockedUsers,
    };
  };

  const downloadExport = async () => {
    setExporting(true);
    try {
      const data = await buildExport();
      const json = JSON.stringify(data, null, 2);
      const filename = `oncampus-data-${new Date().toISOString().slice(0, 10)}.json`;

      if (Platform.OS === "web" && typeof document !== "undefined") {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        Alert.alert("Export ready", "Your account data export has been downloaded.");
      } else {
        await Share.share({ title: filename, message: json });
      }
    } catch (error) {
      Alert.alert("Export failed", getUserErrorMessage(error, "Could not create your data export."));
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Download your data" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }}>
        <View style={[styles.hero, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.brandTertiary }]}>
            <Ionicons name="download-outline" size={30} color={colors.onBrandTertiary} />
          </View>
          <Text style={{ color: colors.onSurface, fontSize: font.xl, fontWeight: "600", marginTop: spacing.md }}>
            Export your real account data
          </Text>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.base, lineHeight: 22, marginTop: spacing.sm }}>
            We collect your current profile, groups, saved posts, notifications, post requests, and blocked users from the live API.
          </Text>
          <Button
            label={exporting ? "Preparing..." : "Generate export"}
            onPress={downloadExport}
            loading={exporting}
            disabled={exporting}
            fullWidth
            style={{ marginTop: spacing.lg }}
            testID="generate-data-export-btn"
          />
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "600", marginBottom: spacing.sm }}>
            Included sections
          </Text>
          <InfoItem icon="person" text="Profile information and account settings" />
          <InfoItem icon="people" text="Joined groups, pinned/muted state, and group roles" />
          <InfoItem icon="bookmark" text="Saved posts and bookmarks" />
          <InfoItem icon="notifications" text="Notifications and unread context" />
          <InfoItem icon="clipboard" text="Post and poster requests you submitted" />
          <InfoItem icon="ban" text="Blocked users list" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoItem({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.divider }]}>
      <Ionicons name={icon} size={19} color={colors.brandPrimary} />
      <Text style={{ color: colors.onSurface, fontSize: font.base, flex: 1 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  iconWrap: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
});
