import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import type { HomeNextAction } from "../../lib/home-next-actions";
import {
  homeNextActionLabelKey,
  homeNextActionTone,
} from "../../lib/match-status-tone";
import { homeNextActionRoute } from "../../lib/routes";
import { useLayoutDirection } from "../../lib/layout-direction";
import {
  tennisSemantic,
  type SemanticTone,
  tennisRadii,
} from "../../theme/tennis-tokens";
import { AppText } from "../AppText";
import { Icon, type IconName } from "../Icon";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

const ACTION_ICONS: Record<HomeNextAction["kind"], IconName> = {
  invite: "notifications",
  vote: "matches",
  booking: "place",
  court: "place",
  played: "check",
  players: "discover",
};

export function HomeNextActionCard({ action }: { action: HomeNextAction }) {
  const { t } = useTranslation();
  const { rowDirection, writingDirection } = useLayoutDirection();
  const tone: SemanticTone = homeNextActionTone(action.kind);
  const palette = tennisSemantic[tone];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.fill, borderColor: palette.border },
      ]}
    >
      <View style={[styles.top, { flexDirection: rowDirection }]}>
        <View style={[styles.iconWrap, { backgroundColor: palette.border }]}>
          <Icon
            name={ACTION_ICONS[action.kind]}
            size={18}
            color={palette.text}
          />
        </View>
        <View style={styles.textBlock}>
          <AppText
            style={[styles.title, { color: palette.text, writingDirection }]}
          >
            {t(action.titleKey)}
          </AppText>
          <AppText
            style={[styles.body, { color: palette.text, writingDirection }]}
          >
            {t(action.bodyKey, action.bodyParams)}
          </AppText>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(homeNextActionLabelKey(action.kind))}
        onPress={() =>
          router.push(homeNextActionRoute(action.kind, action.matchId))
        }
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: tennisSemantic.actionable.fill },
          pressed && styles.buttonPressed,
        ]}
      >
        <AppText style={styles.buttonLabel}>
          {t(homeNextActionLabelKey(action.kind))}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: tennisRadii.lg,
    padding: 16,
    gap: 14,
  },
  top: {
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 16,
  },
  body: {
    fontFamily: tennisFontFamily.body,
    fontSize: 14,
    opacity: 0.9,
  },
  button: {
    minHeight: 44,
    borderRadius: tennisRadii.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonLabel: {
    fontFamily: tennisFontFamily.bodySemi,
    fontSize: 15,
    color: tennisSemantic.actionable.text,
  },
});
