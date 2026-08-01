import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CompatiblePlayerCard } from "@tennis-lebanon/api";
import { useTranslation } from "react-i18next";
import { Avatar } from "../AppUi";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { CourtGridOverlay } from "../onboarding-ui/CourtPattern";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { useLayoutDirection } from "../../lib/layout-direction";
import { skillBandColor } from "../../lib/skill-band-theme";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";

const AVATAR_SIZE = 96;

export function PlayerProfileHero({
  player,
  name,
  locationLabel,
  onBack,
}: {
  player: CompatiblePlayerCard;
  name: string;
  locationLabel: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const bandColor = skillBandColor(player.skill_band);
  const isProvisional = player.provisional_rating_label === "provisional";

  return (
    <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
      <CourtGridOverlay />
      <View style={styles.heroContent}>
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
            <Icon name="chevronBack" size={18} color={tennisColors.white} />
          </Pressable>
        </View>

        <View style={[styles.identityRow, { flexDirection: rowDirection }]}>
          <View style={styles.avatarWrap}>
            <Avatar
              name={name}
              avatarPath={player.avatar_path}
              size={AVATAR_SIZE}
              borderRadius={tennisRadii.hero}
            />
          </View>

          <View style={styles.identityBody}>
            <AppText style={[styles.name, { writingDirection }]} maxLines={2}>
              {name}
            </AppText>

            {locationLabel ? (
              <View
                style={[styles.locationRow, { flexDirection: rowDirection }]}
              >
                <Icon name="place" size={12} color="rgba(255,255,255,0.65)" />
                <AppText
                  style={[styles.location, { writingDirection }]}
                  maxLines={2}
                >
                  {locationLabel}
                </AppText>
              </View>
            ) : null}

            <View style={[styles.badgeRow, { flexDirection: rowDirection }]}>
              <View style={[styles.levelBadge, { backgroundColor: bandColor }]}>
                <AppText style={styles.levelBadgeText}>
                  {t(`skillBands.${player.skill_band}`)}
                </AppText>
              </View>
              {isProvisional ? (
                <View style={styles.provisionalBadge}>
                  <AppText style={styles.provisionalBadgeText}>
                    {t("rating.provisionalBadge")}
                  </AppText>
                </View>
              ) : player.display_rating != null ? (
                <View style={styles.provisionalBadge}>
                  <AppText style={styles.provisionalBadgeText}>
                    {player.display_rating}
                  </AppText>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: tennisColors.primary,
    paddingHorizontal: 20,
    paddingBottom: 28,
    overflow: "hidden",
  },
  heroContent: {
    position: "relative",
    zIndex: 1,
    gap: 20,
  },
  navRow: {
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: tennisRadii.sm,
    backgroundColor: tennisColors.heroOverlay,
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
    borderRadius: tennisRadii.hero,
    borderWidth: 3,
    borderColor: tennisColors.heroBorder,
    overflow: "hidden",
    flexShrink: 0,
  },
  identityBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  name: {
    fontFamily: tennisFontFamily.headingExtra,
    fontSize: 22,
    color: tennisColors.white,
    letterSpacing: -0.4,
  },
  locationRow: {
    alignItems: "center",
    gap: 4,
  },
  location: {
    flexShrink: 1,
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
  },
  badgeRow: {
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  levelBadge: {
    borderRadius: tennisRadii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  levelBadgeText: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 11,
    color: tennisColors.white,
  },
  provisionalBadge: {
    borderRadius: tennisRadii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: tennisColors.heroOverlay,
  },
  provisionalBadgeText: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 11,
    color: tennisColors.white,
  },
});
