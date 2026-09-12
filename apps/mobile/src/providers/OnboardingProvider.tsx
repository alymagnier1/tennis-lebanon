import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type {
  Gender,
  PlayIntent,
  SkillBand,
  SupportedLanguage,
} from "@tennis-lebanon/domain";
import {
  deviceStorageKey,
  readDeviceValue,
  removeDeviceValue,
  writeDeviceValue,
} from "../lib/device-storage";
import { useAuth } from "./AuthProvider";

export interface OnboardingDraft {
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  acceptedCommunityRules: boolean;
  displayName: string;
  birthYear: string;
  isAdultConfirmed: boolean;
  languages: SupportedLanguage[];
  gender: Gender | null;
  skillBand: SkillBand | null;
  playIntent: PlayIntent;
  prefersSingles: boolean;
  prefersDoubles: boolean;
  zoneIds: string[];
}

const initialDraft: OnboardingDraft = {
  acceptedTerms: false,
  acceptedPrivacy: false,
  acceptedCommunityRules: false,
  displayName: "",
  birthYear: "",
  isAdultConfirmed: false,
  languages: ["en"],
  gender: null,
  skillBand: null,
  playIntent: "either",
  prefersSingles: true,
  prefersDoubles: true,
  zoneIds: [],
};

interface OnboardingContextValue {
  draft: OnboardingDraft;
  hydrated: boolean;
  updateDraft: (value: Partial<OnboardingDraft>) => void;
  clearDraft: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

function draftKey(userId: string): string {
  return deviceStorageKey("onboarding", userId);
}

export function OnboardingProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [draft, setDraft] = useState(initialDraft);
  const [hydrated, setHydrated] = useState(false);
  const userId = session?.user.id;

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!userId) {
        if (active) setHydrated(true);
        return;
      }
      const stored = await readDeviceValue(draftKey(userId));
      if (active && stored) {
        try {
          setDraft({ ...initialDraft, ...JSON.parse(stored) });
        } catch {
          await removeDeviceValue(draftKey(userId));
        }
      }
      if (active) setHydrated(true);
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (hydrated && userId) {
      void writeDeviceValue(draftKey(userId), JSON.stringify(draft));
    }
  }, [draft, hydrated, userId]);

  const updateDraft = useCallback((value: Partial<OnboardingDraft>) => {
    setDraft((current) => ({ ...current, ...value }));
  }, []);

  const clearDraft = useCallback(async () => {
    setDraft(initialDraft);
    if (userId) await removeDeviceValue(draftKey(userId));
  }, [userId]);

  const value = useMemo(
    () => ({ draft, hydrated, updateDraft, clearDraft }),
    [clearDraft, draft, hydrated, updateDraft],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return context;
}
