import { useEffect } from "react";
import { useAuth } from "../providers/AuthProvider";
import { syncStoredLocaleToServer } from "../lib/locale-sync";

/**
 * Records the signed-in player's language on their profile so push copy can be
 * composed in it. Runs once per session rather than on every foreground: the
 * value only changes from Settings, which writes it directly.
 */
export function NotificationLocaleSync() {
  const { session } = useAuth();

  useEffect(() => {
    if (!session) {
      return;
    }

    void syncStoredLocaleToServer();
  }, [session?.user.id]);

  return null;
}
