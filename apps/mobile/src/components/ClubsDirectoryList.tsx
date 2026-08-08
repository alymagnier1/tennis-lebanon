import { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import type { ClubDirectoryRow } from "@tennis-lebanon/api";
import type { UseQueryResult } from "@tanstack/react-query";
import { ClubDirectoryCard } from "./ClubDirectoryCard";
import { EmptyState } from "./AppUi";
import { PrimaryButton, formStyles } from "./FormUi";
import { AppText } from "./AppText";
import { clubDetailRoute } from "../lib/routes";

type ClubsDirectoryListProps = {
  clubsQuery: UseQueryResult<ClubDirectoryRow[], Error>;
  clubs?: ClubDirectoryRow[];
  matchId?: string;
  onClubPress?: (clubId: string) => void;
  /** Omit for a navigation list; pass to render the rows as checkboxes. */
  selectedClubIds?: string[];
  /** Clubs to float to the top, keeping their relative order below. */
  priorityClubIds?: string[];
};

export function ClubsDirectoryList({
  clubsQuery,
  clubs: clubsOverride,
  matchId,
  onClubPress,
  selectedClubIds,
  priorityClubIds,
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

  if (clubsQuery.isLoading && !clubsOverride) {
    return <ActivityIndicator accessibilityLabel={t("common.loading")} />;
  }

  if (clubsQuery.isError) {
    return (
      <View>
        <AppText style={formStyles.errorText}>{t("clubs.loadError")}</AppText>
        <PrimaryButton
          label={t("common.retry")}
          onPress={() => void clubsQuery.refetch()}
        />
      </View>
    );
  }

  if (clubs.length === 0) {
    return (
      <EmptyState
        title={t("clubs.empty")}
        body={t("clubs.directoryDescription")}
      />
    );
  }

  return (
    <View style={formStyles.stack}>
      {clubs.map((club) => (
        <ClubDirectoryCard
          key={club.club_id}
          club={club}
          onPress={() => handlePress(club.club_id)}
          selected={
            selectedClubIds ? selectedClubIds.includes(club.club_id) : undefined
          }
        />
      ))}
    </View>
  );
}
