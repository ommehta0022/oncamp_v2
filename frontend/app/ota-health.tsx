import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/src/theme/ThemeProvider";

const OTA_REPUBLISH_MARKER = "2026-08-27-semantic-ui-refresh-2";

export default function OtaHealthRoute() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.onSurface }]}>OnCampus OTA</Text>
      <Text style={[styles.body, { color: colors.onSurfaceSecondary }]}>Runtime 1.6.6 production update channel verified.</Text>
      <Text accessibilityElementsHidden style={styles.marker}>{OTA_REPUBLISH_MARKER}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 8 },
  body: { fontSize: 15, textAlign: "center" },
  marker: { position: "absolute", width: 1, height: 1, opacity: 0 },
});
