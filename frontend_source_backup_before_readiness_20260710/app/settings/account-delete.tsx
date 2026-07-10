import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import { useRole } from "@/src/context/RoleProvider";
import { api, clearSession } from "@/src/lib/api";

export default function AccountDelete() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, refreshUser } = useRole();
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const confirmKeyword = user?.handle ? `@${user.handle}` : "DELETE";
  
  const isMatch = confirmText === confirmKeyword;

  const handleDelete = async () => {
    if (!isMatch) return;
    
    Alert.alert(
      "Final Warning",
      "This action cannot be undone. All your data will be permanently deleted.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete My Account", 
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await api.users.deleteMe();
              await clearSession();
              await refreshUser();
              router.replace("/(auth)/welcome");
            } catch (err) {
              Alert.alert("Error", "Failed to delete account. Please try again or contact support.");
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={15}>
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface }]}>Delete Account</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ padding: spacing.xl }}>
        <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
          <View style={[styles.warningIcon, { backgroundColor: colors.danger + "20" }]}>
            <Ionicons name="warning" size={48} color={colors.danger} />
          </View>
          <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "700", marginTop: spacing.md, textAlign: "center" }}>
            We're sorry to see you go
          </Text>
        </View>

        <Text style={{ color: colors.onSurface, fontSize: font.base, lineHeight: 22, marginBottom: spacing.lg }}>
          Deleting your account is <Text style={{ fontWeight: "700", color: colors.danger }}>permanent</Text> and cannot be undone. All your posts, groups, messages, and profile data will be permanently erased.
        </Text>

        <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginBottom: spacing.xs }}>
          To confirm, type <Text style={{ fontWeight: "700", color: colors.onSurface }}>{confirmKeyword}</Text> below:
        </Text>
        
        <TextInput
          value={confirmText}
          onChangeText={setConfirmText}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
          placeholder={confirmKeyword}
          placeholderTextColor={colors.muted}
        />

        <Pressable
          style={[
            styles.deleteBtn,
            { backgroundColor: isMatch ? colors.danger : colors.surfaceSecondary }
          ]}
          disabled={!isMatch || loading}
          onPress={handleDelete}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: isMatch ? "#fff" : colors.muted, fontSize: font.base, fontWeight: "600" }}>
              Delete My Account
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, height: 60, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start" },
  title: { fontSize: 18, fontWeight: "600", letterSpacing: -0.2 },
  warningIcon: {
    width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center",
  },
  input: {
    height: 52, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md,
    fontSize: font.lg, fontWeight: "600", marginBottom: spacing.xl,
  },
  deleteBtn: {
    height: 52, borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
  },
});
