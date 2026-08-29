import React from "react";
import { Modal, View, Text, StyleSheet, Pressable, TouchableWithoutFeedback } from "react-native";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/colors";

const REACTIONS = [
  { type: "like", emoji: "👍", label: "Like" },
  { type: "celebrate", emoji: "🎉", label: "Celebrate" },
  { type: "support", emoji: "🤝", label: "Support" },
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "insightful", emoji: "💡", label: "Insightful" },
  { type: "funny", emoji: "😂", label: "Funny" },
];

export const REACTION_EMOJIS: Record<string, string> = {
  like: "👍",
  celebrate: "🎉",
  support: "🤝",
  love: "❤️",
  insightful: "💡",
  funny: "😂",
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: string) => void;
};

export default function ReactionMenu({ visible, onClose, onSelect }: Props) {
  const { colors } = useTheme();

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.menu, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, shadowColor: colors.shadow }]} accessibilityRole="menu">
              {REACTIONS.map((reaction) => (
                <Pressable
                  key={reaction.type}
                  accessibilityRole="button"
                  accessibilityLabel={reaction.label}
                  style={({ pressed }) => [styles.reactionItem, pressed && { backgroundColor: colors.surfaceTertiary }]}
                  onPress={() => {
                    onClose();
                    onSelect(reaction.type);
                  }}
                >
                  <Text style={styles.emoji}>{reaction.emoji}</Text>
                  <Text numberOfLines={1} style={[styles.label, { color: colors.onSurfaceTertiary }]}>{reaction.label}</Text>
                </Pressable>
              ))}
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
    backgroundColor: "rgba(0,0,0,0.12)",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: 104,
  },
  menu: {
    width: "100%",
    maxWidth: 430,
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 10,
  },
  reactionItem: {
    flex: 1,
    minWidth: 48,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    paddingHorizontal: 2,
  },
  emoji: { fontSize: 25, lineHeight: 30 },
  label: { fontSize: 9, fontWeight: "600", marginTop: 2 },
});
