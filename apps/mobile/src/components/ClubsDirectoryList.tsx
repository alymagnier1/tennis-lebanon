import { useMemo } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import type { ClubDirectoryRow } from "@tennis-lebanon/api";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  ClubDirectoryCard,
  ClubDirectoryCardSkeleton,
} from "./ClubDirectoryCard";
import { EmptyState } from "./AppUi";
import { PrimaryButton, ScreenError, formStyles } from "./FormUi";
import { clubDetailRoute, PROFILE_WHERE_I_PLAY_ROUTE } from "../lib/routes";

type ClubsDirectoryListProps = {
  clubsQuery: UseQueryResult<ClubDirectoryRow[], Error>;
  clubs?: ClubDirectoryRow[];
  matchId?: string;
  onClubPress?: (clubId: string) => void;
  /** Omit for a navigation list; pass to render the rows as checkboxes. */
  selectedClubIds?: string[];
  /** Clubs to float to the top, keeping their relative order below. */
  priorityClubIds?: string[];
  /** Denser cards for booking and preference pickers. */
  compact?: boolean;
};

export function ClubsDirectoryList({
  clubsQuery,
  clubs: clubsOverride,
  matchId,
  onClubPress,
  selectedClubIds,
  priorityClubIds,
  compact = false,
}: ClubsDirectoryListProps) {
  const { t } = useTranslation();

  const clubs = useMemo(() => {
    const rows = clubsOverride ?? clubsQuery.data ?? [];
    if (!priorityClubIds?.length) return rows;
    return [...rows].sort((left, right) => {
      const leftRank = priorityClubIds.includes(left.club_id) ? 0 : 1;
      const rightRank = priorityClubIds.includes(right.club_id) ? 0 : 1;
      return leftRank - rightRank;
    });
  }, [clubsOverride, clubsQuery.data, priorityClubIds]);

  const handlePress = (clubId: string) => {
    if (onClubPress) {
      onClubPress(clubId);
      return;
    }
    router.push(clubDetailRoute(clubId, matchId ? { matchId } : undefined));
  };

  if (clubsQuery.isLoading && !clubsQuery.data) {
    return (
      <View style={formStyles.stack} accessibilityLabel={t("common.loading")}>
        <ClubDirectoryCardSkeleton />
        <ClubDirectoryCardSkeleton />
        <ClubDirectoryCardSkeleton />
      </View>
    );
  }

  if (clubsQuery.isError) {
    return (
      <ScreenError
        message={t("clubs.loadError")}
        retryLabel={t("common.retry")}
        onRetry={() => void clubsQuery.refetch()}
      />
    );
  }

  if (clubs.length === 0) {
    // Two different dead ends wearing one face. If the source has rows and the
    // caller filtered them all away, the fix is the filter sitting right above
    // this list; if the source itself is empty the player has no clubs in the
    // areas they picked, and the only way out is picking more areas.
    const filteredToNothing = (clubsQuery.data?.length ?? 0) > 0;

    if (filteredToNothing) {
      return (
        <EmptyState
          title={t("clubs.filteredEmptyTitle")}
          body={t("clubs.filteredEmptyBody")}
        />
      );
    }

    return (
      <EmptyState
        title={t("clubs.empty")}
        body={t("clubs.emptyBody")}
        action={
          <PrimaryButton
            label={t("clubs.emptyAction")}
            onPress={() => router.push(PROFILE_WHERE_I_PLAY_ROUTE)}
          />
        }
      />
    );
  }

  return (
    <View style={formStyles.stack}>
      {clubs.map((club) => (
        <ClubDirectoryCard
          key={club.club_id}
          club={club}
          compact={compact}
          onPress={() => handlePress(club.club_id)}
          selected={
            selectedClubIds ? selectedClubIds.includes(club.club_id) : undefined
          }
        />
      ))}
    </View>
  );
}
