import { View } from "react-native";
import { useAuth } from "../../src/providers/AuthProvider";
import { HomeDashboard } from "../../src/components/home/HomeDashboard";

export default function HomeScreen() {
  const { profile } = useAuth();

  return (
    <View style={{ flex: 1 }}>
      <HomeDashboard displayName={profile?.display_name ?? ""} />
    </View>
  );
}
