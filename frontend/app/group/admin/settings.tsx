import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import { api, GroupDto } from "@/src/lib/api";

export default function GroupSettings() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [group, setGroup] = useState<GroupDto | null>(null);
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const g = await api.groups.get(id);
      setGroup(g);
      setName(g.name || "");
      setDescription(g.description || "");
      setVisibility(g.visibility || "public");
    } catch {
      Alert.alert("Error", "Could not load group settings");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!id || !name.trim()) return;
    setSaving(true);
    try {
      await api.groups.update(id, { name: name.trim(), description: description.trim(), visibility });
      Alert.alert("Success", "Group updated successfully");
      router.back();
    } catch {
      Alert.alert("Error", "Failed to update group");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        <Header title="Group Settings" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header 
        title="Settings" 
        subtitle={group?.name}
        onBack={() => router.back()} 
        right={
          <Pressable onPress={handleSave} disabled={saving || !name.trim()}>
            <Text style={{ color: name.trim() ? colors.brandPrimary : colors.muted, fontWeight: "600", fontSize: font.lg }}>Save</Text>
          </Pressable>
        }
      />
      
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          
          <Text style={[styles.label, { color: colors.onSurface }]}>Group Name</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter group name"
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.onSurface }]}
            />
          </View>

          <Text style={[styles.label, { color: colors.onSurface, marginTop: spacing.xl }]}>Description</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, minHeight: 100, alignItems: 'flex-start' }]}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What is this group about?"
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.input, { color: colors.onSurface, minHeight: 80, textAlignVertical: "top", paddingTop: spacing.sm }]}
            />
          </View>
          
          <Text style={[styles.label, { color: colors.onSurface, marginTop: spacing.xl }]}>Visibility</Text>
          <View style={[styles.options, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Pressable 
              style={[styles.optionItem, { borderBottomColor: colors.border }]} 
              onPress={() => setVisibility("public")}
            >
              <View>
                <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>Public</Text>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>Anyone can find and request to join</Text>
              </View>
              {visibility === "public" && <Ionicons name="checkmark-circle" size={24} color={colors.brandPrimary} />}
            </Pressable>
            
            <Pressable 
              style={[styles.optionItem, { borderBottomWidth: 0 }]} 
              onPress={() => setVisibility("private")}
            >
              <View>
                <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>Private</Text>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>Only invited members can join</Text>
              </View>
              {visibility === "private" && <Ionicons name="checkmark-circle" size={24} color={colors.brandPrimary} />}
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: font.sm,
    fontWeight: "600",
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputWrapper: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
  },
  input: {
    fontSize: font.base,
    paddingVertical: spacing.md,
  },
  options: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderBottomWidth: 1,
  },
});
