import { View } from "react-native";
import { useAuth } from "../../src/providers/AuthProvider";
import { HomeDashboard } from "../../src/components/home/HomeDashboard";
import { HomeDashboardV5 } from "../../src/components/home/HomeDashboardV5";

/** Set to false to fall back to the classic Home. */
const USE_HOME_V5 = true;

export default function HomeScreen() {
  const { profile } = useAuth();
  const displayName = profile?.display_name ?? "";

  return (
    <View style={{ flex: 1 }}>
      {USE_HOME_V5 ? (
        <HomeDashboardV5 displayName={displayName} />
      ) : (
        <HomeDashboard displayName={displayName} />
      )}
    </View>
  );
}
