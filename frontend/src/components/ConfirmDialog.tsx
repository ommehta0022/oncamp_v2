import React from "react";
import { View, Text, StyleSheet, Modal, TouchableWithoutFeedback } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing, font } from "../theme/colors";
import Button from "./Button";

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
};

export default function ConfirmDialog({
  visible, title, message, onCancel, onConfirm,
  cancelLabel = "Cancel", confirmLabel = "Confirm",
  destructive, loading
}: ConfirmDialogProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={loading ? undefined : onCancel}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay || "rgba(0,0,0,0.5)" }]} />
        </TouchableWithoutFeedback>
        
        <View style={[styles.dialog, { backgroundColor: colors.card || colors.surfaceSecondary }]}>
          <Text style={[styles.title, { color: colors.textPrimary || colors.onSurface }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textSecondary || colors.onSurfaceTertiary }]}>{message}</Text>
          
          <View style={styles.actions}>
            <Button 
              label={cancelLabel} 
              variant="ghost" 
              onPress={onCancel} 
              disabled={loading}
              style={{ flex: 1 }}
            />
            <Button 
              label={confirmLabel} 
              variant={destructive ? "danger" : "primary"} 
              onPress={onConfirm} 
              loading={loading}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  dialog: {
    width: "100%",
    maxWidth: 400,
    borderRadius: radius.lg,
    padding: spacing.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: font.xl,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: font.base,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
});
