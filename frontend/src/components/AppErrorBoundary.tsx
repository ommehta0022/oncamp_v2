import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type State = { failed: boolean; message: string };

type Props = { children: React.ReactNode };

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      failed: true,
      message: error instanceof Error ? error.message : "The app hit an unexpected screen error.",
    };
  }

  componentDidCatch(error: unknown) {
    if (__DEV__) console.error("OnCampus render error", error);
  }

  private retry = () => this.setState({ failed: false, message: "" });

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.root}>
        <View style={styles.icon}><Ionicons name="refresh-circle" size={34} color="#A67C2E" /></View>
        <Text style={styles.title}>OnCampus is recovering</Text>
        <Text style={styles.body}>A screen could not finish loading. Your account and data are safe. Try opening it again.</Text>
        {__DEV__ && this.state.message ? <Text style={styles.debug}>{this.state.message}</Text> : null}
        <Pressable onPress={this.retry} style={({ pressed }) => [styles.button, pressed && { opacity: 0.82 }]} accessibilityRole="button">
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8F6F1", alignItems: "center", justifyContent: "center", padding: 28 },
  icon: { width: 64, height: 64, borderRadius: 20, backgroundColor: "#F1EBDD", alignItems: "center", justifyContent: "center" },
  title: { marginTop: 18, fontSize: 22, fontWeight: "800", color: "#15130F", textAlign: "center" },
  body: { marginTop: 8, maxWidth: 340, fontSize: 14, lineHeight: 21, color: "#6E6960", textAlign: "center" },
  debug: { marginTop: 12, maxWidth: 340, fontSize: 11, color: "#8E887E", textAlign: "center" },
  button: { marginTop: 22, minWidth: 150, paddingVertical: 13, paddingHorizontal: 24, borderRadius: 999, backgroundColor: "#15130F", alignItems: "center" },
  buttonText: { color: "#FAF8F3", fontSize: 14, fontWeight: "800" },
});
