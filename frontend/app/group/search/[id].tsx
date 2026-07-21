import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, Platform, KeyboardAvoidingView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import EmptyState from "@/src/components/EmptyState";
import { api, MessageDto } from "@/src/lib/api";
import { typography } from "@/src/theme/typography";

export default function GroupSearch() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MessageDto[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (!id || query.trim().length < 2) {
      setResults([]);
      return;
    }
    
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.groups.searchMessages(id, query.trim());
        setResults(res || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 500);
    
    return () => clearTimeout(timeout);
  }, [query, id]);

  const navigateToMessage = (messageId: string) => {
    // In a full implementation, this would navigate to chat and scroll to message
    // For now, we'll just go back to chat
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={15} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary || colors.onSurface} />
        </Pressable>
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceTertiary }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary || colors.onSurfaceTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search messages..."
            placeholderTextColor={colors.muted}
            autoFocus
            style={{ flex: 1, color: colors.textPrimary || colors.onSurface, fontSize: font.base, marginLeft: spacing.sm, height: 40 }}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: spacing.md }}
          ListEmptyComponent={
            <View style={{ paddingTop: spacing.xl }}>
              {loading ? (
                <Text style={{ textAlign: "center", color: colors.muted }}>Searching...</Text>
              ) : query.trim().length >= 2 ? (
                <EmptyState icon="search-outline" title="No messages found" message="Try a different keyword." />
              ) : (
                <EmptyState icon="search-circle-outline" title="Search Chat" message="Enter at least 2 characters to search past messages." />
              )}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable 
              style={({ pressed }) => [
                styles.resultRow, 
                { borderBottomColor: colors.border, backgroundColor: pressed ? colors.surfaceSecondary : "transparent" }
              ]}
              onPress={() => navigateToMessage(item.id)}
            >
              <Avatar uri={item.senderAvatar || ""} name={item.senderName} size={40} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                  <Text style={{ color: colors.textPrimary || colors.onSurface, fontWeight: "600" }}>{item.senderName}</Text>
                  <Text style={{ color: colors.textSecondary || colors.onSurfaceTertiary, fontSize: 12 }}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={{ color: colors.textSecondary || colors.onSurfaceTertiary, marginTop: 4, ...typography.body }} numberOfLines={2}>
                  {item.content}
                </Text>
              </View>
            </Pressable>
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { marginRight: 0 },
  searchBox: { 
    flex: 1, flexDirection: "row", alignItems: "center", 
    height: 40, borderRadius: radius.pill, paddingHorizontal: spacing.md 
  },
  resultRow: {
    flexDirection: "row", gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
