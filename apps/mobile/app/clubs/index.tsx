import { useTranslation } from "react-i18next";
import { ClubsDirectoryList } from "../../src/components/ClubsDirectoryList";
import { Screen } from "../../src/components/FormUi";
import { useClubsDirectory } from "../../src/hooks/useClubsDirectory";

export default function ClubsDirectoryScreen() {
  const { t } = useTranslation();
  const clubsQuery = useClubsDirectory();

  return (
    <Screen
      title={t("clubs.directoryTitle")}
      description={t("clubs.directoryDescription")}
      refreshing={clubsQuery.isRefetching}
      onRefresh={() => void clubsQuery.refetch()}
    >
      <ClubsDirectoryList clubsQuery={clubsQuery} />
    </Screen>
  );
}
