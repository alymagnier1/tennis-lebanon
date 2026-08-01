import { Redirect } from "expo-router";

/** Tennis preferences now live on the Profile tab. */
export default function TennisPreferencesScreen() {
  return <Redirect href="/(tabs)/profile" />;
}
