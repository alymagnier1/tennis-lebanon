import { useTranslation } from "react-i18next";
import { TabSectionSplitter } from "../TabSectionSplitter";
import { formatDiscoverResultsLabel } from "../../lib/discover-results-label";

export function DiscoverSectionSplitter({
  segment,
  count,
}: {
  segment: "players" | "matches";
  count: number;
}) {
  const { t } = useTranslation();

  return (
    <TabSectionSplitter label={formatDiscoverResultsLabel(segment, count, t)} />
  );
}
