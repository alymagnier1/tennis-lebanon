import { useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getPublicPlayerCard } from "@tennis-lebanon/api";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { Avatar } from "../AppUi";
import { Icon } from "../Icon";
import { FigmaPrimaryButton, FigmaSecondaryButton } from "../onboarding-ui";
import {
  HOME_NEXT_ACTION_GAP,
  homeNextActionCardWidth,
  homeNextActionPageIndex,
  homeNextActionSnapInterval,
  homeNextActionSnapOffsets,
} from "../../lib/home-next-action-carousel";
import { useLayoutDirection } from "../../lib/layout-direction";
import {
  loopingCarouselItems,
  loopingCarouselJumpCloneIndex,
  loopingCarouselOffsetIsSettled,
  loopingCarouselRealIndex,
  loopingCarouselStartCloneIndex,
} from "../../lib/looping-snap-carousel";
import { publicPlayerLevelChip } from "../../lib/player-level-label";
import { supabase } from "../../lib/supabase";
import { tennisColors } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { hubSectionStyles } from "./hub-section-styles";

const CAROUSEL_DECELERATION = 0.994;

const webStripSnap: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({
        scrollSnapType: "x mandatory",
      } as ViewStyle)
    : undefined;
const webItemSnap: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({ scrollSnapAlign: "start" } as ViewStyle)
    : undefined;

export type HubJoinRequest = {
  user_id: string;
  display_name: string;
  status: string;
  join_note?: string | null;
  avatar_path?: string | null;
};

export function MatchHubJoinRequestCarousel({
  requests,
  rosterFull,
  pendingUserId,
  pendingAccept,
  onApprove,
  onDecline,
}: {
  requests: HubJoinRequest[];
  rosterFull: boolean;
  pendingUserId?: string | null;
  pendingAccept?: boolean | null;
  onApprove: (userId: string) => void;
  onDecline: (userId: string) => void;
}) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const scrollRef = useRef<ScrollView>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);

  const slides = loopingCarouselItems(requests);
  const cardWidth = homeNextActionCardWidth(contentWidth);
  const interval = homeNextActionSnapInterval(cardWidth);
  const startCloneIndex = loopingCarouselStartCloneIndex(requests.length);
  const startOffset = startCloneIndex * interval;

  useEffect(() => {
    if (contentWidth <= 0 || requests.length < 2) return;
    scrollRef.current?.scrollTo({ x: startOffset, y: 0, animated: false });
  }, [contentWidth, requests.length, startOffset]);

  function settleLoop(offsetX: number) {
    if (requests.length < 2 || cardWidth <= 0) return;
    if (!loopingCarouselOffsetIsSettled(offsetX, interval)) return;
    const cloneIndex = homeNextActionPageIndex(
      offsetX,
      cardWidth,
      slides.length,
    );
    const jumpTo = loopingCarouselJumpCloneIndex(cloneIndex, requests.length);
    if (jumpTo == null) return;
    const sign = offsetX < 0 ? -1 : 1;
    scrollRef.current?.scrollTo({
      x: jumpTo * interval * sign,
      y: 0,
      animated: false,
    });
  }

  if (requests.length === 0) return null;

  const title = rosterFull
    ? t("matches.hub.waitlist")
    : t("matches.hub.pendingRequests");

  return (
    <View style={hubSectionStyles.root}>
      <AppText style={hubSectionStyles.sectionLabel}>{title}</AppText>
      {rosterFull ? (
        <AppText style={[styles.hint, { writingDirection }]}>
          {t("matches.hub.waitlistHint")}
        </AppText>
      ) : null}

      {requests.length === 1 ? (
        <RequestCard
          request={requests[0]!}
          rosterFull={rosterFull}
          pendingUserId={pendingUserId}
          pendingAccept={pendingAccept}
          onApprove={onApprove}
          onDecline={onDecline}
        />
      ) : (
        <View
          onLayout={(event) => {
            const width = event.nativeEvent.layout.width;
            if (width !== contentWidth) setContentWidth(width);
          }}
        >
          {contentWidth > 0 ? (
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate={CAROUSEL_DECELERATION}
              snapToAlignment="start"
              snapToOffsets={homeNextActionSnapOffsets(
                slides.length,
                cardWidth,
              )}
              nestedScrollEnabled
              disableIntervalMomentum
              contentOffset={{ x: startOffset, y: 0 }}
              onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
                const offsetX = event.nativeEvent.contentOffset.x;
                const next = loopingCarouselRealIndex(
                  homeNextActionPageIndex(offsetX, cardWidth, slides.length),
                  requests.length,
                );
                setPageIndex((current) => (current === next ? current : next));
                settleLoop(offsetX);
              }}
              onScrollEndDrag={(event) => {
                settleLoop(event.nativeEvent.contentOffset.x);
              }}
              onMomentumScrollEnd={(event) => {
                settleLoop(event.nativeEvent.contentOffset.x);
              }}
              scrollEventThrottle={16}
              style={[
                styles.scroll,
                webStripSnap,
                Platform.OS === "web" ? { direction: writingDirection } : null,
              ]}
              contentContainerStyle={[
                styles.strip,
                { gap: HOME_NEXT_ACTION_GAP },
              ]}
            >
              {slides.map((request, cloneIndex) => (
                <View
                  key={`${cloneIndex}-${request.user_id}`}
                  style={[webItemSnap, { width: cardWidth }]}
                >
                  <RequestCard
                    request={request}
                    rosterFull={rosterFull}
                    pendingUserId={pendingUserId}
                    pendingAccept={pendingAccept}
                    onApprove={onApprove}
                    onDecline={onDecline}
                  />
                </View>
              ))}
            </ScrollView>
          ) : (
            <RequestCard
              request={requests[0]!}
              rosterFull={rosterFull}
              pendingUserId={pendingUserId}
              pendingAccept={pendingAccept}
              onApprove={onApprove}
              onDecline={onDecline}
            />
          )}
          <View
            style={[styles.dots, { flexDirection: rowDirection }]}
            accessible
            accessibilityLabel={t("matches.hub.requestCarouselA11y", {
              current: pageIndex + 1,
              total: requests.length,
            })}
          >
            {requests.map((request, index) => (
              <View
                key={request.user_id}
                style={[
                  styles.dot,
                  index === pageIndex ? styles.dotActive : null,
                ]}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function RequestCard({
  request,
  rosterFull,
  pendingUserId,
  pendingAccept,
  onApprove,
  onDecline,
}: {
  request: HubJoinRequest;
  rosterFull: boolean;
  pendingUserId?: string | null;
  pendingAccept?: boolean | null;
  onApprove: (userId: string) => void;
  onDecline: (userId: string) => void;
}) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const rowPending = pendingUserId === request.user_id;
  const busy = Boolean(pendingUserId);
  const playerCardQuery = useQuery({
    queryKey: ["public-player-card", request.user_id],
    queryFn: () => getPublicPlayerCard(supabase, request.user_id),
  });
  const levelLabel = playerCardQuery.data
    ? publicPlayerLevelChip(playerCardQuery.data, t)
    : null;

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          levelLabel
            ? `${t("discover.openPlayerProfile", {
                name: request.display_name,
              })}. ${levelLabel}`
            : t("discover.openPlayerProfile", {
                name: request.display_name,
              })
        }
        onPress={() =>
          router.push({
            pathname: "/player/[id]",
            params: { id: request.user_id },
          })
        }
        style={({ pressed }) => [
          styles.identity,
          { flexDirection: rowDirection },
          pressed && styles.pressed,
        ]}
      >
        <Avatar
          name={request.display_name}
          avatarPath={request.avatar_path}
          size={56}
        />
        <View style={styles.identityText}>
          <View style={[styles.nameRow, { flexDirection: rowDirection }]}>
            <AppText style={styles.name} maxLines={1}>
              {request.display_name}
            </AppText>
            <Icon
              name="chevron"
              size={14}
              color={tennisColors.mutedForeground}
            />
          </View>
          {levelLabel ? (
            <AppText style={[styles.meta, { writingDirection }]} maxLines={1}>
              {levelLabel}
            </AppText>
          ) : null}
        </View>
      </Pressable>

      {request.join_note ? (
        <AppText style={[styles.note, { writingDirection }]} maxLines={2}>
          {t("matches.invite.noteQuote", { note: request.join_note })}
        </AppText>
      ) : null}

      <View style={[styles.actions, { flexDirection: rowDirection }]}>
        <View style={styles.action}>
          <FigmaPrimaryButton
            label={t("matches.hub.approve")}
            lime
            compact
            disabled={rosterFull || busy}
            loading={rowPending && pendingAccept === true}
            onPress={() => onApprove(request.user_id)}
            style={styles.actionButton}
          />
        </View>
        <View style={styles.action}>
          <FigmaSecondaryButton
            label={t("matches.hub.decline")}
            neutral
            compact
            disabled={busy}
            loading={rowPending && pendingAccept === false}
            onPress={() => onDecline(request.user_id)}
            style={styles.actionButton}
          />
        </View>
      </View>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    hint: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      lineHeight: 16,
      color: tennisColors.mutedForeground,
    },
    scroll: {
      flexGrow: 0,
      flexShrink: 0,
    },
    strip: {
      alignItems: "stretch",
    },
    card: {
      backgroundColor: tennisColors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: tennisColors.border,
      padding: 14,
      gap: 12,
    },
    identity: {
      alignItems: "center",
      gap: 12,
    },
    identityText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    nameRow: {
      alignItems: "center",
      gap: 4,
    },
    name: {
      flexShrink: 1,
      fontFamily: tennisFontFamily.headingMedium,
      fontSize: 15,
      lineHeight: 19,
      color: tennisColors.primaryDark,
    },
    meta: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      lineHeight: 16,
      color: tennisColors.mutedForeground,
    },
    note: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      lineHeight: 18,
      color: tennisColors.primaryDark,
      fontStyle: "italic",
    },
    actions: {
      gap: 8,
    },
    action: {
      flex: 1,
    },
    actionButton: {
      width: "100%",
    },
    pressed: {
      opacity: 0.7,
    },
    dots: {
      marginTop: 10,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: tennisColors.border,
    },
    dotActive: {
      width: 18,
      backgroundColor: tennisColors.primary,
    },
  }),
);
