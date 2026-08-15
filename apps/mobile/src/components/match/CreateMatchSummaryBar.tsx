import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  formatSkillBandSelection,
  ORDERED_SKILL_BANDS,
  skillBandsInRange,
} from "@tennis-lebanon/domain";
import { AppText } from "../AppText";
import { getCreateMatchDraft } from "../../lib/create-match-draft";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

const SUMMARY_CHIP_BG = "#CD6E51";

function SummaryDefaultChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const { writingDirection } = useLayoutDirection();

  return (
    <View style={styles.chip}>
      <AppText style={styles.chipLabel} maxLines={1}>
        {label}
      </AppText>
      <AppText style={[styles.chipValue, { writingDirection }]} maxLines={2}>
        {value}
      </AppText>
    </View>
  );
}

export function CreateMatchSummaryBar({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const { rowDirection } = useLayoutDirection();
  const draft = getCreateMatchDraft();

  const levelSummary = useMemo(() => {
    const selected =
      draft.selectedSkillBands && draft.selectedSkillBands.length > 0
        ? draft.selectedSkillBands
        : draft.minSkill && draft.maxSkill
          ? skillBandsInRange(draft.minSkill, draft.maxSkill)
          : [];

    if (selected.length === ORDERED_SKILL_BANDS.length) {
      return t("matches.create.allLevels");
    }

    return formatSkillBandSelection(selected, (band) =>
      t(`skillBandsShort.${band}`),
    );
  }, [draft.maxSkill, draft.minSkill, draft.selectedSkillBands, t]);

  const chips = useMemo(() => {
    if (!draft.format || !draft.intent) {
      return [];
    }

    return [
      {
        label: t("discover.formatFilter"),
        value: t(`formats.${draft.format}`),
      },
      {
        label: t("discover.intentFilter"),
        value: t(`playIntent.${draft.intent}`),
      },
      {
        label: t("matches.create.levelRange"),
        value: levelSummary,
      },
    ];
  }, [draft.format, draft.intent, levelSummary, t]);

  const summaryLine = chips.map((chip) => chip.value).join(" · ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("matches.create.summaryBar.a11y", {
        summary: summaryLine,
      })}
      onPress={onPress}
      style={({ pressed }) => [styles.root, pressed && styles.rootPressed]}
    >
      <View style={[styles.headerRow, { flexDirection: rowDirection }]}>
        <AppText style={styles.title}>
          {t("matches.create.summaryBar.title")}
        </AppText>
        <AppText style={styles.editLabel}>
          {t("matches.create.summaryBar.edit")}
        </AppText>
      </View>

      {chips.length > 0 ? (
        <View style={[styles.chipsRow, { flexDirection: rowDirection }]}>
          {chips.map((chip) => (
            <SummaryDefaultChip
              key={chip.label}
              label={chip.label}
              value={chip.value}
            />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: tennisColors.card,
    borderRadius: tennisRadii.xl,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  rootPressed: {
    opacity: 0.94,
  },
  headerRow: {
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    flex: 1,
    fontFamily: tennisFontFamily.bodyMedium,
    fontSize: 12,
    color: tennisColors.mutedForeground,
  },
  editLabel: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 12,
    lineHeight: 16,
    color: SUMMARY_CHIP_BG,
  },
  chipsRow: {
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: "100%",
    gap: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: tennisRadii.sm,
    backgroundColor: SUMMARY_CHIP_BG,
  },
  chipLabel: {
    fontFamily: tennisFontFamily.body,
    fontSize: 9,
    lineHeight: 12,
    color: "rgba(255,255,255,0.82)",
  },
  chipValue: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 11,
    lineHeight: 14,
    color: tennisColors.white,
  },
});
