import { memo, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../AppText";
import { SemanticBadge } from "../SemanticBadge";
import { Icon } from "../Icon";
import type { MatchListBadge } from "../../lib/match-status-tone";
import { matchCardStatusVisual } from "../../lib/match-card-status";
import { initialsFromName } from "../../lib/avatar-url";
import { useAvatarUrl } from "../../lib/use-avatar-url";
import { useLayoutDirection } from "../../lib/layout-direction";
import { buildCardAccessibilityLabel } from "../../lib/card-accessibility";
import {
  tennisBrand,
  tennisColors,
  tennisSemantic,
  type SemanticTone,
} from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

export type MatchCardProps = {
  status: string;
  statusLabel: string;
  dateTimeLabel?: string;
  headline: string;
  viewerName?: string;
  viewerAvatarPath?: string | null;
  opponentName?: string;
  opponentAvatarPath?: string | null;
  opponentAvatarColor?: string;
  /** Discover open-match card: host avatar beside the name (no vs opponent). */
  hostName?: string;
  hostAvatarPath?: string | null;
  hostAvatarColor?: string;
  formatChip?: string;
  locationChip?: string;
  areaChip?: string;
  badges?: MatchListBadge[];
  scoreBanner?: { won: boolean; score: string; title?: string };
  /** Next job on this card. Replaces the lifecycle status chip when set. */
  actionLabel?: string;
  actionTone?: SemanticTone;
  accentBorder?: boolean;
  note?: string;
  onPress?: () => void;
  /** When set, the action bar is its own control (does not navigate with the card). */
  onActionPress?: () => void;
  footer?: ReactNode;
};

function MatchCardChip({
  label,
  backgroundColor,
  color,
}: {
  label: string;
  backgroundColor: string;
  color: string;
}) {
  return (
    <View style={[styles.chip, { backgroundColor }]}>
      <AppText style={[styles.chipText, { color }]} maxLines={1}>
        {label}
      </AppText>
    </View>
  );
}

function MatchCardAvatar({
  name,
  avatarPath,
  backgroundColor,
  textColor = "#FFFFFF",
}: {
  name: string;
  avatarPath?: string | null;
  backgroundColor: string;
  textColor?: string;
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
    <View style={[styles.avatar, { backgroundColor }]}>
      <AppText style={[styles.avatarText, { color: textColor }]} maxLines={1}>
        {initialsFromName(name)}
      </AppText>
    </View>
  );
}

function PlaceholderOpponentAvatar() {
  return (
    <View style={[styles.avatar, styles.placeholderAvatar]}>
      <AppText style={styles.placeholderAvatarText} maxLines={1}>
        ?
      </AppText>
    </View>
  );
}

function MetaChips({
  statusChip,
  formatChip,
  locationChip,
  areaChip,
  rowDirection,
}: {
  statusChip?: { label: string; backgroundColor: string; color: string };
  formatChip?: string;
  locationChip?: string;
  areaChip?: string;
  rowDirection: "row" | "row-reverse";
}) {
  if (!statusChip && !formatChip && !locationChip && !areaChip) return null;

  return (
    <View style={[styles.chipRow, { flexDirection: rowDirection }]}>
      {statusChip ? (
        <MatchCardChip
          label={statusChip.label}
          backgroundColor={statusChip.backgroundColor}
          color={statusChip.color}
        />
      ) : null}
      {formatChip ? (
        <MatchCardChip
          label={formatChip}
          backgroundColor={tennisSemantic.info.fill}
          color={tennisSemantic.info.text}
        />
      ) : null}
      {locationChip ? (
        <MatchCardChip
          label={locationChip}
          backgroundColor={tennisBrand.whatsappFill}
          color={tennisBrand.whatsappText}
        />
      ) : null}
      {areaChip ? (
        <MatchCardChip
          label={areaChip}
          backgroundColor={tennisColors.secondary}
          color={tennisColors.primary}
        />
      ) : null}
    </View>
  );
}

export const FigmaMatchCard = memo(function FigmaMatchCard({
  status,
  statusLabel,
  dateTimeLabel,
  headline,
  viewerName,
  viewerAvatarPath,
  opponentName,
  opponentAvatarPath,
  opponentAvatarColor = "#7C3AED",
  hostName,
  hostAvatarPath,
  hostAvatarColor = "#7C3AED",
  formatChip,
  locationChip,
  areaChip,
  badges,
  scoreBanner,
  actionLabel,
  actionTone = "actionable",
  accentBorder = false,
  note,
  onPress,
  onActionPress,
  footer,
}: MatchCardProps) {
  const { rowDirection, writingDirection } = useLayoutDirection();
  const statusVisual = matchCardStatusVisual(status);
  const showHostOnly = Boolean(hostName) && !viewerName && !opponentName;
  const showLeadingViewer = Boolean(viewerName);
  const showTrailingOpponent = Boolean(opponentName);
  const showPlayerRow =
    showLeadingViewer || showTrailingOpponent || showHostOnly;

  const accessibilityLabel = buildCardAccessibilityLabel([
    actionLabel ?? statusLabel,
    dateTimeLabel,
    headline,
    ...(badges?.map((entry) => entry.label) ?? []),
    formatChip,
    locationChip,
    areaChip,
    note,
  ]);

  const badgesRow =
    badges && badges.length > 0 ? (
      <View style={[styles.badgeRow, { flexDirection: rowDirection }]}>
        {badges.map((entry) => (
          <SemanticBadge
            key={entry.label}
            label={entry.label}
            tone={entry.tone}
          />
        ))}
      </View>
    ) : null;

  const vsCenterContent = (
    <View style={styles.centerColumn}>
      <AppText
        style={[styles.headline, styles.vsHeadline, { writingDirection }]}
        maxLines={2}
      >
        {headline}
      </AppText>
      {dateTimeLabel ? (
        <AppText
          style={[styles.dateTimeLine, styles.vsHeadline, { writingDirection }]}
          maxLines={1}
        >
          {dateTimeLabel}
        </AppText>
      ) : null}
    </View>
  );

  const metaBelow = (
    <>
      {badgesRow}
      <MetaChips
        statusChip={
          actionLabel
            ? undefined
            : {
                label: statusLabel,
                backgroundColor: statusVisual.pillBg,
                color: statusVisual.pillText,
              }
        }
        formatChip={formatChip}
        locationChip={locationChip}
        areaChip={areaChip}
        rowDirection={rowDirection}
      />
    </>
  );

  const body = (
    <>
      {scoreBanner ? (
        <View
          style={[
            styles.scoreBanner,
            scoreBanner.won ? styles.scoreBannerWin : styles.scoreBannerLoss,
          ]}
        >
          <AppText style={styles.scoreBannerTitle}>
            {scoreBanner.title ?? (scoreBanner.won ? "Victory" : "Defeat")}
          </AppText>
          <AppText style={styles.scoreBannerScore}>{scoreBanner.score}</AppText>
        </View>
      ) : null}

      <View style={styles.body}>
        {showHostOnly ? (
          <View style={styles.hostBlock}>
            <View
              style={[styles.hostIdentity, { flexDirection: rowDirection }]}
            >
              <MatchCardAvatar
                name={hostName!}
                avatarPath={hostAvatarPath}
                backgroundColor={hostAvatarColor}
              />
              <View style={styles.hostCopy}>
                <AppText
                  style={[
                    styles.headline,
                    styles.hostName,
                    { writingDirection },
                  ]}
                  maxLines={1}
                >
                  {headline}
                </AppText>
                {dateTimeLabel ? (
                  <AppText
                    style={[styles.dateTimeLine, { writingDirection }]}
                    maxLines={1}
                  >
                    {dateTimeLabel}
                  </AppText>
                ) : null}
              </View>
            </View>
            {metaBelow}
          </View>
        ) : showPlayerRow ? (
          <View style={styles.vsBlock}>
            <View style={[styles.playerRow, { flexDirection: rowDirection }]}>
              {showLeadingViewer ? (
                <MatchCardAvatar
                  name={viewerName!}
                  avatarPath={viewerAvatarPath}
                  backgroundColor={tennisColors.primary}
                  textColor={tennisColors.lime}
                />
              ) : (
                <View style={styles.avatarSpacer} />
              )}
              {vsCenterContent}
              {showTrailingOpponent ? (
                <MatchCardAvatar
                  name={opponentName!}
                  avatarPath={opponentAvatarPath}
                  backgroundColor={opponentAvatarColor}
                />
              ) : showLeadingViewer ? (
                <PlaceholderOpponentAvatar />
              ) : null}
            </View>
            {metaBelow}
          </View>
        ) : (
          <>
            <AppText
              style={[
                styles.headline,
                styles.headlineStandalone,
                { writingDirection },
              ]}
              maxLines={2}
            >
              {headline}
            </AppText>
            {dateTimeLabel ? (
              <AppText
                style={[
                  styles.dateTimeLine,
                  styles.dateTimeStandalone,
                  { writingDirection },
                ]}
                maxLines={1}
              >
                {dateTimeLabel}
              </AppText>
            ) : null}
            {metaBelow}
          </>
        )}

        {note ? (
          <AppText style={[styles.note, { writingDirection }]} maxLines={2}>
            {note}
          </AppText>
        ) : null}
      </View>
    </>
  );

  const actionHandler = onActionPress ?? onPress;
  const actionBar = actionLabel ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={actionLabel}
      disabled={!actionHandler}
      onPress={actionHandler}
      style={({ pressed }) => [
        styles.actionBar,
        {
          flexDirection: rowDirection,
          backgroundColor: tennisSemantic[actionTone].fill,
          borderTopColor: tennisSemantic[actionTone].border,
        },
        pressed && actionHandler && styles.actionBarPressed,
      ]}
    >
      <AppText
        style={[
          styles.actionBarText,
          {
            color: tennisSemantic[actionTone].text,
            writingDirection,
          },
        ]}
        maxLines={1}
      >
        {actionLabel}
      </AppText>
      <Icon name="chevron" size={16} color={tennisSemantic[actionTone].text} />
    </Pressable>
  ) : null;

  const cardStyle = [
    styles.card,
    accentBorder && {
      borderLeftWidth: 4,
      borderLeftColor: statusVisual.border,
    },
  ];

  if (!onPress) {
    return (
      <View style={cardStyle}>
        {body}
        {actionBar}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    );
  }

  return (
    <View style={cardStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        {body}
      </Pressable>
      {actionBar}
      {/* Outside the card's Pressable on purpose: a footer holds its own
          controls, and nesting a button inside the card's button breaks keyboard
          navigation and screen readers (and is invalid HTML on web). */}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    backgroundColor: tennisColors.card,
    overflow: "hidden",
    shadowColor: "#0D1117",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  footer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  pressed: {
    opacity: 0.94,
  },
  scoreBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scoreBannerWin: {
    backgroundColor: "#047857",
  },
  scoreBannerLoss: {
    backgroundColor: "#DC2626",
  },
  scoreBannerTitle: {
    fontFamily: tennisFontFamily.heading,
    fontSize: 13,
    color: tennisColors.white,
  },
  scoreBannerScore: {
    fontFamily: tennisFontFamily.headingExtra,
    fontSize: 15,
    color: tennisColors.white,
    letterSpacing: -0.3,
  },
  body: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  playerRow: {
    alignItems: "center",
    gap: 12,
  },
  vsBlock: {
    gap: 10,
  },
  hostBlock: {
    gap: 10,
  },
  hostIdentity: {
    alignItems: "center",
    gap: 12,
  },
  hostCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  hostName: {
    minWidth: 0,
  },
  centerColumn: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 2,
  },
  vsHeadline: {
    textAlign: "center",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 14,
    flexShrink: 0,
  },
  avatarSpacer: {
    width: 64,
    height: 64,
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: tennisFontFamily.headingExtra,
    fontSize: 18,
  },
  placeholderAvatar: {
    backgroundColor: "#E2E8F0",
  },
  placeholderAvatarText: {
    fontFamily: tennisFontFamily.headingExtra,
    fontSize: 18,
    color: "#94A3B8",
  },
  headline: {
    fontFamily: tennisFontFamily.heading,
    fontSize: 16,
    lineHeight: 20,
    color: "#0D1117",
    letterSpacing: -0.2,
  },
  headlineStandalone: {
    textAlign: "center",
  },
  dateTimeLine: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    color: tennisColors.mutedForeground,
  },
  dateTimeStandalone: {
    textAlign: "center",
  },
  badgeRow: {
    flexWrap: "wrap",
    gap: 6,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 1,
    maxWidth: "100%",
  },
  chipText: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
  },
  note: {
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    color: tennisColors.mutedForeground,
    textAlign: "left",
  },
  actionBar: {
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  actionBarPressed: {
    opacity: 0.88,
  },
  actionBarText: {
    flex: 1,
    minWidth: 0,
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 13,
    letterSpacing: -0.1,
  },
});
