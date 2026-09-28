import { useState } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useTranslation } from "react-i18next";
import type { HomeNextAction } from "../../lib/home-next-actions";
import {
  HOME_NEXT_ACTION_END_PADDING,
  HOME_NEXT_ACTION_GAP,
  homeNextActionCardWidth,
  homeNextActionDotProgressRange,
  homeNextActionPageIndex,
  homeNextActionSnapOffsets,
} from "../../lib/home-next-action-carousel";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors } from "../../theme/tennis-tokens";
import { HomeNextActionCard } from "./HomeNextActionCard";

/** Between RN's "fast" (0.99) and "normal" (0.998) — coasts into the snap. */
const CAROUSEL_DECELERATION = 0.994;
const DOT_SIZE = 8;
const DOT_ACTIVE_WIDTH = 18;

const webStripSnap: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({
        scrollSnapType: "x mandatory",
        scrollBehavior: "smooth",
      } as ViewStyle)
    : undefined;
const webItemSnap: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({ scrollSnapAlign: "start" } as ViewStyle)
    : undefined;

export function HomeNextActionsCarousel({
  actions,
  onRematch,
}: {
  actions: HomeNextAction[];
  onRematch: (action: HomeNextAction) => void;
}) {
  const { t } = useTranslation();
  const { writingDirection, rowDirection } = useLayoutDirection();
  const [contentWidth, setContentWidth] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [scrollX] = useState(() => new Animated.Value(0));

  if (actions.length === 0) {
    return null;
  }

  const rematchPress = (action: HomeNextAction) => {
    if (action.kind === "rematch") {
      onRematch(action);
    }
  };

  if (actions.length === 1) {
    const action = actions[0]!;
    return (
      <HomeNextActionCard
        action={action}
        onPress={action.kind === "rematch" ? rematchPress : undefined}
      />
    );
  }

  const cardWidth = homeNextActionCardWidth(contentWidth);

  // Settled offsets only: the dots follow the finger through `scrollX`, so
  // re-rendering mid-swipe would buy nothing but dropped frames.
  const syncPageFromScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const next = homeNextActionPageIndex(
      event.nativeEvent.contentOffset.x,
      cardWidth,
      actions.length,
    );
    setPageIndex((current) => (current === next ? current : next));
  };

  return (
    <View
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        if (width !== contentWidth) {
          setContentWidth(width);
        }
      }}
    >
      {cardWidth > 0 ? (
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate={CAROUSEL_DECELERATION}
          snapToAlignment="start"
          snapToOffsets={homeNextActionSnapOffsets(actions.length, cardWidth)}
          nestedScrollEnabled
          disableIntervalMomentum
          // Width and colour are layout/paint props the native driver cannot
          // animate.
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
          onMomentumScrollEnd={syncPageFromScroll}
          onScrollEndDrag={syncPageFromScroll}
          style={[
            styles.scroll,
            webStripSnap,
            Platform.OS === "web" ? { direction: writingDirection } : null,
          ]}
          contentContainerStyle={[
            styles.strip,
            {
              gap: HOME_NEXT_ACTION_GAP,
              paddingEnd: HOME_NEXT_ACTION_END_PADDING,
            },
          ]}
        >
          {actions.map((action) => (
            <View key={action.id} style={[webItemSnap, { width: cardWidth }]}>
              <HomeNextActionCard
                action={action}
                onPress={action.kind === "rematch" ? rematchPress : undefined}
              />
            </View>
          ))}
        </Animated.ScrollView>
      ) : (
        <HomeNextActionCard
          action={actions[0]!}
          onPress={actions[0]!.kind === "rematch" ? rematchPress : undefined}
        />
      )}
      {/*
        The page count belongs here rather than on the wrapper. A label on the
        wrapper needs `accessible`, and that collapses the whole subtree into
        one element — the cards and their buttons would stop being reachable.
        The dots are non-interactive and already the visual page indicator, so
        grouping them into a single labelled element announces "1 of 3" without
        taking anything away.
      */}
      <View
        style={[styles.dots, { flexDirection: rowDirection }]}
        accessible
        accessibilityLabel={t("home.nextAction.carouselA11y", {
          current: pageIndex + 1,
          total: actions.length,
        })}
      >
        {actions.map((action, index) => {
          if (cardWidth <= 0) {
            return (
              <View
                key={action.id}
                style={[styles.dot, index === 0 ? styles.dotActive : null]}
              />
            );
          }
          const progress = scrollX.interpolate({
            ...homeNextActionDotProgressRange(index, cardWidth),
            extrapolate: "clamp",
          });
          return (
            <Animated.View
              key={action.id}
              style={[
                styles.dot,
                {
                  width: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [DOT_SIZE, DOT_ACTIVE_WIDTH],
                  }),
                  backgroundColor: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [tennisColors.border, tennisColors.violet],
                  }),
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    scroll: {
      flexGrow: 0,
      flexShrink: 0,
    },
    strip: {
      alignItems: "stretch",
    },
    dots: {
      marginTop: 10,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    dot: {
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: DOT_SIZE / 2,
      backgroundColor: tennisColors.border,
    },
    dotActive: {
      width: DOT_ACTIVE_WIDTH,
      backgroundColor: tennisColors.violet,
    },
  }),
);
