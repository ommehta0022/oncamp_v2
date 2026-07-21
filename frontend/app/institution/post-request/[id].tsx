import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import Button from "@/src/components/Button";
import EmptyState from "@/src/components/EmptyState";
import { api, getUserErrorMessage } from "@/src/lib/api";

export default function InstitutionPostRequestCreate() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Announcement");
  const [posterUrl, setPosterUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!id || submitting) return;
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    if (!cleanTitle || !cleanDescription) {
      setError("Add a title and description before submitting.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.institutions.postRequest(id, {
        title: cleanTitle,
        description: cleanDescription,
        category: category.trim() || undefined,
        poster_url: posterUrl.trim() || undefined,
      });
      Alert.alert("Request sent", "The institution admin team can review and publish it from their request inbox.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err) {
      setError(getUserErrorMessage(err, "Could not submit this request."));
    } finally {
      setSubmitting(false);
    }
  };

  if (!id) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
        <Header title="Institution request" onBack={() => router.back()} />
        <EmptyState icon="business-outline" title="Institution not found" message="Open this screen from a real institution or official group." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="institution-post-request-create-screen">
      <Header title="Institution post request" subtitle={name ? `to ${name}` : "Submit for review"} onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.notice, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "500" }}>Institution-level request</Text>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 4, lineHeight: 20 }}>
              This goes to institution admins. If approved, they choose the official target group and publish it.
            </Text>
          </View>

          <Field label="Title" value={title} onChange={setTitle} placeholder="Post title" />
          <Field label="Description" value={description} onChange={setDescription} placeholder="What should the institution publish?" multiline />
          <Field label="Category" value={category} onChange={setCategory} placeholder="Announcement, Event, Poster..." />
          <Field label="Poster URL optional" value={posterUrl} onChange={setPosterUrl} placeholder="https://..." />

          {!!error && <Text style={{ color: colors.error, fontSize: font.sm, marginTop: spacing.sm }}>{error}</Text>}
          <Button
            label={submitting ? "Submitting..." : "Submit institution request"}
            onPress={submit}
            disabled={submitting}
            style={{ marginTop: spacing.lg }}
            testID="submit-institution-post-request-btn"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={{ color: colors.onSurface, fontSize: font.sm, fontWeight: "500", marginBottom: spacing.xs }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        style={[
          styles.input,
          {
            minHeight: multiline ? 120 : 48,
            textAlignVertical: multiline ? "top" : "center",
            backgroundColor: colors.surfaceSecondary,
            borderColor: colors.border,
            color: colors.onSurface,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: font.base },
});
