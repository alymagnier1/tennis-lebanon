import { Alert, Platform } from "react-native";

type ConfirmActionOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
};

export function confirmAction({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
}: ConfirmActionOptions): void {
  if (Platform.OS === "web") {
    const prompt = message ? `${title}\n\n${message}` : title;
    if (typeof window !== "undefined" && window.confirm(prompt)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: cancelLabel, style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}
