import { Alert, Platform } from "react-native";

let installed = false;

export function installAlertPromptCompat() {
  if (installed || Platform.OS === "ios" || typeof (Alert as any).prompt === "function") return;
  installed = true;
  (Alert as any).prompt = (
    title: string,
    message?: string,
    callbackOrButtons?: ((value: string) => void) | Array<any>,
  ) => {
    const callback = typeof callbackOrButtons === "function" ? callbackOrButtons : undefined;
    Alert.alert(
      title,
      message,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", onPress: () => callback?.("") },
      ],
      { cancelable: true },
    );
  };
}
