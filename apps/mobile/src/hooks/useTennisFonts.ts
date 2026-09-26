import { useFonts } from "expo-font";
// One weight per import: the packages' index files `require` every weight and
// italic (27 font files), and Metro bundles everything a module requires. Only
// these eight are used.
import { Outfit_400Regular } from "@expo-google-fonts/outfit/400Regular";
import { Outfit_500Medium } from "@expo-google-fonts/outfit/500Medium";
import { Outfit_600SemiBold } from "@expo-google-fonts/outfit/600SemiBold";
import { Outfit_700Bold } from "@expo-google-fonts/outfit/700Bold";
import { Outfit_800ExtraBold } from "@expo-google-fonts/outfit/800ExtraBold";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";

export function useTennisFonts() {
  const [loaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  return loaded;
}

export const tennisFontFamily = {
  heading: "Outfit_700Bold",
  headingExtra: "Outfit_800ExtraBold",
  headingSemi: "Outfit_600SemiBold",
  /** Frame A names — Outfit 500, lighter than semi-bold. */
  headingMedium: "Outfit_500Medium",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemi: "Inter_600SemiBold",
} as const;
