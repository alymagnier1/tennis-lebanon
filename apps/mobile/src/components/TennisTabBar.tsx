import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { createLiveSheet } from "../theme/create-live-sheet";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listMyMatchInvites,
  listMyMatches,
  type MyMatchRow,
} from "@tennis-lebanon/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "./AppText";
import { Icon, type IconName } from "./Icon";
import { openCreateMatchFlow } from "../lib/create-match-guard";
import {
  formatTabBadgeCount,
  matchTabBadgeCounts,
} from "../lib/match-list-card";
import {
  TAB_BAR_BOTTOM_PADDING_MIN,
  TAB_BAR_ICON_WELL_HEIGHT,
  TAB_BAR_LABEL_GAP,
  TAB_BAR_LABEL_HEIGHT,
  TAB_BAR_TOP_PADDING,
} from "../lib/tab-bar-metrics";
import { supabase } from "../lib/supabase";
import { tennisFontFamily } from "../hooks/useTennisFonts";
import {
  getActiveTennisScheme,
  tennisColors,
  tennisRadii,
} from "../theme/tennis-tokens";

const TAB_ICONS: Record<string, IconName> = {
  index: "home",
  discover: "discover",
  matches: "matches",
  profile: "profile",
};

const HIDDEN_TAB_ROUTES = new Set(["create", "settings", "clubs"]);

const TAB_ICON_SIZE = 26;
const FAB_SIZE = 60;
const FAB_RADIUS = 20;
const FAB_LIFT = 30;
const FAB_ICON_SIZE = 28;

type TabRoute = { key: string; name: string };

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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isDark = getActiveTennisScheme() === "dark";
  const queryClient = useQueryClient();
  const [openingCreate, setOpeningCreate] = useState(false);
  const matchesQuery = useQuery({
    queryKey: ["my-matches"],
    queryFn: () => listMyMatches(supabase),
  });
  const invitesQuery = useQuery({
    queryKey: ["my-match-invites"],
    queryFn: () => listMyMatchInvites(supabase),
  });
  const matchesBadgeLabel = formatTabBadgeCount(
    matchTabBadgeCounts({
      inviteCount: invitesQuery.data?.length ?? 0,
      matches: matchesQuery.data ?? [],
    }).matchesTab,
  );

  async function handleCreatePress() {
    if (openingCreate) return;
    setOpeningCreate(true);

    let matches: MyMatchRow[] | undefined;
    try {
      matches = await queryClient.fetchQuery({
        queryKey: ["my-matches"],
        queryFn: () => listMyMatches(supabase),
      });
    } catch {
      // The duplicate-listing check is a convenience; the database still
      // rejects a second active listing on publish. Falling back to whatever
      // is cached keeps the button from doing nothing at all, which is how a
      // failed fetch used to surface.
      matches = queryClient.getQueryData<MyMatchRow[]>(["my-matches"]);
    } finally {
      setOpeningCreate(false);
    }

    openCreateMatchFlow(matches, t);
  }

  const visibleRoutes = state.routes.filter(
    (route) => !HIDDEN_TAB_ROUTES.has(route.name),
  );

  const leftRoutes = visibleRoutes.filter((route) =>
    ["index", "discover"].includes(route.name),
  );
  const rightRoutes = visibleRoutes.filter((route) =>
    ["matches", "profile"].includes(route.name),
  );

  function renderTab(route: TabRoute) {
    const routeIndex = state.routes.findIndex(
      (entry) => entry.key === route.key,
    );
    const { options } = descriptors[route.key]!;
    const label =
      typeof options.tabBarLabel === "string"
        ? options.tabBarLabel
        : typeof options.title === "string"
          ? options.title
          : route.name;
    const isFocused = state.index === routeIndex;
    const iconName = TAB_ICONS[route.name] ?? "home";
    const iconColor = isFocused
      ? isDark
        ? tennisColors.onViolet
        : tennisColors.primary
      : tennisColors.mutedForeground;
    const badgeLabel = route.name === "matches" ? matchesBadgeLabel : null;

    return (
      <Pressable
        key={route.key}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={badgeLabel ? `${label}, ${badgeLabel}` : label}
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
        <View
          style={[
            styles.iconWell,
            isFocused &&
              (isDark ? styles.iconWellActiveDark : styles.iconWellActive),
          ]}
        >
          <Icon name={iconName} size={TAB_ICON_SIZE} color={iconColor} />
          {badgeLabel ? (
            <View style={styles.tabBadge} accessibilityElementsHidden>
              <AppText style={styles.tabBadgeText}>{badgeLabel}</AppText>
            </View>
          ) : null}
        </View>
        <AppText
          style={[
            styles.label,
            isFocused && (isDark ? styles.labelActiveDark : styles.labelActive),
          ]}
          maxLines={1}
        >
          {label}
        </AppText>
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, TAB_BAR_BOTTOM_PADDING_MIN) },
      ]}
    >
      <View style={styles.barRow}>
        {leftRoutes.map(renderTab)}

        <View style={styles.fabSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("matches.create.cta")}
            testID="tab-create-match"
            onPress={() => void handleCreatePress()}
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          >
            {openingCreate ? (
              <ActivityIndicator color={tennisColors.onPrimary} />
            ) : (
              <Icon
                name="add"
                size={FAB_ICON_SIZE}
                color={tennisColors.onPrimary}
              />
            )}
          </Pressable>
        </View>

        {rightRoutes.map(renderTab)}
      </View>
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    bar: {
      backgroundColor:
        getActiveTennisScheme() === "dark"
          ? "#2A2A2A"
          : tennisColors.background,
      borderTopWidth: 1,
      borderTopColor: tennisColors.border,
      paddingTop: TAB_BAR_TOP_PADDING,
      minHeight: 88,
      shadowColor: tennisColors.primaryDark,
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 12,
      overflow: "visible",
    },
    barRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      overflow: "visible",
    },
    tab: {
      flex: 1,
      alignItems: "center",
      gap: TAB_BAR_LABEL_GAP,
      paddingTop: 0,
    },
    iconWell: {
      width: 48,
      height: TAB_BAR_ICON_WELL_HEIGHT,
      borderRadius: tennisRadii.md,
      alignItems: "center",
      justifyContent: "center",
    },
    iconWellActive: {
      backgroundColor: tennisColors.secondary,
    },
    iconWellActiveDark: {
      backgroundColor: tennisColors.violet,
    },
    tabBadge: {
      position: "absolute",
      top: 2,
      end: 2,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 4,
      backgroundColor: tennisColors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    tabBadgeText: {
      color: tennisColors.white,
      fontSize: 9,
      lineHeight: 11,
      fontFamily: tennisFontFamily.bodySemi,
    },
    label: {
      fontSize: 11,
      lineHeight: TAB_BAR_LABEL_HEIGHT,
      fontFamily: tennisFontFamily.body,
      color: tennisColors.mutedForeground,
    },
    labelActive: {
      color: tennisColors.primary,
      fontFamily: tennisFontFamily.bodySemi,
    },
    labelActiveDark: {
      color: tennisColors.primaryDark,
      fontFamily: tennisFontFamily.bodySemi,
    },
    fabSlot: {
      flex: 1,
      alignItems: "center",
      overflow: "visible",
    },
    fab: {
      width: FAB_SIZE,
      height: FAB_SIZE,
      marginTop: -FAB_LIFT,
      borderRadius: FAB_RADIUS,
      borderWidth: 3,
      borderColor:
        getActiveTennisScheme() === "dark"
          ? "#2A2A2A"
          : tennisColors.background,
      backgroundColor: tennisColors.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: tennisColors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 20,
      elevation: 10,
    },
    fabPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.97 }],
    },
  }),
);
