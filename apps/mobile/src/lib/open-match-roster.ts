import type { OpenMatchCard } from "@tennis-lebanon/api";
import type { MatchCardProps } from "../components/match/FigmaMatchCard";
import { shortPlayerName } from "./home-v5";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * Who is already in an open listing, as match-card props. "+N" counts from
 * participant_count, which still includes anyone the server left out of the
 * roster because they are blocked with the viewer. With faces stacked beside
 * it, the host's name is shortened so the "+N" and the badge still fit.
 */
export function openMatchRosterProps(
  match: Pick<
    OpenMatchCard,
    "participants" | "participant_count" | "creator_display_name"
  >,
  t: Translate,
): Pick<MatchCardProps, "headline" | "hostRoster" | "hostOthers"> {
  const others = Math.max(match.participant_count - 1, 0);
  if (others === 0) return { headline: match.creator_display_name };

  return {
    headline: shortPlayerName(match.creator_display_name),
    hostRoster: match.participants.map((player) => ({
      name: player.display_name,
      avatarPath: player.avatar_path,
    })),
    hostOthers: {
      label: t("discover.rosterMore", { count: others }),
      accessibilityLabel: t("discover.rosterA11y", {
        name: match.creator_display_name,
        count: others,
      }),
    },
  };
}
