import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { reportError } from "../lib/sentry";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

/**
 * Catches render errors that would otherwise leave the app on a blank screen
 * with no way out.
 *
 * The fallback deliberately uses no translations, no theme tokens, and no
 * provider state. If the locale bundle or the token module is what threw, a
 * translated or themed fallback would fail while rendering the failure and put
 * us back at the blank screen this exists to prevent.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    void reportError(error, { componentStack: info.componentStack });
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });

    // Send the player somewhere known-good rather than back into the screen
    // that just threw, which would usually throw again immediately.
    try {
      router.replace("/(tabs)");
    } catch {
      // Navigation can itself be what broke. Clearing the error state above is
      // still worth attempting on its own.
    }
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          The app hit an unexpected error. Your matches and messages are safe.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try again"
          onPress={this.handleRetry}
          style={styles.button}
        >
          <Text style={styles.buttonLabel}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1a1a1a",
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: "#4a4a4a",
    textAlign: "center",
  },
  button: {
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 24,
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#0d76b0",
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
});
