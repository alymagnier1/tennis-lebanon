import { Alert, Platform } from "react-native";

/**
 * `Alert` is a no-op on react-native-web. Route user-facing confirms through
 * ConfirmDialogProvider when mounted; fall back to Alert / window APIs in tests.
 */

export type ChooseActionOptions = {
  title: string;
  message: string;
  /** Taken on confirm — the option that continues what already exists. */
  confirmLabel: string;
  onConfirm: () => void;
  /**
   * Taken on dismiss. Web collapses three native buttons to confirm/cancel, so
   * this must stay the safe branch rather than a second destructive action.
   */
  cancelLabel: string;
  onCancel?: () => void;
};

export type CancelMatchDialogOptions = {
  title: string;
  message: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  reasonRequired: boolean;
  reasonRequiredMessage: string;
  showReasonField?: boolean;
  submitLabel: string;
  dismissLabel: string;
  onSubmit: (reason: string) => void | Promise<void>;
  onDismiss?: () => void;
};

type ConfirmPresenters = {
  notify: (title: string, message?: string) => void;
  chooseAction: (options: ChooseActionOptions) => void;
  cancelMatchDialog: (options: CancelMatchDialogOptions) => void;
};

let presenters: ConfirmPresenters | null = null;

export function registerConfirmPresenters(next: ConfirmPresenters | null): void {
  presenters = next;
}

/** Single-message notice. */
export function notify(title: string, message?: string): void {
  if (presenters) {
    presenters.notify(title, message);
    return;
  }

  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.alert(message ? `${title}\n\n${message}` : title);
    }
    return;
  }

  Alert.alert(title, message);
}

/**
 * Two named actions plus a dismiss. On web `window.confirm` only offers two
 * outcomes, so confirm runs `onConfirm` and cancel runs `onCancel`.
 */
export function chooseAction(options: ChooseActionOptions): void {
  if (presenters) {
    presenters.chooseAction(options);
    return;
  }

  if (Platform.OS === "web") {
    if (typeof window === "undefined") return;
    if (window.confirm(options.message ? `${options.title}\n\n${options.message}` : options.title)) {
      options.onConfirm();
    } else {
      options.onCancel?.();
    }
    return;
  }

  Alert.alert(options.title, options.message, [
    { text: options.cancelLabel, onPress: options.onCancel },
    { text: options.confirmLabel, onPress: options.onConfirm },
  ]);
}

/** Cancel match with optional reason field — requires ConfirmDialogProvider. */
export function presentCancelMatchDialog(options: CancelMatchDialogOptions): void {
  if (presenters?.cancelMatchDialog) {
    presenters.cancelMatchDialog(options);
    return;
  }

  if (Platform.OS === "web") {
    if (typeof window === "undefined") return;
    if (
      !window.confirm(
        options.message ? `${options.title}\n\n${options.message}` : options.title,
      )
    ) {
      options.onDismiss?.();
      return;
    }
    void options.onSubmit("");
    return;
  }

  Alert.alert(options.title, options.message, [
    { text: options.dismissLabel, onPress: options.onDismiss },
    {
      text: options.submitLabel,
      onPress: () => void options.onSubmit(""),
    },
  ]);
}

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
  chooseAction({
    title,
    message,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel: undefined,
  });
}
