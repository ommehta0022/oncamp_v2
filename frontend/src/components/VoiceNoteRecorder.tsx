import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

import { useTheme } from "@/src/theme/ThemeProvider";

function durationLabel(durationMs: number) {
  const seconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function VoiceNoteRecorder({
  disabled,
  onReady,
}: {
  disabled?: boolean;
  onReady: (uri: string, durationMs: number) => Promise<void> | void;
}) {
  const { colors } = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const [finishing, setFinishing] = useState(false);

  const start = async () => {
    if (disabled || finishing || recorderState.isRecording) return;
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Microphone permission", "Allow microphone access to record a voice note.");
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      Alert.alert("Voice note", "Could not start recording. Please try again.");
    }
  };

  const stop = async () => {
    if (!recorderState.isRecording || finishing) return;
    const durationMs = recorderState.durationMillis || 0;
    setFinishing(true);
    try {
      await recorder.stop();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      const uri = recorder.uri;
      if (!uri || durationMs < 500) {
        if (durationMs < 500) Alert.alert("Voice note", "Hold a little longer before sending.");
        return;
      }
      await onReady(uri, durationMs);
    } catch {
      Alert.alert("Voice note", "Could not finish this voice note. Please try again.");
    } finally {
      setFinishing(false);
    }
  };

  if (recorderState.isRecording) {
    return (
      <View style={[styles.recordingWrap, { backgroundColor: colors.surfaceTertiary }]}> 
        <View style={styles.liveDot} accessibilityLabel="Recording" />
        <Text style={[styles.time, { color: colors.onSurface }]}>{durationLabel(recorderState.durationMillis || 0)}</Text>
        <Pressable
          onPress={() => void stop()}
          disabled={finishing}
          accessibilityRole="button"
          accessibilityLabel="Stop and send voice note"
          style={[styles.stopButton, { backgroundColor: colors.brandPrimary }]}
        >
          {finishing ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={17} color="#fff" />}
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => void start()}
      disabled={disabled || finishing}
      accessibilityRole="button"
      accessibilityLabel="Record voice note"
      accessibilityHint="Starts microphone recording for this group"
      style={[styles.micButton, { backgroundColor: colors.surfaceTertiary, opacity: disabled ? 0.45 : 1 }]}
    >
      {finishing ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : <Ionicons name="mic" size={20} color={colors.brandPrimary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  recordingWrap: {
    minWidth: 118,
    height: 40,
    borderRadius: 20,
    paddingLeft: 12,
    paddingRight: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D64545",
  },
  time: {
    flex: 1,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    fontSize: 13,
  },
  stopButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
