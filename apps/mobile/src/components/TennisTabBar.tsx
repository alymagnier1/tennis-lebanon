import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "./AppText";
import { Icon, type IconName } from "./Icon";
import { tennisColors } from "../theme/tennis-tokens";
import { tennisFontFamily } from "../hooks/useTennisFonts";

const TAB_ICONS: Record<string, IconName> = {
  index: "home",
  discover: "discover",
  matches: "matches",
  clubs: "clubs",
  profile: "profile",
};

type TabRoute = { key: string; name: string };

/**
 * Typed structurally rather than against `BottomTabBarProps`.
 *
 * expo-router bundles its own copy of react-navigation, so declaring
 * `@react-navigation/bottom-tabs` as a direct dependency puts a second copy in
 * the tree whose types no longer match what `Tabs` actually passes — and two
 * navigation packages is a runtime hazard, not just a typing one. This
 * describes only the slice the tab bar uses.
 */
export type TennisTabBarProps = {
  state: { index: number; routes: TabRoute[] };
  descriptors: Record<
    string,
    { options: { tabBarLabel?: unknown; title?: string } }
  >;
  navigation: {
    emit: (event: {
      type: "tabPress";
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

export function TennisTabBar({
  state,
  descriptors,
  navigation,
}: TennisTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route: TabRoute, index: number) => {
        if (route.name === "create" || route.name === "settings") {
          return null;
        }

        const { options } = descriptors[route.key]!;
        const label =
          typeof options.tabBarLabel === "string"
            ? options.tabBarLabel
            : typeof options.title === "string"
              ? options.title
              : route.name;
        const isFocused = state.index === index;
        const iconName = TAB_ICONS[route.name] ?? "home";

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={label}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            style={styles.tab}
          >
            <Icon
              name={iconName}
              size={22}
              color={
                isFocused ? tennisColors.primary : tennisColors.mutedForeground
              }
            />
            <AppText
              style={[styles.label, isFocused && styles.labelActive]}
              maxLines={1}
            >
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    backgroundColor: tennisColors.card,
    borderTopWidth: 1,
    borderTopColor: tennisColors.border,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minHeight: 48,
  },
  label: {
    fontSize: 11,
    fontFamily: tennisFontFamily.body,
    color: tennisColors.mutedForeground,
  },
  labelActive: {
    color: tennisColors.primary,
    fontFamily: tennisFontFamily.bodySemi,
  },
});
