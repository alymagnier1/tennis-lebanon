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
  matchId?: string;
  onClubPress?: (clubId: string) => void;
};

export function ClubsDirectoryList({
  clubsQuery,
  matchId,
  onClubPress,
}: ClubsDirectoryListProps) {
  const { t } = useTranslation();

  const handlePress = (clubId: string) => {
    if (onClubPress) {
      onClubPress(clubId);
      return;
    }
    router.push(clubDetailRoute(clubId, matchId ? { matchId } : undefined));
  };

  if (clubsQuery.isLoading) {
    return <ActivityIndicator accessibilityLabel={t("discover.loading")} />;
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

  if ((clubsQuery.data?.length ?? 0) === 0) {
    return (
      <EmptyState
        title={t("clubs.empty")}
        body={t("clubs.directoryDescription")}
      />
    );
  }

  return (
    <View style={formStyles.stack}>
      {clubsQuery.data?.map((club) => (
        <ClubDirectoryCard
          key={club.club_id}
          club={club}
          onPress={() => handlePress(club.club_id)}
        />
      ))}
    </View>
  );
}
