import { useState } from "react";
import {
  Platform,
  ScrollView,
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
  HOME_NEXT_ACTION_GAP,
  homeNextActionCardWidth,
  homeNextActionPageIndex,
  homeNextActionSnapInterval,
  homeNextActionSnapOffsets,
} from "../../lib/home-next-action-carousel";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors } from "../../theme/tennis-tokens";
import { HomeNextActionCard } from "./HomeNextActionCard";

const webStripSnap: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({ scrollSnapType: "x mandatory" } as ViewStyle)
    : undefined;
const webItemSnap: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({ scrollSnapAlign: "start", scrollSnapStop: "always" } as ViewStyle)
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
  const snapInterval = homeNextActionSnapInterval(cardWidth);

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPageIndex(
      homeNextActionPageIndex(
        event.nativeEvent.contentOffset.x,
        cardWidth,
        actions.length,
      ),
    );
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToAlignment="start"
          snapToInterval={snapInterval}
          snapToOffsets={homeNextActionSnapOffsets(actions.length, cardWidth)}
          nestedScrollEnabled
          disableIntervalMomentum
          onMomentumScrollEnd={onScrollEnd}
          onScrollEndDrag={onScrollEnd}
          style={[
            styles.scroll,
            webStripSnap,
            Platform.OS === "web" ? { direction: writingDirection } : null,
          ]}
          contentContainerStyle={[styles.strip, { gap: HOME_NEXT_ACTION_GAP }]}
        >
          {actions.map((action) => (
            <View key={action.id} style={[webItemSnap, { width: cardWidth }]}>
              <HomeNextActionCard
                action={action}
                onPress={action.kind === "rematch" ? rematchPress : undefined}
              />
            </View>
          ))}
        </ScrollView>
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
        {actions.map((action, index) => (
          <View
            key={action.id}
            style={[styles.dot, index === pageIndex ? styles.dotActive : null]}
          />
        ))}
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
      gap: 8,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: tennisColors.border,
    },
    dotActive: {
      backgroundColor: tennisColors.violet,
    },
  }),
);
