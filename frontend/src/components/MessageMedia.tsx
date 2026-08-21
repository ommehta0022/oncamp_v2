import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { VideoView, useVideoPlayer } from "expo-video";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/colors";

export default function MessageMedia({ type, url }: { type?: string; url?: string }) {
  const { colors } = useTheme();
  if (!url) return null;
  if (type === "audio" || type === "voice") return <VoicePlayer url={url} />;
  if (type === "video") return <VideoMessage url={url} />;
  if (type === "image" || type === "gif") return <Image source={{ uri: url }} style={styles.image} contentFit="cover" transition={120} cachePolicy="memory-disk" />;
  return (
    <Pressable onPress={() => void Linking.openURL(url)} style={[styles.file, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}>
      <Ionicons name="document-text-outline" size={21} color={colors.brandPrimary} />
      <Text style={{ flex: 1, color: colors.onSurface, fontWeight: "600" }}>Open attachment</Text>
      <Ionicons name="open-outline" size={17} color={colors.onSurfaceTertiary} />
    </Pressable>
  );
}

function VoicePlayer({ url }: { url: string }) {
  const { colors } = useTheme();
  const player = useAudioPlayer({ uri: url });
  const status = useAudioPlayerStatus(player);
  const duration = status.duration || 0;
  const current = status.currentTime || 0;
  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  const toggle = () => {
    if (status.playing) player.pause();
    else {
      if (duration > 0 && current >= duration - .1) player.seekTo(0);
      player.play();
    }
  };

  return (
    <View style={[styles.voice, { backgroundColor: colors.surfaceTertiary }]}>
      <Pressable onPress={toggle} style={[styles.play, { backgroundColor: colors.brandPrimary }]} accessibilityRole="button" accessibilityLabel={status.playing ? "Pause voice note" : "Play voice note"}>
        <Ionicons name={status.playing ? "pause" : "play"} size={18} color="#fff" />
      </Pressable>
      <View style={{ flex: 1 }}>
        <View style={[styles.track, { backgroundColor: colors.border }]}><View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: colors.brandPrimary }]} /></View>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 5 }}>{formatTime(status.playing ? current : duration)} · Voice note</Text>
      </View>
    </View>
  );
}

function VideoMessage({ url }: { url: string }) {
  const player = useVideoPlayer({ uri: url, useCaching: true });
  return <VideoView player={player} style={styles.video} nativeControls contentFit="cover" allowsFullscreen surfaceType="textureView" />;
}

function formatTime(seconds: number) {
  const value = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  image: { width: 220, height: 170, borderRadius: radius.md, marginBottom: 5 },
  video: { width: 240, height: 160, borderRadius: radius.md, overflow: "hidden", marginBottom: 5 },
  voice: { width: 230, minHeight: 58, borderRadius: radius.lg, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: 9, marginBottom: 4 },
  play: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  track: { height: 4, borderRadius: 2, overflow: "hidden" }, fill: { height: 4, borderRadius: 2 },
  file: { width: 230, minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderRadius: radius.md },
});
