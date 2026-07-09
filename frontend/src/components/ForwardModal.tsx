import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Modal, FlatList, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "./Avatar";
import { api, GroupDto } from "@/src/lib/api";

type Props = {
  visible: boolean;
  messageContent: string | null;
  onClose: () => void;
  onForward: (groupId: string) => Promise<void>;
};

export default function ForwardModal({ visible, messageContent, onClose, onForward }: Props) {
  const { colors } = useTheme();
  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [forwardingTo, setForwardingTo] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setQuery("");
      setLoading(true);
      api.groups.listMine()
        .then(res => setGroups(res))
        .catch(() => setGroups([]))
        .finally(() => setLoading(false));
    }
  }, [visible]);

  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(query.toLowerCase()));

  const handleForward = async (groupId: string) => {
    if (forwardingTo) return;
    setForwardingTo(groupId);
    try {
      await onForward(groupId);
      onClose();
    } catch (err) {
      console.error("Failed to forward", err);
    } finally {
      setForwardingTo(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "600" }}>Forward to...</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.onSurface} />
            </Pressable>
          </View>
          
          <View style={styles.searchWrap}>
            <View style={[styles.searchBox, { backgroundColor: colors.surfaceTertiary }]}>
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search groups"
                placeholderTextColor={colors.muted}
                style={{ flex: 1, marginLeft: spacing.sm, color: colors.onSurface, fontSize: font.base }}
              />
            </View>
          </View>

          {loading ? (
            <View style={{ padding: spacing.xl, alignItems: "center" }}>
              <ActivityIndicator color={colors.brandPrimary} />
            </View>
          ) : (
            <FlatList
              data={filteredGroups}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: spacing.xl }}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceSecondary : "transparent" }]}
                  onPress={() => handleForward(item.id)}
                >
                  <Avatar uri={item.avatarUrl} name={item.name} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>{item.name}</Text>
                    <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }}>{item.memberCount || 0} members</Text>
                  </View>
                  {forwardingTo === item.id ? (
                    <ActivityIndicator size="small" color={colors.brandPrimary} />
                  ) : (
                    <View style={[styles.btn, { backgroundColor: colors.brandPrimary }]}>
                      <Text style={{ color: colors.onBrandPrimary, fontSize: font.sm, fontWeight: "600" }}>Send</Text>
                    </View>
                  )}
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={{ padding: spacing.xl, alignItems: "center" }}>
                  <Text style={{ color: colors.muted }}>No groups found.</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    height: "85%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    padding: 4,
  },
  searchWrap: {
    padding: spacing.lg,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  btn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
});
