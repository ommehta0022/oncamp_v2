import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import VoiceNoteRecorder from "./VoiceNoteRecorder";
import StickerPicker from "./StickerPicker";
import { useTheme } from "@/src/theme/ThemeProvider";
import { api, getUserErrorMessage } from "@/src/lib/api";
import { pickGif, uploadMessageMedia, uploadVoiceNote } from "@/src/lib/imageUpload";

export default function GroupVoiceNoteButton({
  groupId,
  replyToId,
  disabled,
  onSent,
}: {
  groupId: string;
  replyToId?: string;
  disabled?: boolean;
  onSent: (message: any) => void;
}) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);

  const handleReady = async (uri: string, durationMs: number) => {
    if (busy) return;
    setBusy(true);
    try {
      const uploaded = await uploadVoiceNote(groupId, uri);
      const seconds = Math.max(1, Math.round(durationMs / 1000));
      const saved = await api.groups.sendMessage(groupId, {
        content: `Voice note • ${seconds}s`,
        type: "audio",
        mediaUrl: uploaded.url,
        replyToId,
        clientMessageId: `client-voice-${Date.now()}`,
      });
      onSent(saved);
    } catch (error) {
      Alert.alert("Voice note failed", getUserErrorMessage(error, "Could not send this voice note."));
    } finally {
      setBusy(false);
    }
  };

  const sendGif = async () => {
    if (busy || disabled) return;
    const uri = await pickGif();
    if (!uri) return;
    setBusy(true);
    try {
      const uploaded = await uploadMessageMedia(groupId, uri, "image/gif");
      const saved = await api.groups.sendMessage(groupId, {
        content: "GIF",
        type: "image",
        mediaUrl: uploaded.url,
        replyToId,
        clientMessageId: `client-gif-${Date.now()}`,
      });
      onSent(saved);
    } catch (error) {
      Alert.alert("GIF failed", getUserErrorMessage(error, "Could not send this GIF."));
    } finally {
      setBusy(false);
    }
  };

  const sendSticker = async (sticker: string) => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const saved = await api.groups.sendMessage(groupId, {
        content: sticker,
        type: "text",
        replyToId,
        clientMessageId: `client-sticker-${Date.now()}`,
      });
      onSent(saved);
    } catch (error) {
      Alert.alert("Sticker failed", getUserErrorMessage(error, "Could not send this sticker."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => void sendGif()}
        disabled={disabled || busy}
        accessibilityRole="button"
        accessibilityLabel="Send a GIF"
        style={[styles.smallButton, { backgroundColor: colors.surfaceTertiary, opacity: disabled ? 0.45 : 1 }]}
      >
        {busy ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : <Ionicons name="images-outline" size={18} color={colors.brandPrimary} />}
      </Pressable>
      <Pressable
        onPress={() => setStickerOpen(true)}
        disabled={disabled || busy}
        accessibilityRole="button"
        accessibilityLabel="Open stickers"
        style={[styles.smallButton, { backgroundColor: colors.surfaceTertiary, opacity: disabled ? 0.45 : 1 }]}
      >
        <Ionicons name="happy-outline" size={19} color={colors.brandPrimary} />
      </Pressable>
      <VoiceNoteRecorder disabled={disabled || busy} onReady={handleReady} />
      <StickerPicker visible={stickerOpen} onClose={() => setStickerOpen(false)} onSelect={(sticker) => void sendSticker(sticker)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  smallButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 3 },
});
