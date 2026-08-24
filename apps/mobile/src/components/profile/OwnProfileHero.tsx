import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

export function OwnProfileHero({
  name,
  avatarPath,
  locationLabel,
  skillBand,
  matchesPlayed,
  matchesPlayedLabel,
  ratingValue,
  ratingLabel,
  editLabel,
  avatarEditLabel,
  avatarUploading = false,
  onAvatarPress,
  onEdit,
  onRatingInfo,
}: {
  name: string;
  avatarPath: string | null;
  locationLabel: string;
  skillBand: string;
  matchesPlayed: number;
  matchesPlayedLabel: string;
  ratingValue: string;
  ratingLabel: string;
  editLabel: string;
  avatarEditLabel: string;
  avatarUploading?: boolean;
  onAvatarPress?: () => void;
  onEdit: () => void;
  onRatingInfo: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const bandColor = skillBandColor(skillBand);
  const heroTopPadding = Math.max(insets.top + 28, 52);

  return (
    <View style={[styles.hero, { paddingTop: heroTopPadding }]}>
      <CourtGridOverlay />
      <View style={styles.heroContent}>
        <View style={[styles.identityRow, { flexDirection: rowDirection }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={avatarEditLabel}
            disabled={avatarUploading || !onAvatarPress}
            onPress={onAvatarPress}
            style={styles.avatarWrap}
          >
            <Avatar
              name={name}
              avatarPath={avatarPath}
              size={AVATAR_SIZE}
              borderRadius={tennisRadii.hero}
            />
            {avatarUploading ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color={tennisColors.white} />
              </View>
            ) : onAvatarPress ? (
              <View style={styles.avatarBadge}>
                <Icon name="camera" size={12} color={tennisColors.white} />
              </View>
            ) : null}
          </Pressable>

          <View style={styles.identityBody}>
            <AppText style={[styles.name, { writingDirection }]} maxLines={2}>
              {name}
            </AppText>
            {locationLabel ? (
              <View style={[styles.metaRow, { flexDirection: rowDirection }]}>
                <Icon name="place" size={12} color="rgba(255,255,255,0.65)" />
                <AppText
                  style={[styles.metaText, { writingDirection }]}
                  maxLines={1}
                >
                  {locationLabel}
                </AppText>
              </View>
            ) : null}
            <View style={[styles.badgeRow, { flexDirection: rowDirection }]}>
              <View style={[styles.levelBadge, { backgroundColor: bandColor }]}>
                <AppText style={styles.levelBadgeText}>
                  {t(`skillBands.${skillBand}`)}
                </AppText>
              </View>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editLabel}
            onPress={onEdit}
            style={({ pressed }) => [
              styles.editButton,
              pressed && styles.editButtonPressed,
            ]}
          >
            <AppText style={styles.editButtonText}>{editLabel}</AppText>
          </Pressable>
        </View>

        <View style={[styles.statsBar, { flexDirection: rowDirection }]}>
          <View style={styles.statCell}>
            <AppText style={styles.statValue}>{matchesPlayed}</AppText>
            <AppText style={styles.statLabel}>{matchesPlayedLabel}</AppText>
          </View>
          <View style={styles.statDivider} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("profile.ratingExplainerTitle")}
            onPress={onRatingInfo}
            style={styles.statCell}
          >
            <View
              style={[styles.ratingValueRow, { flexDirection: rowDirection }]}
            >
              <AppText style={styles.statValue}>{ratingValue}</AppText>
              <Icon name="info" size={14} color="rgba(255,255,255,0.65)" />
            </View>
            <AppText style={styles.statLabel}>{ratingLabel}</AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    hero: {
      backgroundColor: tennisColors.primary,
      paddingHorizontal: 20,
      paddingBottom: 24,
      overflow: "hidden",
    },
    heroContent: {
      position: "relative",
      zIndex: 1,
      gap: 20,
    },
    identityRow: {
      alignItems: "flex-start",
      gap: 12,
    },
    avatarWrap: {
      borderRadius: tennisRadii.hero,
      borderWidth: 3,
      borderColor: tennisColors.heroBorder,
      overflow: "hidden",
      flexShrink: 0,
      position: "relative",
    },
    avatarOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    avatarBadge: {
      position: "absolute",
      right: 4,
      bottom: 4,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    identityBody: {
      flex: 1,
      minWidth: 0,
      gap: 4,
      paddingTop: 4,
    },
    name: {
      fontFamily: tennisFontFamily.headingExtra,
      fontSize: 22,
      color: tennisColors.white,
      letterSpacing: -0.4,
    },
    metaRow: {
      alignItems: "center",
      gap: 4,
    },
    metaText: {
      flexShrink: 1,
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      color: "rgba(255,255,255,0.65)",
    },
    badgeRow: {
      flexWrap: "wrap",
      gap: 6,
      marginTop: 4,
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
    editButton: {
      borderRadius: tennisRadii.sm,
      borderWidth: 1,
      borderColor: tennisColors.heroBorder,
      backgroundColor: tennisColors.heroOverlay,
      paddingHorizontal: 12,
      paddingVertical: 8,
      flexShrink: 0,
      alignSelf: "flex-start",
      marginTop: 4,
    },
    editButtonPressed: {
      opacity: 0.85,
    },
    editButtonText: {
      fontFamily: tennisFontFamily.bodySemi,
      fontSize: 12,
      color: tennisColors.white,
    },
    statsBar: {
      backgroundColor: tennisColors.heroOverlay,
      borderRadius: tennisRadii.lg,
      overflow: "hidden",
    },
    statCell: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 4,
    },
    statDivider: {
      width: 1,
      backgroundColor: tennisColors.heroBorder,
      marginVertical: 8,
    },
    ratingValueRow: {
      alignItems: "center",
      gap: 4,
      maxWidth: "100%",
    },
    statValue: {
      fontFamily: tennisFontFamily.headingExtra,
      fontSize: 16,
      color: tennisColors.white,
      letterSpacing: -0.3,
      textAlign: "center",
    },
    statLabel: {
      fontFamily: tennisFontFamily.body,
      fontSize: 10,
      color: "rgba(255,255,255,0.55)",
      marginTop: 2,
      textAlign: "center",
    },
  }),
);
