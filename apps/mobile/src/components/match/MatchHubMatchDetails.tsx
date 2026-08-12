import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { MatchHubCard } from "@tennis-lebanon/api";
import { useTranslation } from "react-i18next";
import { AnimatedCollapse } from "../AppUi";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { matchHubMetaLine } from "../../lib/match-hub-summaries";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

export function MatchHubMatchDetails({ hub }: { hub: MatchHubCard }) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection, isRtl } = useLayoutDirection();
  const [open, setOpen] = useState(false);

  const metaLine = matchHubMetaLine(hub, t);
  const toggleLabel = open
    ? t("matches.hub.collapseMatchDetails")
    : t("matches.hub.expandMatchDetails");

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={toggleLabel}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [
          styles.header,
          { flexDirection: rowDirection },
          pressed && styles.headerPressed,
        ]}
      >
        <AppText style={[styles.headerLabel, { writingDirection }]}>
          {t("matches.hub.summaryTitle")}
        </AppText>
        <View
          style={[
            styles.chevronWrap,
            open && styles.chevronWrapOpen,
            isRtl && styles.chevronWrapRtl,
          ]}
        >
          <Icon
            name="chevron"
            size={18}
            color={tennisColors.mutedForeground}
          />
        </View>
      </Pressable>
      <AnimatedCollapse visible={open}>
        <View style={styles.body}>
          <AppText style={[styles.metaLine, { writingDirection }]}>
            {metaLine}
          </AppText>
          {hub.notes ? (
            <View style={styles.notesBlock}>
              <AppText style={styles.notesLabel}>
                {t("matches.create.notes")}
              </AppText>
              <AppText style={[styles.notes, { writingDirection }]}>
                {hub.notes}
              </AppText>
            </View>
          ) : null}
        </View>
      </AnimatedCollapse>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tennisColors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: tennisColors.border,
    overflow: "hidden",
  },
  header: {
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerPressed: {
    opacity: 0.9,
  },
  headerLabel: {
    flex: 1,
    fontFamily: tennisFontFamily.headingSemi,
    fontSize: 15,
    color: tennisColors.primaryDark,
    letterSpacing: -0.2,
  },
  chevronWrap: {
    transform: [{ rotate: "90deg" }],
  },
  chevronWrapOpen: {
    transform: [{ rotate: "270deg" }],
  },
  chevronWrapRtl: {
    transform: [{ rotate: "-90deg" }],
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: tennisColors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  metaLine: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: tennisColors.primaryDark,
  },
  notesBlock: {
    gap: 4,
  },
  notesLabel: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 12,
    color: tennisColors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  notes: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: tennisColors.primaryDark,
  },
});
