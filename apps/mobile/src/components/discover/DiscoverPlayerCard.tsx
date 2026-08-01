import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import type { CompatiblePlayerCard } from "@tennis-lebanon/api";
import { Avatar } from "../AppUi";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { tennisFontFamily } from "../../hooks/useTennisFonts";
import { useLayoutDirection } from "../../lib/layout-direction";
import { skillBandColor } from "../../lib/skill-band-theme";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";

function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <AppText style={styles.tagText} maxLines={1}>
        {label}
      </AppText>
    </View>
  );
}

export const DiscoverPlayerCard = memo(function DiscoverPlayerCard({
  player,
  name,
  locationLabel,
  levelBadgeLabel,
  matchesPlayedLabel,
  formatTag,
  intentTag,
  availabilityTag,
  profileAccessibilityLabel,
  primaryLabel,
  primaryLoading = false,
  onProfilePress,
  onPrimaryPress,
}: {
  player: CompatiblePlayerCard;
  name: string;
  locationLabel: string;
  levelBadgeLabel: string;
  matchesPlayedLabel: string;
  formatTag: string;
  intentTag: string;
  availabilityTag: string | null;
  profileAccessibilityLabel: string;
  primaryLabel: string;
  primaryLoading?: boolean;
  onProfilePress: () => void;
  onPrimaryPress: () => void;
}) {
  const { rowDirection, writingDirection } = useLayoutDirection();
  const bandColor = skillBandColor(player.skill_band);

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={profileAccessibilityLabel}
        onPress={onProfilePress}
        style={({ pressed }) => [
          styles.profileTap,
          pressed && styles.profileTapPressed,
        ]}
      >
        <View style={[styles.header, { flexDirection: rowDirection }]}>
          <View style={styles.avatarWrap}>
            <Avatar
              name={name}
              avatarPath={player.avatar_path}
              size={56}
              borderRadius={14}
            />
          </View>

          <View style={styles.headerBody}>
            <View style={[styles.titleRow, { flexDirection: rowDirection }]}>
              <View style={styles.identity}>
                <AppText
                  style={[styles.name, { writingDirection }]}
                  maxLines={1}
                >
                  {name}
                </AppText>
                {locationLabel ? (
                  <View
                    style={[
                      styles.locationRow,
                      { flexDirection: rowDirection },
                    ]}
                  >
                    <Icon name="place" size={12} color={tennisColors.accent} />
                    <AppText
                      style={[styles.location, { writingDirection }]}
                      maxLines={1}
                    >
                      {locationLabel}
                    </AppText>
                  </View>
                ) : null}
              </View>
              <View
                style={[
                  styles.levelBadge,
                  { backgroundColor: `${bandColor}20` },
                ]}
              >
                <AppText style={[styles.levelBadgeText, { color: bandColor }]}>
                  {levelBadgeLabel}
                </AppText>
              </View>
            </View>
          </View>
        </View>

        <AppText style={[styles.matchesPlayed, { writingDirection }]}>
          {matchesPlayedLabel}
        </AppText>

        <View style={[styles.tagRow, { flexDirection: rowDirection }]}>
          <Tag label={`🎾 ${formatTag}`} />
          <Tag label={`🎯 ${intentTag}`} />
          {availabilityTag ? <Tag label={`⏰ ${availabilityTag}`} /> : null}
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={primaryLabel}
        disabled={primaryLoading}
        onPress={onPrimaryPress}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.primaryButtonPressed,
          primaryLoading && styles.primaryButtonDisabled,
        ]}
      >
        {primaryLoading ? (
          <ActivityIndicator color={tennisColors.white} />
        ) : (
          <AppText style={styles.primaryButtonText} maxLines={1}>
            {primaryLabel}
          </AppText>
        )}
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: tennisColors.card,
    borderRadius: tennisRadii.xl,
    borderWidth: 1,
    borderColor: tennisColors.border,
    padding: 16,
    gap: 12,
  },
  profileTap: {
    gap: 12,
  },
  profileTapPressed: {
    opacity: 0.92,
  },
  header: {
    alignItems: "flex-start",
    gap: 12,
  },
  avatarWrap: {
    borderRadius: 14,
    overflow: "hidden",
  },
  headerBody: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 16,
    color: tennisColors.primaryDark,
  },
  locationRow: {
    alignItems: "center",
    gap: 4,
    minWidth: 0,
  },
  location: {
    flexShrink: 1,
    fontFamily: tennisFontFamily.body,
    fontSize: 12,
    color: tennisColors.mutedForeground,
  },
  levelBadge: {
    borderRadius: tennisRadii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  levelBadgeText: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 11,
  },
  matchesPlayed: {
    fontFamily: tennisFontFamily.body,
    fontSize: 11,
    color: tennisColors.mutedForeground,
  },
  tagRow: {
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    backgroundColor: tennisColors.muted,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: "100%",
  },
  tagText: {
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 11,
    color: tennisColors.mutedForeground,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: tennisColors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 13,
    color: tennisColors.white,
  },
});
