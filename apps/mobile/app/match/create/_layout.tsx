import { useEffect } from "react";
import { Stack, usePathname } from "expo-router";
import {
  beginCreateFlowTracking,
  trackCreateFlowExit,
  trackCreateStep,
} from "../../../src/lib/create-flow-analytics";

export default function CreateMatchLayout() {
  const pathname = usePathname();

  /**
   * Abandonment is a non-event — the host just goes elsewhere — so it is emitted
   * when this stack unmounts, using the last step the layout saw. Mount resets
   * first so a previous flow cannot be attributed to this one.
   */
  useEffect(() => {
    beginCreateFlowTracking();
    return () => trackCreateFlowExit();
  }, []);

  useEffect(() => {
    trackCreateStep(pathname);
  }, [pathname]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="details" />
      <Stack.Screen name="schedule" />
    </Stack>
  );
}
