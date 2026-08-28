import type { PropsWithChildren } from "react";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useTranslation } from "react-i18next";
import { AnimatedCollapse } from "../AppUi";
import { AppText } from "../AppText";
import { Icon } from "../Icon";
import { useLayoutDirection } from "../../lib/layout-direction";
import { tennisColors } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

/** Secondary hub ops, collapsed so the next action owns the fold. */
export function MatchHubMoreSection({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection, isRtl } = useLayoutDirection();
  const [open, setOpen] = useState(false);

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
          {t("matches.hub.moreTitle")}
        </AppText>
        <View
          style={[
            styles.chevronWrap,
            open && styles.chevronWrapOpen,
            isRtl && styles.chevronWrapRtl,
          ]}
        >
          <Icon name="chevron" size={18} color={tennisColors.mutedForeground} />
        </View>
      </Pressable>
      <AnimatedCollapse visible={open}>
        <View style={styles.body}>{children}</View>
      </AnimatedCollapse>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
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
  }),
);
