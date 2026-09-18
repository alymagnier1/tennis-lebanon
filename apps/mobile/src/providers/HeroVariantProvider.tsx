import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { readDeviceValue, writeDeviceValue } from "../lib/device-storage";
import {
  DEFAULT_HERO_FAMILY,
  HERO_VARIANT_STORAGE_KEY,
  parseHeroFamily,
  type HeroFamily,
} from "../theme/hero-variant";

type HeroVariantValue = {
  family: HeroFamily;
  setFamily: (family: HeroFamily) => void;
};

const HeroVariantContext = createContext<HeroVariantValue>({
  family: DEFAULT_HERO_FAMILY,
  setFamily: () => undefined,
});

export function HeroVariantProvider({ children }: PropsWithChildren) {
  const [family, setFamilyState] = useState<HeroFamily>(DEFAULT_HERO_FAMILY);

  useEffect(() => {
    if (!__DEV__) return;
    let active = true;
    void readDeviceValue(HERO_VARIANT_STORAGE_KEY).then((stored) => {
      if (!active) return;
      setFamilyState(parseHeroFamily(stored));
    });
    return () => {
      active = false;
    };
  }, []);

  const setFamily = useCallback((next: HeroFamily) => {
    if (!__DEV__) return;
    setFamilyState(next);
    void writeDeviceValue(HERO_VARIANT_STORAGE_KEY, next);
  }, []);

  const value = useMemo<HeroVariantValue>(
    () => ({ family, setFamily }),
    [family, setFamily],
  );

  return (
    <HeroVariantContext.Provider value={value}>
      {children}
    </HeroVariantContext.Provider>
  );
}

export function useHeroVariant(): HeroVariantValue {
  return useContext(HeroVariantContext);
}
