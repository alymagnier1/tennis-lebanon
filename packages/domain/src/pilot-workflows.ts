import type { PilotCriticalFlow } from "./critical-flows";

export const PILOT_WORKFLOW_REHEARSALS = [
  {
    id: "workflow.join_public_match",
    title: "Join a public match",
    flowsDoc: "Flow A",
    criticalFlows: [
      "discover.matches",
      "match.hub",
    ] satisfies PilotCriticalFlow[],
  },
  {
    id: "workflow.create_and_book",
    title: "Create a match and request a court",
    flowsDoc: "Flow B",
    criticalFlows: [
      "match.create",
      "match.hub",
      "match.book",
      "clubs.directory",
    ] satisfies PilotCriticalFlow[],
  },
  {
    id: "workflow.club_queue",
    title: "Club processes a booking request",
    flowsDoc: "Flow C",
    criticalFlows: ["clubs.directory"] satisfies PilotCriticalFlow[],
  },
  {
    id: "workflow.result_and_rating",
    title: "Complete match and update rating",
    flowsDoc: "Flow D",
    criticalFlows: [
      "match.result",
      "matches.list",
    ] satisfies PilotCriticalFlow[],
  },
  {
    id: "workflow.safety_escalation",
    title: "Report user and admin moderation",
    flowsDoc: "Platform admin",
    criticalFlows: ["player.report"] satisfies PilotCriticalFlow[],
  },
] as const;

export type PilotWorkflowRehearsalId =
  (typeof PILOT_WORKFLOW_REHEARSALS)[number]["id"];
