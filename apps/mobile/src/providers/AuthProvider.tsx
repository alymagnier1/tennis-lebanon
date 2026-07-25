import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOwnProfile } from "@tennis-lebanon/api";
import { deriveAccessState, type AccessState } from "../lib/access-state";
import { supabase } from "../lib/supabase";

type Profile = Awaited<ReturnType<typeof getOwnProfile>>;

interface AuthContextValue {
  session: Session | null;
  profile: Profile;
  state: AccessState;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setInitialized(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setInitialized(true);
      if (!nextSession) {
        queryClient.removeQueries({ queryKey: ["own-profile"] });
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const profileQuery = useQuery({
    queryKey: ["own-profile", session?.user.id],
    queryFn: () => getOwnProfile(supabase),
    enabled: Boolean(session),
    retry: 1,
    staleTime: 30_000,
  });

  const state = deriveAccessState(
    Boolean(session),
    profileQuery.data ?? null,
    !initialized || (Boolean(session) && profileQuery.isLoading),
    profileQuery.isError,
  );

  const refreshProfile = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["own-profile"] });
  }, [queryClient]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile: profileQuery.data ?? null,
      state,
      refreshProfile,
      signOut,
    }),
    [profileQuery.data, refreshProfile, session, signOut, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
