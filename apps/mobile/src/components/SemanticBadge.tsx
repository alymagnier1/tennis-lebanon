import { Pressable, StyleSheet, View } from "react-native";
import type { SemanticTone } from "../theme/tennis-tokens";
import { tennisSemantic } from "../theme/tennis-tokens";
import { AppText } from "./AppText";
import { Icon, type IconName } from "./Icon";
import { useLayoutDirection } from "../lib/layout-direction";
import { tennisFontFamily } from "../hooks/useTennisFonts";

const TONE_ICONS: Record<SemanticTone, IconName> = {
  neutral: "info",
  info: "info",
  positive: "check",
  attention: "notifications",
  critical: "close",
  actionable: "matches",
};

export function SemanticBadge({
  label,
  tone,
}: {
  label: string;
  tone: SemanticTone;
}) {
  const palette = tennisSemantic[tone];
  const { rowDirection, writingDirection } = useLayoutDirection();

  return (
    <View
      style={[
        styles.badge,
        {
          flexDirection: rowDirection,
          backgroundColor: palette.fill,
          borderColor: palette.border,
        },
      ]}
    >
      <Icon name={TONE_ICONS[tone]} size={12} color={palette.text} />
      <AppText
        style={[styles.label, { color: palette.text, writingDirection }]}
        maxLines={1}
      >
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  label: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 11,
  },
});
