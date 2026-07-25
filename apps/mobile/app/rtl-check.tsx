import { useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import {
  SUPPORTED_LOCALES,
  getTextDirection,
  type SupportedLocale,
} from "@tennis-lebanon/i18n";
import { colors, radii, spacing, typography } from "@tennis-lebanon/ui";

/**
 * Milestone 0 visual RTL check. Switches locale/text-direction on this
 * screen only (does not call native I18nManager.forceRTL, which requires
 * an app reload) so Arabic layout can be reviewed without restarting.
 * Full native RTL mirroring is a follow-up item, not required for M0.
 */
export default function RtlCheckScreen() {
  const { t, i18n } = useTranslation();
  const [locale, setLocale] = useState<SupportedLocale>(
    i18n.language as SupportedLocale,
  );

  const direction = getTextDirection(locale);
  const isRtl = direction === "rtl";

  const selectLocale = (next: SupportedLocale) => {
    setLocale(next);
    i18n.changeLanguage(next);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.switcher, isRtl && styles.switcherRtl]}>
        {SUPPORTED_LOCALES.map((code) => (
          <Pressable
            key={code}
            onPress={() => selectLocale(code)}
            style={[styles.chip, locale === code && styles.chipActive]}
          >
            <Text
              style={[
                styles.chipLabel,
                locale === code && styles.chipLabelActive,
              ]}
            >
              {code.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.card, isRtl && styles.cardRtl]}>
        <Text
          style={[styles.title, { writingDirection: direction }]}
          accessibilityLanguage={locale}
        >
          {t("rtlCheck.title")}
        </Text>
        <Text
          style={[styles.description, { writingDirection: direction }]}
          accessibilityLanguage={locale}
        >
          {t("rtlCheck.description")}
        </Text>
        <Text
          style={[styles.sample, { writingDirection: direction }]}
          accessibilityLanguage={locale}
        >
          {t("rtlCheck.sampleSentence")}
        </Text>
        <Text style={styles.meta}>
          {t("rtlCheck.directionLabel")}: {direction}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.neutral[0],
  },
  switcher: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  switcherRtl: {
    flexDirection: "row-reverse",
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.neutral[100],
    minWidth: 44,
    alignItems: "center",
  },
  chipActive: {
    backgroundColor: colors.brand[500],
  },
  chipLabel: {
    color: colors.neutral[700],
    fontWeight: typography.weight.medium,
  },
  chipLabelActive: {
    color: colors.neutral[0],
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardRtl: {
    alignItems: "flex-end",
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.neutral[900],
    textAlign: "auto",
  },
  description: {
    fontSize: typography.size.sm,
    color: colors.neutral[700],
    textAlign: "auto",
  },
  sample: {
    fontSize: typography.size.md,
    color: colors.brand[700],
    textAlign: "auto",
  },
  meta: {
    fontSize: typography.size.xs,
    color: colors.neutral[500],
  },
});
