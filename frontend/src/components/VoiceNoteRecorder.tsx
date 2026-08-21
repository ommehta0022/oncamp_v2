import React, { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useTheme } from "@/src/theme/ThemeProvider";

export default function VoiceNoteRecorder({ disabled, onReady }: { disabled?: boolean; onReady: (uri: string, durationMs: number) => Promise<void> | void }) {
  const { colors } = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 200);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true }).catch(() => undefined);
    return () => { void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined); };
  }, []);

  const start = async () => {
    if (disabled || sending) return;
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Microphone permission", "Allow microphone access to record a voice note.");
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record({ forDuration: 300 });
  };

  const stop = async () => {
    if (!state.isRecording || sending) return;
    const duration = state.durationMillis || Math.round(recorder.currentTime * 1000);
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) {
      Alert.alert("Voice note", "The recording could not be saved. Please try again.");
      return;
    }
    setSending(true);
    try { await onReady(uri, duration); }
    finally { setSending(false); }
  };

  if (state.isRecording) {
    return (
      <View style={[styles.recording, { backgroundColor: colors.error + "16" }]}>
        <View style={[styles.dot, { backgroundColor: colors.error }]} />
        <Text style={{ color: colors.error, fontWeight: "700", minWidth: 42 }}>{formatTime(state.durationMillis || 0)}</Text>
        <Pressable onPress={() => void stop()} style={[styles.stop, { backgroundColor: colors.error }]}>
          <Ionicons name="stop" size={18} color="#fff" />
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable disabled={disabled || sending} onPress={() => void start()} style={[styles.mic, { opacity: disabled || sending ? .45 : 1 }]} accessibilityRole="button" accessibilityLabel="Record voice note">
      <Ionicons name={sending ? "cloud-upload-outline" : "mic-outline"} size={22} color={colors.brandPrimary} />
    </Pressable>
  );
}

function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  mic: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21 },
  recording: { height: 42, borderRadius: 21, paddingLeft: 12, paddingRight: 5, flexDirection: "row", alignItems: "center", gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 }, stop: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
