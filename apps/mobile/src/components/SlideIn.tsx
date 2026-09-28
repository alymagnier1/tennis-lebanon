import { useEffect, useState, type PropsWithChildren } from "react";
import { Animated, Easing } from "react-native";

/** How far new content starts off to the side, in points. */
export const SLIDE_IN_DISTANCE = 48;
export const SLIDE_IN_MS = 240;

/**
 * Slides its content in from one side and fades it in when it mounts. Key it
 * by what it shows, so each new set of content enters instead of popping in.
 *
 * `from`: 1 enters from the end side (moving forward), -1 from the start
 * side (moving back), 0 shows at once (first render). Mirrored in RTL.
 */
export function SlideIn({
  from,
  isRtl = false,
  children,
}: PropsWithChildren<{ from: -1 | 0 | 1; isRtl?: boolean }>) {
  const sign = isRtl ? -from : from;
  const [translateX] = useState(
    () => new Animated.Value(sign * SLIDE_IN_DISTANCE),
  );
  const [opacity] = useState(() => new Animated.Value(from === 0 ? 1 : 0));

  useEffect(() => {
    if (from === 0) return;
    const easing = Easing.out(Easing.cubic);
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: SLIDE_IN_MS,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: SLIDE_IN_MS,
        easing,
        useNativeDriver: true,
      }),
    ]).start();
    // Mount-only: a remount (new key) is what starts the next entrance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateX }] }}>
      {children}
    </Animated.View>
  );
}
