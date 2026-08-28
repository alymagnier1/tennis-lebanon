import { Redirect } from "expo-router";

/** Folded into identity (step 2/3). Kept so leftover deep links do not 404. */
export default function TennisProfileScreen() {
  return <Redirect href="/(onboarding)/identity" />;
}
