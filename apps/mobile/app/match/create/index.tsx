import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  getOwnPlayerProfile,
  listOwnPreferredZoneIds,
} from "@tennis-lebanon/api";
import { AppText } from "../../../src/components/AppText";
import { ErrorNotice } from "../../../src/components/FormUi";
import { FigmaPrimaryButton } from "../../../src/components/onboarding-ui";
import {
  createMatchDraftHasInviteTarget,
  hydrateCreateMatchDraftFromProfile,
} from "../../../src/lib/hydrate-create-match-draft";
import { resetCreateMatchDraft } from "../../../src/lib/create-match-draft";
import { supabase } from "../../../src/lib/supabase";
import { tennisColors } from "../../../src/theme/tennis-tokens";
import { tennisFontFamily } from "../../../src/hooks/useTennisFonts";

/**
 * Entry point for every create. Loads the host's profile defaults, seeds the
 * draft from them, and hands off to the one screen that still needs input.
 *
 * There is no first-create step: hosting defaults are edited in
 * Profile → Match defaults, and anything can be overridden per match from the
 * schedule screen's summary bar.
 */
export default function CreateMatchIndexScreen() {
  const { t } = useTranslation();
  const isInviteFlow = createMatchDraftHasInviteTarget();

  const profileQuery = useQuery({
    queryKey: ["own-player-profile"],
    queryFn: () => getOwnPlayerProfile(supabase),
    enabled: !isInviteFlow,
  });

  const zonesQuery = useQuery({
    queryKey: ["own-preferred-zones"],
    queryFn: () => listOwnPreferredZoneIds(supabase),
    enabled: !isInviteFlow,
  });

  useEffect(() => {
    // The invite-a-player flow already prefilled the draft, including
    // invite-only visibility. Overwriting it with host defaults would relist
    // the match publicly.
    if (isInviteFlow) {
      router.replace("/match/create/schedule");
      return;
    }

    if (profileQuery.isError || zonesQuery.isError) {
      return;
    }

    if (!profileQuery.isSuccess || !zonesQuery.isSuccess) {
      return;
    }

    resetCreateMatchDraft();
    hydrateCreateMatchDraftFromProfile(profileQuery.data, zonesQuery.data);
    router.replace("/match/create/schedule");
  }, [
    isInviteFlow,
    profileQuery.data,
    profileQuery.isError,
    profileQuery.isSuccess,
    zonesQuery.data,
    zonesQuery.isError,
    zonesQuery.isSuccess,
  ]);

  const loadError = profileQuery.isError || zonesQuery.isError;

  if (loadError) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tennisColors.background,
          gap: 12,
          padding: 24,
        }}
      >
        <ErrorNotice>{t("matches.create.loadProfileError")}</ErrorNotice>
        <FigmaPrimaryButton
          label={t("common.retry")}
          onPress={() => {
            void profileQuery.refetch();
            void zonesQuery.refetch();
          }}
        />
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tennisColors.background,
        gap: 12,
      }}
    >
      <ActivityIndicator color={tennisColors.primary} />
      <AppText
        style={{
          fontFamily: tennisFontFamily.body,
          color: tennisColors.mutedForeground,
        }}
      >
        {t("common.loading")}
      </AppText>
    </View>
  );
}
