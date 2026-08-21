import React, { useState } from "react";
import { Alert } from "react-native";

import VoiceNoteRecorder from "./VoiceNoteRecorder";
import { api, getUserErrorMessage } from "@/src/lib/api";
import { uploadVoiceNote } from "@/src/lib/imageUpload";

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
  const [busy, setBusy] = useState(false);

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

  return <VoiceNoteRecorder disabled={disabled || busy} onReady={handleReady} />;
}
