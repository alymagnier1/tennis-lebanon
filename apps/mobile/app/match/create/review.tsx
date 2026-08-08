import { Redirect } from "expo-router";

/**
 * Review step merged into schedule; keep route for deep links.
 *
 * Points at the orchestrator rather than schedule directly: schedule renders
 * nothing without a hydrated draft, and a deep link never has one.
 */
export default function CreateMatchReviewScreen() {
  return <Redirect href="/match/create" />;
}
