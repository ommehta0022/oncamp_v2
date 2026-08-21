import React from "react";
import { StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";

export default function MessageVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });

  return (
    <View style={styles.wrap} accessible accessibilityLabel="Video attachment">
      <VideoView
        player={player}
        style={styles.video}
        nativeControls
        contentFit="cover"
        allowsFullscreen
        allowsPictureInPicture
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 230, height: 150, borderRadius: 12, overflow: "hidden" },
  video: { width: "100%", height: "100%" },
});
