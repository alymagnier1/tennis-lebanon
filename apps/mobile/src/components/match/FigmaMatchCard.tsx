import { memo, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { AppText } from "../AppText";
import { SemanticBadge } from "../SemanticBadge";
import { Icon, type IconName } from "../Icon";
import type { MatchListBadge } from "../../lib/match-status-tone";
import { matchCardStatusVisual } from "../../lib/match-card-status";
import { initialsFromName } from "../../lib/avatar-url";
import { useAvatarUrl } from "../../lib/use-avatar-url";
import { useLayoutDirection } from "../../lib/layout-direction";
import { buildCardAccessibilityLabel } from "../../lib/card-accessibility";
import { useTennisTheme } from "../../providers/ThemeProvider";
import { tennisColors, type SemanticTone } from "../../theme/tennis-tokens";
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
  /** Host-only cards: skill band (or range) on the trailing edge. */
  levelChip?: string;
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
  /**
   * Corner dismiss. Only for a match the viewer hosts and can still call off --
   * cancelling otherwise means opening the match and scrolling to the bottom,
   * which is a long way to go for something the three-match cap can require.
   */
  onDismiss?: () => void;
  dismissLabel?: string;
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

function FooterMetaItem({
  icon,
  label,
  writingDirection,
  rowDirection,
}: {
  icon: IconName;
  label: string;
  writingDirection: "ltr" | "rtl";
  rowDirection: "row" | "row-reverse";
}) {
  return (
    <View style={[styles.footerMetaItem, { flexDirection: rowDirection }]}>
      <Icon name={icon} size={16} color={tennisColors.mutedForeground} />
      <AppText
        style={[styles.footerMetaText, { writingDirection }]}
        maxLines={1}
      >
        {label}
      </AppText>
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
  levelChip,
  badges,
  scoreBanner,
  actionLabel,
  actionTone: _actionTone = "actionable",
  accentBorder = false,
  note,
  onPress,
  onActionPress,
  onDismiss,
  dismissLabel,
  footer,
}: MatchCardProps) {
  const { rowDirection, writingDirection } = useLayoutDirection();
  const { scheme } = useTennisTheme();
  const isDark = scheme === "dark";
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
    levelChip,
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
    </View>
  );

  const statusChip = actionLabel ? null : (
    <View style={[styles.chipRow, { flexDirection: rowDirection }]}>
      <MatchCardChip
        label={statusLabel}
        backgroundColor={statusVisual.pillBg}
        color={statusVisual.pillText}
      />
    </View>
  );

  const metaBelow = (
    <>
      {badgesRow}
      {statusChip}
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
              </View>
              {levelChip || formatChip || areaChip ? (
                <View
                  style={[
                    styles.hostSideMeta,
                    {
                      alignItems:
                        rowDirection === "row" ? "flex-end" : "flex-start",
                    },
                  ]}
                >
                  {levelChip ? (
                    <AppText
                      style={[
                        styles.hostSideText,
                        {
                          writingDirection,
                          textAlign: rowDirection === "row" ? "right" : "left",
                        },
                      ]}
                      maxLines={2}
                    >
                      {levelChip}
                    </AppText>
                  ) : (
                    <>
                      {formatChip ? (
                        <AppText
                          style={[
                            styles.hostSideText,
                            {
                              writingDirection,
                              textAlign:
                                rowDirection === "row" ? "right" : "left",
                            },
                          ]}
                          maxLines={1}
                        >
                          {formatChip}
                        </AppText>
                      ) : null}
                      {areaChip ? (
                        <AppText
                          style={[
                            styles.hostSideText,
                            {
                              writingDirection,
                              textAlign:
                                rowDirection === "row" ? "right" : "left",
                            },
                          ]}
                          maxLines={1}
                        >
                          {areaChip}
                        </AppText>
                      ) : null}
                    </>
                  )}
                </View>
              ) : null}
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
  const hasFooterMeta = Boolean(dateTimeLabel || locationChip);
  const actionBar =
    actionLabel || hasFooterMeta || onDismiss ? (
      <View style={[styles.actionFooter, { flexDirection: rowDirection }]}>
        {hasFooterMeta ? (
          <View style={styles.footerMeta}>
            {dateTimeLabel ? (
              <View
                style={[styles.footerMetaRow, { flexDirection: rowDirection }]}
              >
                <FooterMetaItem
                  icon="calendar"
                  label={dateTimeLabel}
                  writingDirection={writingDirection}
                  rowDirection={rowDirection}
                />
              </View>
            ) : null}
            {locationChip ? (
              <View
                style={[styles.footerMetaRow, { flexDirection: rowDirection }]}
              >
                <FooterMetaItem
                  icon="court"
                  label={locationChip}
                  writingDirection={writingDirection}
                  rowDirection={rowDirection}
                />
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.footerMeta} />
        )}
        {actionLabel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            disabled={!actionHandler}
            onPress={actionHandler}
            hitSlop={{ top: 6, bottom: 6 }}
            style={({ pressed }) => [
              styles.actionPill,
              isDark && styles.actionPillDark,
              pressed && actionHandler && styles.actionPillPressed,
            ]}
          >
            <AppText
              style={[
                styles.actionPillText,
                { writingDirection },
                isDark && styles.actionPillTextDark,
              ]}
              maxLines={1}
            >
              {actionLabel}
            </AppText>
          </Pressable>
        ) : null}
        {onDismiss ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={dismissLabel}
            onPress={onDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.dismiss,
              pressed && styles.dismissPressed,
            ]}
          >
            <Icon name="close" size={16} color={tennisColors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
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

const styles = createLiveSheet(() =>
  StyleSheet.create({
    dismiss: {
      flexShrink: 0,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tennisColors.border,
      backgroundColor: tennisColors.card,
    },
    dismissPressed: {
      opacity: 0.7,
    },
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
    },
    hostName: {
      minWidth: 0,
    },
    hostSideMeta: {
      flexShrink: 1,
      maxWidth: "46%",
      alignSelf: "flex-start",
      paddingTop: 2,
      gap: 1,
    },
    hostSideText: {
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      lineHeight: 17,
      color: tennisColors.mutedForeground,
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
      color: tennisColors.primaryDark,
      letterSpacing: -0.2,
    },
    headlineStandalone: {
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
    actionFooter: {
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: tennisColors.muted,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tennisColors.border,
    },
    footerMeta: {
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    footerMetaRow: {
      alignItems: "center",
      gap: 14,
      flexWrap: "wrap",
    },
    footerMetaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexShrink: 1,
      maxWidth: "100%",
    },
    footerMetaText: {
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 14,
      lineHeight: 18,
      color: tennisColors.mutedForeground,
      flexShrink: 1,
    },
    actionPill: {
      flexShrink: 0,
      minHeight: 36,
      minWidth: 120,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: tennisColors.white,
    },
    actionPillDark: {
      backgroundColor: tennisColors.violet,
    },
    actionPillPressed: {
      opacity: 0.88,
    },
    actionPillText: {
      fontFamily: tennisFontFamily.headingSemi,
      fontSize: 13,
      letterSpacing: -0.1,
      color: tennisColors.limeText,
      textAlign: "center",
    },
    actionPillTextDark: {
      color: tennisColors.onViolet,
    },
  }),
);
