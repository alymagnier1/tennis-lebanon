import { Redirect } from "expo-router";

/** Submit moved to the zones step. Kept so leftover deep links do not 404. */
export default function ReviewScreen() {
  return <Redirect href="/(onboarding)/zones" />;
}
