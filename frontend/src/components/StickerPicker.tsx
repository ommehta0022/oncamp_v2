import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/colors";

const STICKERS = ["🎓", "📚", "🔥", "👏", "🙌", "💯", "✅", "🎉", "❤️", "😂", "🤝", "⭐", "🏆", "📢", "🚀", "💡", "☕", "🫡", "🥳", "👀"];

export default function StickerPicker({ visible, onClose, onSelect }: { visible: boolean; onClose: () => void; onSelect: (sticker: string) => void }) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close sticker picker">
        <Pressable style={[styles.sheet, { backgroundColor: colors.surfaceSecondary }]} onPress={() => {}} accessible={false}>
          <View style={styles.header}>
            <View>
              <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "800" }}>Campus stickers</Text>
              <Text style={{ color: colors.onSurfaceTertiary, marginTop: 2 }}>Quick reactions for group conversations</Text>
            </View>
            <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.onSurface} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.grid}>
            {STICKERS.map((sticker) => (
              <Pressable
                key={sticker}
                onPress={() => { onSelect(sticker); onClose(); }}
                accessibilityRole="button"
                accessibilityLabel={`Send ${sticker} sticker`}
                style={[styles.sticker, { backgroundColor: colors.surfaceTertiary }]}
              >
                <Text style={styles.emoji}>{sticker}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: 34, maxHeight: "55%" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sticker: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 32 },
});
