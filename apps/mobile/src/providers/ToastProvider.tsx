import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../components/AppText";
import { tennisColors, tennisRadii } from "../theme/tennis-tokens";
import { tennisFontFamily } from "../hooks/useTennisFonts";

type ToastContextValue = {
  showToast: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return value;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    setMessage(null);
  }, []);

  const showToast = useCallback(
    (nextMessage: string) => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
      setMessage(nextMessage);
      hideTimer.current = setTimeout(hide, 2800);
    },
    [hide],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <View
          pointerEvents="box-none"
          style={[styles.host, { bottom: insets.bottom + 72 }]}
        >
          <Pressable
            accessibilityRole="alert"
            onPress={hide}
            style={styles.toast}
          >
            <AppText style={styles.toastText}>{message}</AppText>
          </Pressable>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 20,
    right: 20,
    alignItems: "center",
    zIndex: 100,
  },
  toast: {
    maxWidth: 420,
    width: "100%",
    backgroundColor: tennisColors.primaryDark,
    borderRadius: tennisRadii.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toastText: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 14,
    color: tennisColors.white,
    textAlign: "center",
  },
});
