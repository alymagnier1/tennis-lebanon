import {
  useLayoutEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  snapStripDragPosition,
  snapStripSettleMs,
  snapStripTargetIndex,
} from "../lib/snap-strip";

export type SnapStripRelease = {
  /** Where the strip was let go, including any pull past an end. */
  position: number;
  /** px/ms, positive toward later cards. */
  velocity: number;
  /** The page the gesture started on. */
  startIndex: number;
  offsets: number[];
  contentWidth: number;
  viewportWidth: number;
};

type SnapStripProps = PropsWithChildren<{
  /** Resting offsets for a measured strip; the first is the start. */
  offsetsFor: (contentWidth: number, viewportWidth: number) => number[];
  /**
   * Called on release before settling. Return true when the gesture was
   * consumed (for example, it switched to another set of cards); the strip
   * then eases back to its nearest page instead of paging.
   */
  onRelease?: (release: SnapStripRelease) => boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}>;

/** Only a clearly sideways drag takes over from the page's vertical scroll. */
function isHorizontalDrag(dx: number, dy: number): boolean {
  return Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2;
}

/**
 * A horizontal strip of cards that follows the finger and eases into the
 * nearest card on release, starting at the release speed.
 *
 * Android only, left-to-right, screen reader off: see `lib/snap-strip.ts` for
 * why React Native's own snapping stops dead on fast swipes. Elsewhere use a
 * `ScrollView`, which snaps smoothly on iOS and the web and which a screen
 * reader can scroll to a focused card.
 */
export function SnapStrip({
  offsetsFor,
  onRelease,
  style,
  contentStyle,
  children,
}: SnapStripProps) {
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [translateX] = useState(() => new Animated.Value(0));

  // PanResponder is created once; it reads everything current through refs.
  const positionRef = useRef(0);
  const dragStartRef = useRef({ position: 0, index: 0 });
  const offsetsRef = useRef<number[]>([0]);
  const sizesRef = useRef({ contentWidth: 0, viewportWidth: 0 });
  const onReleaseRef = useRef(onRelease);

  const offsets =
    contentWidth > 0 && viewportWidth > 0
      ? offsetsFor(contentWidth, viewportWidth)
      : [0];

  // Handed to the gesture handlers after each render, never during it.
  useLayoutEffect(() => {
    onReleaseRef.current = onRelease;
    offsetsRef.current = offsets.length > 0 ? offsets : [0];
    sizesRef.current = { contentWidth, viewportWidth };
  });

  // The initializer only closes over the refs; every read happens in a
  // gesture handler, after render. PanResponder has no hook form to avoid it.
  // eslint-disable-next-line react-hooks/refs
  const [panResponder] = useState(() => {
    const moveTo = (position: number) => {
      positionRef.current = position;
      translateX.setValue(-position);
    };

    const settleTo = (index: number, velocity: number) => {
      const target = offsetsRef.current[index] ?? 0;
      const distance = target - positionRef.current;
      positionRef.current = target;
      Animated.timing(translateX, {
        toValue: -target,
        duration: snapStripSettleMs(distance, velocity),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };

    const release = (vx: number) => {
      const current = offsetsRef.current;
      const position = positionRef.current;
      // Dragging left reveals later cards: forward velocity is -vx.
      const velocity = -vx;
      const consumed =
        onReleaseRef.current?.({
          position,
          velocity,
          startIndex: dragStartRef.current.index,
          offsets: current,
          ...sizesRef.current,
        }) ?? false;
      const index = snapStripTargetIndex({
        offsets: current,
        position,
        velocity: consumed ? 0 : velocity,
      });
      settleTo(index, consumed ? 0 : velocity);
    };

    return PanResponder.create({
      // Capture, so a drag that starts on a card (a Pressable) still pages.
      onMoveShouldSetPanResponderCapture: (_event, gesture) =>
        isHorizontalDrag(gesture.dx, gesture.dy),
      onMoveShouldSetPanResponder: (_event, gesture) =>
        isHorizontalDrag(gesture.dx, gesture.dy),
      onPanResponderGrant: () => {
        // Best guess now (the settle target); the native value arrives
        // asynchronously and corrects it if a settle was still running.
        dragStartRef.current = {
          position: positionRef.current,
          index: snapStripTargetIndex({
            offsets: offsetsRef.current,
            position: positionRef.current,
            velocity: 0,
          }),
        };
        translateX.stopAnimation((value) => {
          positionRef.current = -value;
          dragStartRef.current = {
            position: -value,
            index: snapStripTargetIndex({
              offsets: offsetsRef.current,
              position: -value,
              velocity: 0,
            }),
          };
        });
      },
      onPanResponderMove: (_event, gesture) => {
        const current = offsetsRef.current;
        moveTo(
          snapStripDragPosition({
            raw: dragStartRef.current.position - gesture.dx,
            first: current[0] ?? 0,
            last: current[current.length - 1] ?? 0,
            span: sizesRef.current.viewportWidth,
          }),
        );
      },
      onPanResponderRelease: (_event, gesture) => release(gesture.vx),
      onPanResponderTerminate: (_event, gesture) => release(gesture.vx),
      // Once sideways, keep the gesture: the page must not take it back and
      // scroll vertically mid-swipe.
      onPanResponderTerminationRequest: () => false,
    });
  });

  return (
    <View
      style={[styles.viewport, style]}
      onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
      {...panResponder.panHandlers}
    >
      <Animated.View
        style={[styles.row, contentStyle, { transform: [{ translateX }] }]}
        onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // A row, so the strip is measured at its full width instead of being
  // clipped to the viewport's.
  viewport: {
    flexDirection: "row",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    flexShrink: 0,
  },
});
