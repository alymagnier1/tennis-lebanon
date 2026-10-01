import { useCallback, useEffect, useRef, useState } from "react";
import { Animated } from "react-native";

export const MODAL_FADE_MS = 160;
/** Starts the fade anyway if a platform never fires `onShow`. */
const SHOW_FALLBACK_MS = 300;

/**
 * Keeps modal content invisible until the modal window is actually on screen,
 * then fades it in. Android (new architecture) mounts the content before the
 * dialog window has its final size, so drawing on the first frame shows it
 * jump into place. Pass the result's `onShow` to the `Modal` and put
 * `opacity` on the backdrop and card.
 */
export function useModalFadeIn(visible: boolean, durationMs = MODAL_FADE_MS) {
  const [opacity] = useState(() => new Animated.Value(0));
  const startedRef = useRef(false);

  const onShow = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    requestAnimationFrame(() => {
      Animated.timing(opacity, {
        toValue: 1,
        duration: durationMs,
        useNativeDriver: true,
      }).start();
    });
  }, [durationMs, opacity]);

  useEffect(() => {
    if (!visible) {
      startedRef.current = false;
      opacity.stopAnimation();
      opacity.setValue(0);
      return;
    }
    const fallback = setTimeout(onShow, SHOW_FALLBACK_MS);
    return () => clearTimeout(fallback);
  }, [onShow, opacity, visible]);

  return { opacity, onShow };
}
