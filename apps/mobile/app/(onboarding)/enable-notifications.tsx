import { Redirect } from "expo-router";

/** Push opt-in lives in Profile. Kept so leftover deep links do not 404. */
export default function NotificationPrimerScreen() {
  return <Redirect href="/(onboarding)/zones" />;
}
