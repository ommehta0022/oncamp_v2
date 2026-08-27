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
        <View style={styles.icon}><Ionicons name="refresh-circle" size={34} color="#2E5C4E" /></View>
        <Text style={styles.title}>OnCampus is recovering</Text>
        <Text style={styles.body}>A screen could not finish loading. Your account and data are safe. Try opening it again.</Text>
        {__DEV__ && this.state.message ? <Text style={styles.debug}>{this.state.message}</Text> : null}
        <Pressable onPress={this.retry} style={styles.button} accessibilityRole="button">
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F9F8F6", alignItems: "center", justifyContent: "center", padding: 28 },
  icon: { width: 64, height: 64, borderRadius: 20, backgroundColor: "#E7EFEA", alignItems: "center", justifyContent: "center" },
  title: { marginTop: 18, fontSize: 22, fontWeight: "800", color: "#181A19", textAlign: "center" },
  body: { marginTop: 8, maxWidth: 340, fontSize: 14, lineHeight: 21, color: "#4A4D4C", textAlign: "center" },
  debug: { marginTop: 12, maxWidth: 340, fontSize: 11, color: "#8A8D8B", textAlign: "center" },
  button: { marginTop: 22, minWidth: 150, paddingVertical: 13, paddingHorizontal: 24, borderRadius: 14, backgroundColor: "#2E5C4E", alignItems: "center" },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
