import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useAuth } from "../providers/AuthProvider";
import { syncDevicePushToken } from "../lib/push-notifications";

export function PushTokenRegistration() {
  const { session } = useAuth();

  useEffect(() => {
    if (!session) {
      return;
    }

    let active = true;

    const sync = async () => {
      if (!active) {
        return;
      }
      await syncDevicePushToken().catch(() => undefined);
    };

    void sync();

    const onAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        void sync();
      }
    };

    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => {
      active = false;
      subscription.remove();
    };
  }, [session?.user.id]);

  return null;
}
