import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import EmptyState from "@/src/components/EmptyState";
import Avatar from "@/src/components/Avatar";
import { api, getUserErrorMessage } from "@/src/lib/api";
import { normalizeRole } from "@/src/lib/institution";

const INVITE_ROLES = ["admin", "content_admin", "moderator"];

export default function InstitutionAdmins() {
  const { colors } = useTheme();
  const router = useRouter();
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("admin");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.institutions.admins()
      .then((rows: any) => setAdmins(Array.isArray(rows) ? rows : []))
      .catch(() => setAdmins([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const inviteAdmin = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      Alert.alert("Email required", "Enter a valid email address for the new admin.");
      return;
    }
    try {
      setBusy("invite");
      const result = (await api.institutions.inviteAdmin({ email, role: inviteRole })) as any;
      setInviteEmail("");
      setInviteOpen(false);
      await load();
      Alert.alert(result.pending ? "Invite recorded" : "Admin added", result.message || "Institution admin access updated.");
    } catch (error) {
      Alert.alert("Invite failed", getUserErrorMessage(error, "Could not invite this admin."));
    } finally {
      setBusy(null);
    }
  };

  const changeRole = async (admin: any) => {
    const current = String(admin.role || "admin");
    const index = INVITE_ROLES.indexOf(current);
    const nextRole = INVITE_ROLES[(index + 1) % INVITE_ROLES.length];
    try {
      setBusy(`role-${admin.id}`);
      await api.institutions.updateAdmin(admin.id, { role: nextRole });
      await load();
    } catch (error) {
      Alert.alert("Role not changed", getUserErrorMessage(error, "Could not update this admin role."));
    } finally {
      setBusy(null);
    }
  };

  const removeAdmin = (admin: any) => {
    Alert.alert("Remove admin?", "This admin will lose institution management access.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            setBusy(`remove-${admin.id}`);
            await api.institutions.removeAdmin(admin.id);
            await load();
          } catch (error) {
            Alert.alert("Remove failed", getUserErrorMessage(error, "Could not remove this admin."));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="institution-admins-screen">
      <Header
        title="Institution admins"
        subtitle={`${admins.length} admins`}
        onBack={() => router.back()}
        right={
          <Pressable hitSlop={8} onPress={() => setInviteOpen((value) => !value)}>
            <Ionicons name="person-add" size={22} color={colors.brandPrimary} />
          </Pressable>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.md }}>
        {inviteOpen && (
          <View style={[styles.inviteCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "600" }}>Invite new admin</Text>
            <TextInput
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="admin@institution.edu"
              placeholderTextColor={colors.placeholder}
              style={[styles.input, { color: colors.onSurface, borderColor: colors.border, backgroundColor: colors.surfaceTertiary }]}
            />
            <View style={styles.rolePicker}>
              {INVITE_ROLES.map((role) => (
                <Pressable
                  key={role}
                  onPress={() => setInviteRole(role)}
                  style={[styles.roleChip, { borderColor: inviteRole === role ? colors.brandPrimary : colors.borderStrong, backgroundColor: inviteRole === role ? colors.brandTertiary : "transparent" }]}
                >
                  <Text style={{ color: inviteRole === role ? colors.brandPrimary : colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: "600" }}>{normalizeRole(role)}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={[styles.primaryBtn, { backgroundColor: colors.brandPrimary }]} onPress={inviteAdmin} disabled={busy === "invite"}>
              {busy === "invite" ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: font.base, fontWeight: "700" }}>Send invite</Text>}
            </Pressable>
          </View>
        )}
        {!loading && admins.length === 0 && (
          <EmptyState icon="person-add-outline" title="No admins loaded" message="Institution admin records will appear here after approval and admin invites are connected." />
        )}
        {admins.map((admin) => {
          const role = normalizeRole(admin.role);
          const user = admin.user || {};
          return (
            <View key={admin.id} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Avatar uri={user.avatarUrl || user.avatar_url} name={user.name || "Admin"} size={48} verified={user.verified} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }}>{user.name || "Admin"}</Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }} numberOfLines={1}>{user.bio || user.course || user.email || "Institution admin"}</Text>
                </View>
                <View style={[styles.roleTag, { backgroundColor: colors.brandTertiary }]}>
                  <Text style={{ color: colors.onBrandTertiary, fontSize: 10, fontWeight: "500", letterSpacing: 0.3 }}>{role.toUpperCase()}</Text>
                </View>
              </View>

              <View style={styles.actions}>
                <Pressable style={[styles.actionBtn, { borderColor: colors.borderStrong }]} onPress={() => user.id ? router.push(`/user/${user.id}`) : undefined}>
                  <Ionicons name="mail-outline" size={14} color={colors.onSurface} />
                  <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>Message</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, { borderColor: colors.borderStrong }]} onPress={() => changeRole(admin)} disabled={busy === `role-${admin.id}` || role.toLowerCase() === "owner"}>
                  <Ionicons name="swap-horizontal-outline" size={14} color={colors.onSurface} />
                  <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500" }}>{busy === `role-${admin.id}` ? "Saving" : "Change role"}</Text>
                </Pressable>
                {role.toLowerCase() !== "owner" && (
                  <Pressable style={[styles.actionBtn, { borderColor: colors.error }]} onPress={() => removeAdmin(admin)} disabled={busy === `remove-${admin.id}`}>
                    <Ionicons name="remove-circle-outline" size={14} color={colors.error} />
                    <Text style={{ color: colors.error, fontSize: font.sm, fontWeight: "500" }}>{busy === `remove-${admin.id}` ? "Removing" : "Remove"}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}

        <Pressable style={[styles.inviteBtn, { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]} onPress={() => setInviteOpen((value) => !value)}>
          <Ionicons name="add-circle" size={20} color={colors.brandPrimary} />
          <Text style={{ color: colors.brandPrimary, fontSize: font.base, fontWeight: "500" }}>Invite new admin</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  inviteCard: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, gap: spacing.md },
  input: { height: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontSize: font.base },
  rolePicker: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  roleChip: { height: 34, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center" },
  primaryBtn: { height: 46, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  roleTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, borderWidth: 1 },
  inviteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 48, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed" },
});
