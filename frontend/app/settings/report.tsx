import React, { useState } from "react";
import { View, Text, ScrollView, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import Button from "@/src/components/Button";

const ISSUE_TYPES = [
  { id: "bug", label: "Bug or technical issue", icon: "bug-outline" },
  { id: "crash", label: "App crashes", icon: "alert-circle-outline" },
  { id: "feature", label: "Feature request", icon: "bulb-outline" },
  { id: "content", label: "Inappropriate content", icon: "flag-outline" },
  { id: "account", label: "Account issue", icon: "person-outline" },
  { id: "other", label: "Other", icon: "help-circle-outline" },
];

export default function ReportProblem() {
  const { colors } = useTheme();
  const router = useRouter();
  const [selectedType, setSelectedType] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = () => {
    if (!selectedType || !description.trim()) {
      Alert.alert("Missing information", "Please select an issue type and provide a description.");
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      Alert.alert(
        "Report submitted",
        "Thank you for your feedback. Our team will review it shortly.",
        [{ text: "OK", onPress: () => router.back() }]
      );
      setSubmitting(false);
    }, 1000);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Report a problem" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500", marginBottom: spacing.md }}>
          What&apos;s the issue?
        </Text>

        {ISSUE_TYPES.map((type) => (
          <IssueTypeButton
            key={type.id}
            icon={type.icon as any}
            label={type.label}
            selected={selectedType === type.id}
            onPress={() => setSelectedType(type.id)}
          />
        ))}

        <Text style={{ 
          color: colors.onSurface, 
          fontSize: font.lg, 
          fontWeight: "500", 
          marginTop: spacing.xl, 
          marginBottom: spacing.md 
        }}>
          Description
        </Text>
        
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Please describe the issue in detail..."
          placeholderTextColor={colors.muted}
          multiline
          maxLength={500}
          style={{
            backgroundColor: colors.surfaceSecondary,
            borderColor: colors.borderStrong,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: spacing.md,
            color: colors.onSurface,
            fontSize: font.base,
            minHeight: 150,
            textAlignVertical: "top",
          }}
        />
        
        <Text style={{ color: colors.muted, fontSize: font.sm, marginTop: spacing.sm }}>
          {description.length}/500 characters
        </Text>

        <Button
          label="Submit report"
          onPress={submit}
          disabled={submitting || !selectedType || !description.trim()}
          fullWidth
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function IssueTypeButton({ 
  icon, 
  label, 
  selected, 
  onPress 
}: { 
  icon: keyof typeof Ionicons.glyphMap; 
  label: string; 
  selected: boolean; 
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <button
      onClick={onPress}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderRadius: radius.md,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: selected ? colors.brandPrimary : colors.borderStrong,
        backgroundColor: selected ? colors.brandPrimary + "11" : colors.surfaceSecondary,
        cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      <Ionicons 
        name={icon} 
        size={20} 
        color={selected ? colors.brandPrimary : colors.onSurfaceTertiary} 
      />
      <Text style={{ 
        color: selected ? colors.brandPrimary : colors.onSurface, 
        fontSize: font.base,
        fontWeight: selected ? "500" : "400",
        flex: 1 
      }}>
        {label}
      </Text>
      {selected && <Ionicons name="checkmark-circle" size={20} color={colors.brandPrimary} />}
    </button>
  );
}
