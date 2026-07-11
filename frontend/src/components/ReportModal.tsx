import React, { useState } from "react";
import { Modal, View, Text, StyleSheet, Pressable, TouchableWithoutFeedback, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details: string) => Promise<void>;
  title?: string;
};

const REASONS = [
  "Spam or misleading",
  "Harassment or bullying",
  "Inappropriate content",
  "Hate speech",
  "Other"
];

export default function ReportModal({ visible, onClose, onSubmit, title = "Report" }: Props) {
  const { colors } = useTheme();
  const [selectedReason, setSelectedReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) return;
    setSubmitting(true);
    try {
      await onSubmit(selectedReason, details);
      Alert.alert("Submitted", "Thank you for your report. Our moderation team will review it shortly.");
      handleClose();
    } catch {
      Alert.alert("Error", "Could not submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason("");
    setDetails("");
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modal, { backgroundColor: colors.surface }]}>
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                  <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "600" }}>{title}</Text>
                  <Pressable onPress={handleClose} hitSlop={10}>
                    <Ionicons name="close" size={24} color={colors.onSurfaceTertiary} />
                  </Pressable>
                </View>

                <View style={styles.content}>
                  <Text style={{ color: colors.onSurface, fontSize: font.base, marginBottom: spacing.sm, fontWeight: "500" }}>
                    Why are you reporting this?
                  </Text>
                  
                  {REASONS.map(reason => (
                    <Pressable 
                      key={reason}
                      style={[
                        styles.reasonBtn, 
                        { 
                          backgroundColor: selectedReason === reason ? colors.brandPrimary + "22" : colors.surfaceSecondary,
                          borderColor: selectedReason === reason ? colors.brandPrimary : colors.border
                        }
                      ]}
                      onPress={() => setSelectedReason(reason)}
                    >
                      <Text style={{ color: selectedReason === reason ? colors.brandPrimary : colors.onSurface, fontWeight: selectedReason === reason ? "500" : "400" }}>
                        {reason}
                      </Text>
                      {selectedReason === reason && <Ionicons name="checkmark-circle" size={20} color={colors.brandPrimary} />}
                    </Pressable>
                  ))}

                  {selectedReason === "Other" && (
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
                      placeholder="Please provide more details..."
                      placeholderTextColor={colors.muted}
                      value={details}
                      onChangeText={setDetails}
                      multiline
                    />
                  )}

                  <Pressable 
                    style={[
                      styles.submitBtn, 
                      { backgroundColor: selectedReason && !submitting ? colors.error : colors.borderStrong }
                    ]}
                    onPress={handleSubmit}
                    disabled={!selectedReason || submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={{ color: "#fff", fontWeight: "600", fontSize: font.base }}>Submit Report</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modal: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '90%',
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  content: {
    padding: spacing.lg,
  },
  reasonBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    textAlignVertical: "top",
  },
  submitBtn: {
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },
});
