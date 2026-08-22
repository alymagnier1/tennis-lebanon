import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import type { MatchHubCard } from "@tennis-lebanon/api";
import { useTranslation } from "react-i18next";
import { AppText } from "../AppText";
import { Avatar } from "../AppUi";
import { formatCompactUtcInBeirut } from "../../lib/beirut-time";
import { useLayoutDirection } from "../../lib/layout-direction";
import {
  matchHubReadyChips,
  pickHubVsSides,
  type HubVsParticipant,
} from "../../lib/match-hub-ready-hero";
import { FigmaPrimaryButton, FigmaTextButton } from "../onboarding-ui";
import { tennisColors, tennisSemantic } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { hubSectionStyles } from "./hub-section-styles";

const AVATAR_SIZE = 72;

type MatchHubReadyHeroProps = {
  hub: Pick<
    MatchHubCard,
    "format" | "intent" | "min_skill" | "max_skill" | "capacity"
  >;
  participants: HubVsParticipant[];
  /** Agreed, booked, or earliest proposed starts_at. Null shows a pending label. */
  startsAt?: string | null;
  onReschedule?: () => void;
  /**
   * Join / invite / continue-setup only. Booking is owned by the preferred
   * clubs section below, and cancelling lives at the foot of the page -- a
   * destructive escape hatch should not sit at the same weight as the action
   * the host actually came here to take.
   */
  primaryLabel?: string;
  primaryLoading?: boolean;
  onPrimary?: () => void;
  /** Own block is not a link: `/player/[id]` is the public card, not your profile. */
  viewerUserId?: string;
};

function PlayerColumn({
  players,
  openSlots,
  viewerUserId,
}: {
  players: HubVsParticipant[];
  openSlots: number;
  viewerUserId?: string;
}) {
  const { t } = useTranslation();
  const slots = [
    ...players.map((player) => ({ kind: "player" as const, player })),
    ...Array.from({ length: openSlots }, (_, index) => ({
      kind: "open" as const,
      key: `open-${index}`,
    })),
  ];

  return (
    <View style={styles.playerColumn}>
      {slots.map((slot) =>
        slot.kind === "player" ? (
          <PlayerBlock
            key={slot.player.user_id}
            player={slot.player}
            isSelf={slot.player.user_id === viewerUserId}
          />
        ) : (
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
}: {
  player: HubVsParticipant;
  isSelf: boolean;
}) {
  const { t } = useTranslation();
  const body = (
    <>
      <Avatar
        name={player.display_name}
        avatarPath={player.avatar_path}
        size={AVATAR_SIZE}
        borderRadius={16}
      />
      <AppText style={styles.playerName} maxLines={1}>
        {player.display_name}
      </AppText>
      <AppText style={styles.playerMeta} maxLines={1}>
        {player.is_creator ? t("matches.hub.hostBadge") : " "}
      </AppText>
    </>
  );

  if (isSelf) {
    return <View style={styles.playerBlock}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      // Same string as the discover list; no reason to duplicate the copy.
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
        styles.playerBlock,
        pressed && styles.playerBlockPressed,
      ]}
    >
      {body}
    </Pressable>
  );
}

export function MatchHubReadyHero({
  hub,
  participants,
  startsAt = null,
  onReschedule,
  primaryLabel,
  primaryLoading = false,
  onPrimary,
  viewerUserId,
}: MatchHubReadyHeroProps) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const chips = matchHubReadyChips(hub, t);
  const sides = pickHubVsSides(participants, hub.capacity);
  const timeLabel = startsAt
    ? formatCompactUtcInBeirut(startsAt)
    : t("matches.hub.timePending");
  const showActions = Boolean(primaryLabel && onPrimary);

  return (
    <View style={hubSectionStyles.root}>
      <View style={styles.card}>
        {chips.length > 0 ? (
          <View style={[styles.chipRow, { flexDirection: rowDirection }]}>
            {chips.map((chip) => (
              <View key={chip} style={styles.chip}>
                <AppText style={styles.chipText} maxLines={2}>
                  {chip}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}

        {chips.length > 0 ? <View style={styles.divider} /> : null}

        <View
          style={[styles.vsRow, { flexDirection: rowDirection }]}
          accessibilityRole="summary"
          accessibilityLabel={`${sides.left
            .map((p) => p.display_name)
            .join(", ")} · ${timeLabel} · ${sides.right
            .map((p) => p.display_name)
            .join(", ")}`}
        >
          <PlayerColumn
            players={sides.left}
            openSlots={sides.leftOpen}
            viewerUserId={viewerUserId}
          />

          <View style={styles.centerColumn}>
            <View style={styles.connector} />
            <AppText
              style={[styles.timeLabel, { writingDirection }]}
              maxLines={2}
            >
              {timeLabel}
            </AppText>
            <View style={styles.connector} />
          </View>

          <PlayerColumn
            players={sides.right}
            openSlots={sides.rightOpen}
            viewerUserId={viewerUserId}
          />
        </View>

        {onReschedule ? (
          <View style={styles.rescheduleRow}>
            <FigmaTextButton
              label={t("matches.hub.reschedule")}
              onPress={onReschedule}
            />
          </View>
        ) : null}

        {showActions ? <View style={styles.divider} /> : null}

        {showActions && primaryLabel && onPrimary ? (
          <FigmaPrimaryButton
            label={primaryLabel}
            loading={primaryLoading}
            onPress={onPrimary}
            style={styles.primaryButton}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...hubSectionStyles.card,
    gap: 14,
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "center",
    gap: 8,
  },
  // Neutral, not accent. These are static facts about the match, and filling
  // them with the attention colour made the three loudest things on the page
  // non-interactive metadata -- while reading as buttons, which they are not.
  chip: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: tennisSemantic.neutral.fill,
    borderWidth: 1,
    borderColor: tennisSemantic.neutral.border,
  },
  chipText: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    color: tennisSemantic.neutral.text,
    textAlign: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tennisColors.border,
    marginHorizontal: -16,
  },
  vsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 2,
  },
  playerColumn: {
    flex: 1,
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  playerBlockPressed: {
    opacity: 0.6,
  },
  playerBlock: {
    alignItems: "center",
    gap: 6,
    width: "100%",
  },
  playerName: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 14,
    color: tennisColors.primaryDark,
    textAlign: "center",
    width: "100%",
  },
  playerMeta: {
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    lineHeight: 16,
    minHeight: 16,
    color: tennisColors.mutedForeground,
    textAlign: "center",
  },
  openSlot: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  openSlotMark: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 28,
    lineHeight: 32,
    color: tennisColors.mutedForeground,
  },
  centerColumn: {
    width: 108,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flexShrink: 0,
    paddingTop: AVATAR_SIZE / 2 - 9,
  },
  connector: {
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: tennisColors.border,
  },
  timeLabel: {
    flexShrink: 1,
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 14,
    lineHeight: 18,
    color: tennisColors.primaryDark,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  rescheduleRow: {
    alignItems: "center",
  },
  primaryButton: {
    width: "100%",
  },
});
