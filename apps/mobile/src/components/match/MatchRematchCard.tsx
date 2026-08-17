import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getRematchContext } from "@tennis-lebanon/api";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { FigmaPrimaryButton, FigmaSecondaryButton } from "../onboarding-ui";
import { useLayoutDirection } from "../../lib/layout-direction";
import { buildRematchContextCopy } from "../../lib/rematch-context-copy";
import type { RematchOpponent } from "../../lib/rematch-draft";
import { supabase } from "../../lib/supabase";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

/**
 * The one moment in the product where both players have just agreed the match
 * was worth playing. Everything else on a completed hub is admin — attendance,
 * score, confirmation — so this is the only forward-looking thing on the screen.
 *
 * Doubles gets one button per opponent rather than a picker: capacity caps the
 * list at three, and a picker would add a decision before the decision.
 */
export function MatchRematchCard({
  opponents,
  onRematch,
}: {
  opponents: RematchOpponent[];
  onRematch: (opponent: RematchOpponent) => void;
}) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();

  const single = opponents.length === 1 ? opponents[0]! : null;

  /**
   * Only asked for a singles pair. With several opponents there is no single
   * head-to-head to report, and the milestone would need a name it does not have.
   */
  const contextQuery = useQuery({
    queryKey: ["rematch-context", single?.userId],
    queryFn: () => getRematchContext(supabase, single!.userId),
    enabled: Boolean(single),
    staleTime: 60_000,
  });

  if (opponents.length === 0) {
    return null;
  }

  const copy =
    single && contextQuery.data
      ? buildRematchContextCopy({
          context: contextQuery.data,
          opponentName: single.displayName,
        })
      : null;

  return (
    <View style={styles.root}>
      {/* The milestone is the celebration this event never had: a completed
          match used to resolve into a status change and a score form. */}
      {copy?.milestone ? (
        <AppText style={[styles.milestone, { writingDirection }]}>
          {t(copy.milestone.key, copy.milestone.params)}
          {copy.headToHead
            ? ` ${t(copy.headToHead.key, copy.headToHead.params)}`
            : ""}
        </AppText>
      ) : null}

      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <View style={styles.iconWrap}>
          <Icon name="court" size={20} color={tennisColors.primary} />
        </View>
        <View style={styles.headerText}>
          <AppText style={[styles.title, { writingDirection }]}>
            {t("matches.rematch.title")}
          </AppText>
          <AppText style={[styles.body, { writingDirection }]}>
            {single
              ? t("matches.rematch.bodySingle", { name: single.displayName })
              : t("matches.rematch.bodyMultiple")}
          </AppText>
        </View>
      </View>

      <View style={styles.actions}>
        {single ? (
          <FigmaPrimaryButton
            label={t("matches.rematch.cta", { name: single.displayName })}
            onPress={() => onRematch(single)}
          />
        ) : (
          opponents.map((opponent) => (
            <FigmaSecondaryButton
              key={opponent.userId}
              label={t("matches.rematch.cta", { name: opponent.displayName })}
              onPress={() => onRematch(opponent)}
            />
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.card,
  },
  milestone: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 15,
    lineHeight: 21,
    color: tennisColors.primary,
    letterSpacing: -0.2,
  },
  header: {
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: tennisRadii.md,
    backgroundColor: tennisColors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 16,
    color: tennisColors.primaryDark,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: tennisFontFamily.body,
    fontSize: 13,
    lineHeight: 19,
    color: tennisColors.mutedForeground,
  },
  actions: {
    gap: 10,
  },
});
