import React from "react";
import { Modal, View, Text, StyleSheet, Pressable, TouchableWithoutFeedback, Animated } from "react-native";
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.menu, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1 }]}>
              {REACTIONS.map((r, i) => (
                <Pressable
                  key={r.type}
                  style={({ pressed }) => [styles.reactionItem, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => {
                    onClose();
                    onSelect(r.type);
                  }}
                >
                  <Text style={styles.emoji}>{r.emoji}</Text>
                  <Text style={[styles.label, { color: colors.textSecondary || colors.onSurfaceTertiary }]}>{r.label}</Text>
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
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  menu: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    padding: spacing.md,
    borderRadius: radius.xl,
    width: "80%",
    gap: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  reactionItem: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
    width: "30%",
  },
  emoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
  },
});
