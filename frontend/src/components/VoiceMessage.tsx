import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

import { useTheme } from "@/src/theme/ThemeProvider";

function formatSeconds(value: number) {
  const seconds = Math.max(0, Math.floor(value || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function VoiceMessage({ uri, own }: { uri: string; own?: boolean }) {
  const { colors } = useTheme();
  const player = useAudioPlayer(uri, { updateInterval: 250, downloadFirst: true });
  const status = useAudioPlayerStatus(player);
  const duration = Number(status.duration || 0);
  const current = Number(status.currentTime || 0);
  const progress = duration > 0 ? Math.max(0, Math.min(1, current / duration)) : 0;
  const foreground = own ? "#FFFFFF" : colors.brandPrimary;
  const muted = own ? "rgba(255,255,255,0.72)" : colors.onSurfaceTertiary;

  const toggle = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (duration > 0 && current >= duration - 0.15) {
      await player.seekTo(0);
    }
    player.play();
  };

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => void toggle()}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? "Pause voice note" : "Play voice note"}
        style={[styles.play, { borderColor: foreground }]}
      >
        <Ionicons name={status.playing ? "pause" : "play"} size={16} color={foreground} />
      </Pressable>
      <View style={styles.body}>
        <View style={[styles.track, { backgroundColor: own ? "rgba(255,255,255,0.22)" : colors.border }]}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: foreground }]} />
        </View>
        <View style={styles.meta}>
          <Ionicons name="mic" size={12} color={muted} />
          <Text style={[styles.time, { color: muted }]}>{formatSeconds(status.playing ? current : (current || duration))}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minWidth: 190,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 2,
  },
  play: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 6 },
  track: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: 4, borderRadius: 2 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  time: { fontSize: 11, fontVariant: ["tabular-nums"] },
});
