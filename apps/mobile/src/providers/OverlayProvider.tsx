import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { BackHandler, Platform, StyleSheet, View } from "react-native";

/**
 * Popups drawn as layers inside the app's own window.
 *
 * React Native's `Modal` opens a separate Android window. That window has its
 * own navigation bar, which Android paints white behind a 3-button bar in light
 * mode, so the bar flashed white on every popup (founder, 2026-09-27). The
 * separate window also caused the other popup bugs of that day: content drawn
 * before the window had its size, and positions measured in one window's
 * coordinates used in another's. One window, one navigation bar.
 *
 * `OverlayProvider` wraps the navigator, inside every app-wide provider, so
 * popup content keeps the contexts it had as a `Modal`. `AppOverlay` takes
 * `Modal`'s `visible` / `onRequestClose` / `onShow`.
 */
type OverlayHost = {
  set: (id: string, node: ReactNode | null) => void;
};

const OverlayContext = createContext<OverlayHost | null>(null);

type OverlayEntry = { id: string; node: ReactNode };

export function OverlayProvider({ children }: PropsWithChildren) {
  const [entries, setEntries] = useState<OverlayEntry[]>([]);

  const set = useCallback((id: string, node: ReactNode | null) => {
    setEntries((current) => {
      const index = current.findIndex((entry) => entry.id === id);
      if (node === null) {
        return index === -1
          ? current
          : current.filter((entry) => entry.id !== id);
      }
      if (index === -1) return [...current, { id, node }];
      const next = current.slice();
      next[index] = { id, node };
      return next;
    });
  }, []);

  const host = useMemo(() => ({ set }), [set]);
  const open = entries.length > 0;

  return (
    <OverlayContext.Provider value={host}>
      <ModalBackground hidden={open}>{children}</ModalBackground>
      {/* Opened later, drawn on top: a dialog over a sheet stays above it. */}
      {entries.map((entry) => (
        <OverlayLayer key={entry.id}>{entry.node}</OverlayLayer>
      ))}
    </OverlayContext.Provider>
  );
}

/**
 * The app behind an open popup: hidden from TalkBack and VoiceOver, as a
 * `Modal`'s separate window hid it, so focus cannot wander behind the popup.
 */
export function ModalBackground({
  hidden,
  children,
}: PropsWithChildren<{ hidden: boolean }>) {
  return (
    <View
      style={styles.fill}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
      accessibilityElementsHidden={hidden}
    >
      {children}
    </View>
  );
}

/** A full-screen layer, under the status and navigation bars like the app. */
export function OverlayLayer({ children }: PropsWithChildren) {
  return (
    <View
      style={[styles.layer, Platform.OS === "web" ? styles.layerWeb : null]}
      pointerEvents="box-none"
    >
      {children}
    </View>
  );
}

/**
 * Android back closes the newest open popup first: `BackHandler` calls the
 * most recently added listener first.
 */
export function useOverlayBackAndShow(
  visible: boolean,
  onRequestClose: (() => void) | undefined,
  onShow: (() => void) | undefined,
) {
  const onCloseRef = useRef(onRequestClose);
  const onShowRef = useRef(onShow);
  useLayoutEffect(() => {
    onCloseRef.current = onRequestClose;
    onShowRef.current = onShow;
  });

  useEffect(() => {
    if (!visible) return;
    // Same window, so the layer is on screen on the next frame.
    const frame = requestAnimationFrame(() => onShowRef.current?.());
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onCloseRef.current?.();
        return true;
      },
    );
    return () => {
      cancelAnimationFrame(frame);
      subscription.remove();
    };
  }, [visible]);
}

/** Drop-in for a transparent `Modal`, drawn in the app's own window. */
export function AppOverlay({
  visible,
  onRequestClose,
  onShow,
  children,
}: PropsWithChildren<{
  visible: boolean;
  onRequestClose?: () => void;
  onShow?: () => void;
}>) {
  const host = useContext(OverlayContext);
  const id = useId();

  useOverlayBackAndShow(visible, onRequestClose, onShow);

  // Every render: the content changes with its owner's state.
  useLayoutEffect(() => {
    host?.set(id, visible ? children : null);
  });

  useEffect(() => {
    return () => host?.set(id, null);
  }, [host, id]);

  // Outside a provider (tests, isolated screens): draw in place.
  if (!host) {
    return visible ? <OverlayLayer>{children}</OverlayLayer> : null;
  }
  return null;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  layer: {
    ...StyleSheet.absoluteFill,
  },
  // Above anything else react-native-web positions.
  layerWeb: {
    zIndex: 10050,
  },
});
