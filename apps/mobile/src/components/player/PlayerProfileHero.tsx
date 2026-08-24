import { Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CompatiblePlayerCard } from "@tennis-lebanon/api";
import { useTranslation } from "react-i18next";
import { Avatar } from "../AppUi";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors } from "../../theme/tennis-tokens";
import { FigmaPrimaryButton } from "../onboarding-ui";
import { zoneLabelFromList } from "../../lib/zones";

const AVATAR_SIZE = 72;

export function PlayerProfileHero({
  player,
  name,
  onBack,
  onChallenge,
}: {
  player: CompatiblePlayerCard;
  name: string;
  onBack: () => void;
  onChallenge: () => void;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const areaLabel = zoneLabelFromList(player.zones, locale);
  const isProvisional = player.provisional_rating_label === "provisional";
  const matchCount = player.completed_match_count;
  const ratingLine =
    !isProvisional && player.display_rating != null
      ? t("playerProfile.headerRating", {
          rating: player.display_rating,
          count: matchCount,
        })
      : t("playerProfile.headerMatches", { count: matchCount });

  return (
    <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
      <View style={[styles.navRow, { flexDirection: rowDirection }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={onBack}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.iconButtonPressed,
          ]}
        >
          <Icon name="chevronBack" size={18} color={tennisColors.primaryDark} />
        </Pressable>
      </View>

      <View style={[styles.identityRow, { flexDirection: rowDirection }]}>
        <View style={styles.avatarWrap}>
          <Avatar
            name={name}
            avatarPath={player.avatar_path}
            size={AVATAR_SIZE}
          />
        </View>

        <View style={styles.identityBody}>
          <AppText style={[styles.name, { writingDirection }]} maxLines={2}>
            {name}
          </AppText>
          <AppText style={[styles.level, { writingDirection }]} maxLines={1}>
            {t(`skillBands.${player.skill_band}`)}
          </AppText>
          {areaLabel ? (
            <View style={[styles.areaRow, { flexDirection: rowDirection }]}>
              <Icon
                name="place"
                size={12}
                color={tennisColors.mutedForeground}
              />
              <AppText style={[styles.area, { writingDirection }]} maxLines={1}>
                {areaLabel}
              </AppText>
            </View>
          ) : null}
          <View style={[styles.ratingRow, { flexDirection: rowDirection }]}>
            {!isProvisional && player.display_rating != null ? (
              <Icon name="star" size={14} color={tennisColors.lime} />
            ) : null}
            <AppText style={[styles.rating, { writingDirection }]} maxLines={1}>
              {isProvisional
                ? `${t("rating.provisionalBadge")} · ${ratingLine}`
                : ratingLine}
            </AppText>
          </View>
        </View>
      </View>

      <FigmaPrimaryButton
        label={t("playerProfile.challengeCta")}
        onPress={onChallenge}
      />
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    hero: {
      backgroundColor: tennisColors.background,
      paddingHorizontal: 20,
      paddingBottom: 16,
      gap: 16,
    },
    navRow: {
      alignItems: "center",
      minHeight: 44,
    },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: tennisColors.card,
      borderWidth: 1,
      borderColor: tennisColors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    iconButtonPressed: {
      opacity: 0.85,
    },
    identityRow: {
      alignItems: "center",
      gap: 16,
    },
    avatarWrap: {
      borderRadius: AVATAR_SIZE / 2,
      borderWidth: 2,
      borderColor: tennisColors.lime,
      overflow: "hidden",
      flexShrink: 0,
    },
    identityBody: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    name: {
      fontFamily: tennisFontFamily.headingExtra,
      fontSize: 22,
      color: tennisColors.primaryDark,
      letterSpacing: -0.4,
    },
    level: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      color: tennisColors.mutedForeground,
    },
    areaRow: {
      alignItems: "center",
      gap: 4,
    },
    area: {
      flexShrink: 1,
      fontFamily: tennisFontFamily.body,
      fontSize: 13,
      color: tennisColors.mutedForeground,
    },
    ratingRow: {
      alignItems: "center",
      gap: 6,
      marginTop: 2,
    },
    rating: {
      flexShrink: 1,
      fontFamily: tennisFontFamily.bodyMedium,
      fontSize: 13,
      color: tennisColors.primaryDark,
    },
  }),
);
