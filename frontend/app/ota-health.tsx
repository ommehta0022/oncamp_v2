import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/src/theme/ThemeProvider";

export default function OtaHealthRoute() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>OnCampus OTA</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>Runtime 1.6.4 control plane verified.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 8 },
  body: { fontSize: 15, textAlign: "center" },
});
