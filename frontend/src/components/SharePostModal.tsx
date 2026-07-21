import React, { useState } from "react";
import { Alert, Modal, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Button from "@/src/components/Button";
import { api, getUserErrorMessage } from "@/src/lib/api";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";

export function SharePostModal({
  visible,
  onClose,
  institutionId,
}: {
  visible: boolean;
  onClose: () => void;
  institutionId: string;
}) {
  const { colors } = useTheme();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    if (!cleanTitle || !cleanDescription) {
      Alert.alert("Missing information", "Add a title and description before sending the request.");
      return;
    }

    setSubmitting(true);
    try {
      await api.institutions.postRequest(institutionId, {
        title: cleanTitle,
        description: cleanDescription,
      });
      setTitle("");
      setDescription("");
      Alert.alert("Request sent", "The institution admin team can review and publish it.");
      onClose();
    } catch (error) {
      Alert.alert("Request failed", getUserErrorMessage(error, "Could not send this institution request."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.container, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <View style={styles.headerRow}>
            <View style={[styles.icon, { backgroundColor: colors.brandTertiary }]}>
              <Ionicons name="business-outline" size={20} color={colors.onBrandTertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "600" }}>Send to institution</Text>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }}>Submit a real post request for admin review.</Text>
            </View>
          </View>

          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]}
            placeholder="Post title"
            placeholderTextColor={colors.muted}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[styles.input, styles.textarea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]}
            placeholder="Post description"
            placeholderTextColor={colors.muted}
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <View style={styles.actions}>
            <Button label="Cancel" variant="outline" onPress={onClose} disabled={submitting} style={{ flex: 1 }} />
            <Button label={submitting ? "Sending..." : "Submit"} onPress={handleSubmit} loading={submitting} disabled={submitting} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", padding: spacing.lg },
  container: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: 46, fontSize: font.base, marginBottom: spacing.md },
  textarea: { minHeight: 120, paddingTop: spacing.md, textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: spacing.md },
});
