import React from "react";
import { Modal, View, Text, StyleSheet, Pressable, TouchableWithoutFeedback } from "react-native";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import { Ionicons } from "@expo/vector-icons";

type Option = {
  label: string;
  icon: any;
  color?: string;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  options: Option[];
  title?: string;
};

export default function OptionsMenu({ visible, onClose, options, title }: Props) {
  const { colors } = useTheme();

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.menu, { backgroundColor: colors.surfaceSecondary }]}>
              {title && (
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                  <Text style={{ color: colors.onSurface, fontSize: font.base, fontWeight: "600" }}>{title}</Text>
                </View>
              )}
              {options.map((opt, index) => (
                <Pressable
                  key={index}
                  style={[styles.option, { borderBottomColor: colors.border, borderBottomWidth: index === options.length - 1 ? 0 : 1 }]}
                  onPress={() => {
                    onClose();
                    opt.onPress();
                  }}
                >
                  <Ionicons name={opt.icon} size={20} color={opt.color || colors.onSurface} />
                  <Text style={{ color: opt.color || colors.onSurface, fontSize: font.base, fontWeight: "500", marginLeft: spacing.md }}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
              <View style={{ height: 20 }} />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  menu: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.md,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    alignItems: "center",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
});
