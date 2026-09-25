# 08 — The Welcome / Done variant switch

Welcome has two approved designs (5a green, 2a mint) and Done has two (2f green, 2e clay).
The pick is deferred, so both ship behind one switch. Apply this before `01` and `07`.

## One decision, two screens

A single `family` value drives both screens:

| `family`  | Welcome | Done |
| --------- | ------- | ---- |
| `"green"` | 5a      | 2f   |
| `"light"` | 2a      | 2e   |

Welcome and Done must never disagree — that is the whole reason this is one provider and
not two local `useState`s.

## Three modes

| Mode      | Behaviour                            | For                              |
| --------- | ------------------------------------ | -------------------------------- |
| `"green"` | pinned to green                      | shipping once you decide         |
| `"light"` | pinned to light                      | shipping once you decide         |
| `"cycle"` | alternates per app launch, persisted | living with both before deciding |

`cycle` flips on each cold start rather than on each screen mount — otherwise a user who
taps back from Sign up sees Welcome change under them, which reads as a bug rather than
a choice. One launch is one consistent flow.

Set `DEFAULT_MODE` below to `"cycle"` while deciding. When you pick a winner, set it to
`"green"` or `"light"`, then delete the loser's branch from `AuthHeroLayout` and
`complete.tsx` and drop this provider.

## `src/theme/hero-variant.tsx` (new)

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type HeroFamily = "green" | "light";
export type HeroVariantMode = HeroFamily | "cycle";

/** Set to "green" or "light" once the design is chosen; "cycle" while deciding. */
const DEFAULT_MODE: HeroVariantMode = "cycle";

const MODE_KEY = "racketbound.heroVariant.mode";
const LAST_KEY = "racketbound.heroVariant.lastLaunch";

type HeroVariantValue = {
  /** Resolved family — what Welcome and Done should render right now. */
  family: HeroFamily;
  mode: HeroVariantMode;
  setMode: (mode: HeroVariantMode) => void;
};

const HeroVariantContext = createContext<HeroVariantValue>({
  family: "green",
  mode: DEFAULT_MODE,
  setMode: () => {},
});

function other(family: HeroFamily): HeroFamily {
  return family === "green" ? "light" : "green";
}

export function HeroVariantProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<HeroVariantMode>(DEFAULT_MODE);
  // Resolved once per launch so the family cannot change mid-flow.
  const [cycled, setCycled] = useState<HeroFamily>("green");

  useEffect(() => {
    let active = true;
    void (async () => {
      const [storedMode, storedLast] = await Promise.all([
        AsyncStorage.getItem(MODE_KEY),
        AsyncStorage.getItem(LAST_KEY),
      ]);
      if (!active) return;

      if (
        storedMode === "green" ||
        storedMode === "light" ||
        storedMode === "cycle"
      ) {
        setModeState(storedMode);
      }

      const previous: HeroFamily = storedLast === "light" ? "light" : "green";
      const next = other(previous);
      setCycled(next);
      void AsyncStorage.setItem(LAST_KEY, next);
    })();
    return () => {
      active = false;
    };
  }, []);

  const setMode = useCallback((next: HeroVariantMode) => {
    setModeState(next);
    void AsyncStorage.setItem(MODE_KEY, next);
  }, []);

  const value = useMemo<HeroVariantValue>(
    () => ({
      family: mode === "cycle" ? cycled : mode,
      mode,
      setMode,
    }),
    [mode, cycled, setMode],
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
```

Mount `HeroVariantProvider` in `app/_layout.tsx`, inside the theme provider and outside
the navigator, so a mode change re-renders the screens without remounting navigation.

## Consuming it

```tsx
// app/(public)/welcome.tsx
const { family } = useHeroVariant();
return <AuthHeroLayout variant={family} …>
```

`AuthHeroLayout` takes `variant: HeroFamily` and picks the layer set from `01-welcome.md`
(`green` → 5a, `light` → 2a). `complete.tsx` does the same with `07-done.md`
(`green` → 2f, `light` → 2e).

Build each variant as a **flat token record**, not branching JSX — one `heroFields[family]`
object holding ground, art, scrim stops and ink, consumed by one tree. Two parallel JSX
branches drift the moment either is edited.

## Manual toggle while deciding

The cycle handles passive comparison; a toggle is for showing both to someone on the spot.
Add it to `app/(tabs)/profile` under the existing appearance control, wrapped in
`__DEV__` (or your `showDevTools` flag) so it never ships.

Three segments — Green, Light, Cycle — using the same segmented control as the
appearance preference, calling `setMode`. Label it "Onboarding hero" with the hint
"Design comparison. Welcome and Done follow this together."

Because Welcome and Done read the resolved `family`, flipping the segment updates both;
walking to `/(onboarding)/complete` afterwards shows the matching end screen.

## Acceptance

- Two cold starts in `cycle` mode give different families; a warm resume never changes family.
- Navigating Welcome → Sign up → back does not change the Welcome variant.
- Welcome and Done always match within one session.
- The dev toggle is absent from a release build.
- Removing the provider and one branch each from Welcome and Done is a clean deletion —
  no other screen imports `useHeroVariant`.
