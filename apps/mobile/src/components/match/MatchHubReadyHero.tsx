import { Image, Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { router } from "expo-router";
import type { MatchHubCard } from "@tennis-lebanon/api";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { initialsFromName } from "../../lib/avatar-url";
import { useAvatarUrl } from "../../lib/use-avatar-url";
import { formatHubVsTimeInBeirut } from "../../lib/beirut-time";
import { useLayoutDirection } from "../../lib/layout-direction";
import {
  hubSlotDurationMinutes,
  pickHubVsSides,
  placeHubVsOccupant,
  shortPlayerLabel,
  type HubVsParticipant,
} from "../../lib/match-hub-ready-hero";
import { matchHubLevelSummary } from "../../lib/match-hub-summaries";
import { FigmaPrimaryButton } from "../onboarding-ui";
import { tennisColors, tennisHeroArt } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { hubSectionStyles } from "./hub-section-styles";

const AVATAR_SIZE = 72;
const AVATAR_RADIUS = 16;
const CARD_PAD = 12;
const CHROME_LINE = 16;

type MatchHubReadyHeroProps = {
  hub: Pick<
    MatchHubCard,
    "format" | "intent" | "min_skill" | "max_skill" | "capacity"
  >;
  participants: HubVsParticipant[];
  /** Agreed, booked, or earliest proposed starts_at. Null shows a pending label. */
  startsAt?: string | null;
  endsAt?: string | null;
  /**
   * First-in-queue requester occupying a dashed seat. Host-only; visitors
   * never see other people's pending asks in the roster.
   */
  slotOccupant?: HubVsParticipant | null;
  onReschedule?: () => void;
  /**
   * Join / continue-setup only. Invite sits in the header; booking is owned
   * by preferred clubs; cancel lives in the page footer.
   */
  primaryLabel?: string;
  primaryLoading?: boolean;
  onPrimary?: () => void;
  /** Compact header control while the host still has an open seat. */
  onInvite?: () => void;
  /** Own block is not a link: `/player/[id]` is the public card, not your profile. */
  viewerUserId?: string;
  /** Host-only: take an accepted player off the roster before start. */
  onRemovePlayer?: (player: HubVsParticipant) => void;
};

function HubVsAvatar({
  name,
  avatarPath,
  isHost,
}: {
  name: string;
  avatarPath?: string | null;
  isHost: boolean;
}) {
  const avatarQuery = useAvatarUrl(avatarPath ?? null);
  const uri = avatarQuery.data;

  if (uri) {
    return (
      <Image
        accessibilityLabel={name}
        source={{ uri }}
        style={styles.avatarImage}
      />
    );
  }

  return (
    <View
      style={[
        styles.avatarFallback,
        {
          backgroundColor: isHost
            ? tennisHeroArt.heroGreen
            : tennisColors.accent,
        },
      ]}
    >
      <AppText
        style={[
          styles.avatarInitials,
          { color: isHost ? tennisColors.lime : tennisColors.white },
        ]}
        maxLines={1}
      >
        {initialsFromName(name)}
      </AppText>
    </View>
  );
}

function PlayerColumn({
  players,
  openSlots,
  occupant,
  occupantCaption,
  viewerUserId,
  onRemovePlayer,
}: {
  players: HubVsParticipant[];
  openSlots: number;
  occupant?: HubVsParticipant | null;
  occupantCaption?: string;
  viewerUserId?: string;
  onRemovePlayer?: (player: HubVsParticipant) => void;
}) {
  const { t } = useTranslation();
  const slots = [
    ...players.map((player) => ({ kind: "player" as const, player })),
    ...(occupant ? [{ kind: "request" as const, player: occupant }] : []),
    ...Array.from({ length: openSlots }, (_, index) => ({
      kind: "open" as const,
      key: `open-${index}`,
    })),
  ];

  return (
    <View style={styles.playerColumn}>
      {slots.map((slot) =>
        slot.kind === "open" ? (
          <View key={slot.key} style={styles.playerBlock}>
            <View
              style={styles.openSlot}
              accessibilityLabel={t("matches.hub.openPlayerSlot")}
            >
              <AppText style={styles.openSlotMark}>?</AppText>
            </View>
            <AppText style={styles.playerName} maxLines={1}>
              {t("matches.hub.openPlayerSlot")}
            </AppText>
            <AppText style={styles.playerMeta} maxLines={1}>
              {" "}
            </AppText>
          </View>
        ) : (
          <PlayerBlock
            key={slot.player.user_id}
            player={slot.player}
            isSelf={slot.player.user_id === viewerUserId}
            caption={slot.kind === "request" ? occupantCaption : undefined}
            onRemove={
              slot.kind === "player" &&
              onRemovePlayer &&
              !slot.player.is_creator
                ? () => onRemovePlayer(slot.player)
                : undefined
            }
          />
        ),
      )}
    </View>
  );
}

/**
 * The hero replaces the roster list whenever it renders, so these are the only
 * player cards on the screen -- and the only route from a match to someone's
 * profile, which is where report and block live.
 */
function PlayerBlock({
  player,
  isSelf,
  caption,
  onRemove,
}: {
  player: HubVsParticipant;
  isSelf: boolean;
  caption?: string;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const meta = caption
    ? caption
    : player.is_creator
      ? t("matches.hub.hostBadge")
      : " ";
  const identity = (
    <>
      <HubVsAvatar
        name={player.display_name}
        avatarPath={player.avatar_path}
        isHost={Boolean(player.is_creator)}
      />
      <AppText style={styles.playerName} maxLines={1}>
        {shortPlayerLabel(player.display_name)}
      </AppText>
    </>
  );

  const identityNode = isSelf ? (
    identity
  ) : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("discover.openPlayerProfile", {
        name: player.display_name,
      })}
      onPress={() =>
        router.push({
          pathname: "/player/[id]",
          params: { id: player.user_id },
        })
      }
      style={({ pressed }) => [
        styles.playerIdentity,
        pressed && styles.playerBlockPressed,
      ]}
    >
      {identity}
    </Pressable>
  );

  return (
    <View style={styles.playerBlock}>
      {identityNode}
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("matches.hub.removePlayerA11y", {
            name: player.display_name,
          })}
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [
            styles.removeControl,
            pressed && styles.playerBlockPressed,
          ]}
        >
          <AppText style={styles.removeLabel} maxLines={1}>
            {t("matches.hub.removePlayer")}
          </AppText>
        </Pressable>
      ) : (
        <AppText style={styles.playerMeta} maxLines={1}>
          {meta}
        </AppText>
      )}
    </View>
  );
}

export function MatchHubReadyHero({
  hub,
  participants,
  startsAt = null,
  endsAt = null,
  slotOccupant = null,
  onReschedule,
  primaryLabel,
  primaryLoading = false,
  onPrimary,
  onInvite,
  viewerUserId,
  onRemovePlayer,
}: MatchHubReadyHeroProps) {
  const { t, i18n } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const levelLabel = matchHubLevelSummary(hub, t);
  const sides = placeHubVsOccupant(
    pickHubVsSides(participants, hub.capacity),
    slotOccupant,
  );
  const timeLabel = startsAt
    ? formatHubVsTimeInBeirut(startsAt, locale)
    : t("matches.hub.timePending");
  const durationMinutes = hubSlotDurationMinutes(startsAt, endsAt);
  const showActions = Boolean(primaryLabel && onPrimary);
  const occupantCaption = t("matches.hub.wantsToJoin");
  const a11yRight = [
    ...sides.right.map((p) => p.display_name),
    sides.rightOccupant?.display_name,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <View style={hubSectionStyles.root}>
      <View
        style={[styles.card, (levelLabel || onInvite) && styles.cardWithChrome]}
        accessibilityRole="summary"
        accessibilityLabel={`${sides.left
          .map((p) => p.display_name)
          .join(", ")} · ${levelLabel} · ${timeLabel} · ${a11yRight}`}
      >
        {levelLabel ? (
          <AppText
            style={[
              styles.levelLabel,
              {
                writingDirection,
                ...(rowDirection === "row"
                  ? { left: CARD_PAD }
                  : { right: CARD_PAD }),
              },
            ]}
            maxLines={1}
          >
            {levelLabel}
          </AppText>
        ) : null}
        {onInvite ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("matches.invite.invitePlayer")}
            onPress={onInvite}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            style={({ pressed }) => [
              styles.invite,
              rowDirection === "row" ? { right: CARD_PAD } : { left: CARD_PAD },
              pressed && styles.playerBlockPressed,
            ]}
          >
            <AppText style={styles.inviteLabel} maxLines={1}>
              {t("matches.invite.invitePlayer")}
            </AppText>
          </Pressable>
        ) : null}

        <View style={[styles.vsRow, { flexDirection: rowDirection }]}>
          <PlayerColumn
            players={sides.left}
            openSlots={sides.leftOpen}
            occupant={sides.leftOccupant}
            occupantCaption={occupantCaption}
            viewerUserId={viewerUserId}
            onRemovePlayer={onRemovePlayer}
          />

          <View style={styles.centerColumn}>
            <AppText
              style={[styles.timeLabel, { writingDirection }]}
              maxLines={1}
            >
              {timeLabel}
            </AppText>
            {durationMinutes ? (
              <AppText style={[styles.duration, { writingDirection }]}>
                {t("matches.hub.durationMinutes", { minutes: durationMinutes })}
              </AppText>
            ) : null}
            {onReschedule ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("matches.hub.changeTime")}
                onPress={onReschedule}
                style={({ pressed }) => [
                  styles.changeTime,
                  pressed && styles.playerBlockPressed,
                ]}
              >
                <AppText style={styles.changeTimeLabel} maxLines={1}>
                  {t("matches.hub.changeTime")}
                </AppText>
              </Pressable>
            ) : null}
          </View>

          <PlayerColumn
            players={sides.right}
            openSlots={sides.rightOpen}
            occupant={sides.rightOccupant}
            occupantCaption={occupantCaption}
            viewerUserId={viewerUserId}
            onRemovePlayer={onRemovePlayer}
          />
        </View>

        {showActions && primaryLabel && onPrimary ? (
          <FigmaPrimaryButton
            label={primaryLabel}
            loading={primaryLoading}
            onPress={onPrimary}
            lime
            style={styles.primaryButton}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    card: {
      backgroundColor: tennisColors.secondary,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: tennisColors.border,
      padding: CARD_PAD,
      gap: 8,
    },
    cardWithChrome: {
      paddingTop: CARD_PAD + CHROME_LINE + CARD_PAD,
    },
    levelLabel: {
      position: "absolute",
      top: CARD_PAD,
      maxWidth: "58%",
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      lineHeight: CHROME_LINE,
      color: tennisColors.mutedForeground,
    },
    invite: {
      position: "absolute",
      top: CARD_PAD,
      zIndex: 1,
    },
    inviteLabel: {
      fontFamily: tennisFontFamily.heading,
      fontSize: 14,
      lineHeight: CHROME_LINE,
      color: tennisColors.linkText,
      textDecorationLine: "underline",
      textDecorationColor: tennisColors.linkUnderline,
    },
    vsRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    playerColumn: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      gap: 8,
    },
    playerBlockPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.985 }],
    },
    playerBlock: {
      alignItems: "center",
      gap: 8,
      width: "100%",
    },
    playerIdentity: {
      alignItems: "center",
      width: "100%",
      gap: 8,
    },
    avatarImage: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_RADIUS,
    },
    avatarFallback: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_RADIUS,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitials: {
      fontFamily: tennisFontFamily.headingExtra,
      fontSize: 24,
    },
    playerName: {
      fontFamily: tennisFontFamily.headingMedium,
      fontSize: 15,
      lineHeight: 19,
      color: tennisColors.primaryDark,
      textAlign: "center",
      width: "100%",
    },
    playerMeta: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      lineHeight: 15,
      minHeight: 15,
      marginTop: -6,
      color: tennisColors.mutedForeground,
      textAlign: "center",
    },
    removeControl: {
      minHeight: 32,
      marginTop: -6,
      alignItems: "center",
      justifyContent: "center",
    },
    removeLabel: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 12,
      lineHeight: 15,
      color: tennisColors.danger,
      textAlign: "center",
      textDecorationLine: "underline",
      textDecorationColor: tennisColors.danger,
    },
    openSlot: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_RADIUS,
      borderWidth: 1.5,
      borderStyle: "dashed",
      // heroMint was 1.6:1 against the `muted` fill in light mode -- a boundary
      // that needs 3:1 to be seen. This is an empty-seat affordance, not art.
      borderColor: tennisColors.mutedForeground,
      backgroundColor: tennisColors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    openSlotMark: {
      fontFamily: tennisFontFamily.headingSemi,
      fontSize: 24,
      lineHeight: 28,
      color: tennisColors.mutedForeground,
    },
    centerColumn: {
      width: 110,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 4,
      flexShrink: 0,
      paddingTop: 10,
    },
    timeLabel: {
      fontFamily: tennisFontFamily.headingSemi,
      fontSize: 17,
      lineHeight: 22,
      color: tennisColors.primaryDark,
      textAlign: "center",
      letterSpacing: -0.3,
    },
    duration: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      color: tennisColors.mutedForeground,
      textAlign: "center",
    },
    changeTime: {
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    changeTimeLabel: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 13,
      color: tennisColors.linkText,
      textDecorationLine: "underline",
      textDecorationColor: tennisColors.linkUnderline,
    },
    primaryButton: {
      width: "100%",
    },
  }),
);
