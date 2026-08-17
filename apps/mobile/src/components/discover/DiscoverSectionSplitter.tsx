import { useTranslation } from "react-i18next";
import { TabSectionSplitter } from "../TabSectionSplitter";
import { formatDiscoverResultsLabel } from "../../lib/discover-results-label";

export function DiscoverSectionSplitter({
  segment,
  count,
  nearbyOnly,
}: {
  segment: "players" | "matches";
  count: number;
  /** True only when a zone restriction is actually in effect. */
  nearbyOnly: boolean;
}) {
  const { t } = useTranslation();

  return (
    <TabSectionSplitter
      label={formatDiscoverResultsLabel(segment, count, t, nearbyOnly)}
    />
  );
}
