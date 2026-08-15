import { memo, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../AppText";
import { SemanticBadge } from "../SemanticBadge";
import type { MatchListBadge } from "../../lib/match-status-tone";
import { matchCardStatusVisual } from "../../lib/match-card-status";
import { initialsFromName } from "../../lib/avatar-url";
import { useAvatarUrl } from "../../lib/use-avatar-url";
import { useLayoutDirection } from "../../lib/layout-direction";
import { buildCardAccessibilityLabel } from "../../lib/card-accessibility";
import {
  tennisBrand,
  tennisColors,
  tennisRadii,
  tennisSemantic,
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
  accentBorder?: boolean;
  note?: string;
  onPress?: () => void;
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
  accentBorder = false,
  note,
  onPress,
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
    statusLabel,
    dateTimeLabel,
    headline,
    ...(badges?.map((entry) => entry.label) ?? []),
    formatChip,
    locationChip,
    areaChip,
    note,
  ]);

  const centerContent = (
    <View style={styles.centerColumn}>
      <AppText style={[styles.headline, { writingDirection }]} maxLines={2}>
        {headline}
      </AppText>
      {badges && badges.length > 0 ? (
        <View style={[styles.badgeRow, { flexDirection: rowDirection }]}>
          {badges.map((entry) => (
            <SemanticBadge
              key={entry.label}
              label={entry.label}
              tone={entry.tone}
            />
          ))}
        </View>
      ) : null}
      {formatChip || locationChip || areaChip ? (
        <View style={[styles.chipRow, { flexDirection: rowDirection }]}>
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
          {formatChip ? (
            <MatchCardChip
              label={formatChip}
              backgroundColor={tennisSemantic.info.fill}
              color={tennisSemantic.info.text}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const content = (
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
        <View style={[styles.topRow, { flexDirection: rowDirection }]}>
          {dateTimeLabel ? (
            <View style={[styles.dateRow, { flexDirection: rowDirection }]}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: statusVisual.dot },
                ]}
              />
              <AppText
                style={[styles.dateText, { writingDirection }]}
                maxLines={1}
              >
                {dateTimeLabel}
              </AppText>
            </View>
          ) : (
            <View style={styles.topRowSpacer} />
          )}
          <View
            style={[
              styles.statusPill,
              { backgroundColor: statusVisual.pillBg },
            ]}
          >
            <AppText
              style={[styles.statusPillText, { color: statusVisual.pillText }]}
              maxLines={1}
            >
              {statusLabel}
            </AppText>
          </View>
        </View>

        {showPlayerRow ? (
          <View
            style={[
              styles.playerRow,
              showHostOnly && styles.playerRowHost,
              { flexDirection: rowDirection },
            ]}
          >
            {showHostOnly ? (
              <MatchCardAvatar
                name={hostName!}
                avatarPath={hostAvatarPath}
                backgroundColor={hostAvatarColor}
              />
            ) : showLeadingViewer ? (
              <MatchCardAvatar
                name={viewerName!}
                avatarPath={viewerAvatarPath}
                backgroundColor={tennisColors.primary}
                textColor={tennisColors.lime}
              />
            ) : (
              <View style={styles.avatarSpacer} />
            )}
            {centerContent}
            {showTrailingOpponent ? (
              <MatchCardAvatar
                name={opponentName!}
                avatarPath={opponentAvatarPath}
                backgroundColor={opponentAvatarColor}
              />
            ) : showLeadingViewer && !showHostOnly ? (
              <PlaceholderOpponentAvatar />
            ) : null}
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
            {badges && badges.length > 0 ? (
              <View style={[styles.badgeRow, { flexDirection: rowDirection }]}>
                {badges.map((entry) => (
                  <SemanticBadge
                    key={entry.label}
                    label={entry.label}
                    tone={entry.tone}
                  />
                ))}
              </View>
            ) : null}
            {formatChip || locationChip || areaChip ? (
              <View style={[styles.chipRow, { flexDirection: rowDirection }]}>
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
                {formatChip ? (
                  <MatchCardChip
                    label={formatChip}
                    backgroundColor={tennisSemantic.info.fill}
                    color={tennisSemantic.info.text}
                  />
                ) : null}
              </View>
            ) : null}
          </>
        )}

        {note ? (
          <AppText style={[styles.note, { writingDirection }]} maxLines={2}>
            {note}
          </AppText>
        ) : null}

        {footer}
      </View>
    </>
  );

  const cardStyle = [
    styles.card,
    accentBorder && {
      borderLeftWidth: 4,
      borderLeftColor: statusVisual.border,
    },
  ];

  if (!onPress) {
    return <View style={cardStyle}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
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
  topRow: {
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  topRowSpacer: {
    flex: 1,
  },
  dateRow: {
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },
  dateText: {
    flex: 1,
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    color: tennisColors.mutedForeground,
  },
  dateTimeLine: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    color: tennisColors.mutedForeground,
  },
  dateTimeStandalone: {
    textAlign: "center",
  },
  playerRow: {
    alignItems: "center",
    gap: 12,
  },
  playerRowHost: {
    alignItems: "flex-start",
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: tennisRadii.pill,
    maxWidth: "48%",
    flexShrink: 0,
  },
  statusPillText: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 11,
  },
  centerColumn: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarImage: {
    width: 46,
    height: 46,
    borderRadius: 14,
    flexShrink: 0,
  },
  avatarSpacer: {
    width: 46,
    height: 46,
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: tennisFontFamily.headingExtra,
    fontSize: 15,
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
    fontSize: 15,
    color: "#0D1117",
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
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: "100%",
  },
  chipText: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 11,
  },
  note: {
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    color: tennisColors.mutedForeground,
    textAlign: "center",
  },
});
