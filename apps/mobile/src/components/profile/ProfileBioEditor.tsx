import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { createLiveSheet } from "../../theme/create-live-sheet";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOwnBio } from "@tennis-lebanon/api";
import { AppText } from "../AppText";
import { profileScreenBioPlaceholder } from "../../lib/profile-screen-copy";
import { useLayoutDirection } from "../../lib/layout-direction";
import { supabase } from "../../lib/supabase";
import { tennisColors, tennisRadii } from "../../theme/tennis-tokens";
import { tennisFontFamily } from "../../hooks/useTennisFonts";

export function ProfileBioEditor({ bio }: { bio: string | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { writingDirection } = useLayoutDirection();
  const [draft, setDraft] = useState(bio ?? "");
  const [lastSaved, setLastSaved] = useState(bio ?? "");
  const [syncedBio, setSyncedBio] = useState(bio);

  // Reset the draft when the saved bio changes underneath us. Adjusting state
  // during render is React's documented pattern for this; doing it in an
  // effect costs an extra render pass and trips the cascading-render rule.
  if (bio !== syncedBio) {
    setSyncedBio(bio);
    setDraft(bio ?? "");
    setLastSaved(bio ?? "");
  }

  const saveMutation = useMutation({
    // Bio only. Sending the unchanged display name along with it made this
    // save depend on permission to rewrite identity, which is how it broke.
    mutationFn: (nextBio: string) => updateOwnBio(supabase, nextBio),
    onSuccess: async (_, nextBio) => {
      setLastSaved(nextBio);
      await queryClient.invalidateQueries({ queryKey: ["own-player-profile"] });
    },
  });

  const saveIfChanged = () => {
    const normalized = draft.trim();
    const savedNormalized = lastSaved.trim();
    if (normalized === savedNormalized || saveMutation.isPending) return;
    saveMutation.mutate(draft);
  };

  return (
    <View style={styles.wrap}>
      <TextInput
        accessibilityLabel={t("profile.bioLabel")}
        multiline
        numberOfLines={4}
        onBlur={saveIfChanged}
        onChangeText={setDraft}
        placeholder={profileScreenBioPlaceholder(t)}
        placeholderTextColor={tennisColors.mutedForeground}
        style={[styles.input, { writingDirection }]}
        value={draft}
      />
      {saveMutation.isError ? (
        <AppText style={styles.error}>{t("profile.saveError")}</AppText>
      ) : null}
    </View>
  );
}

const styles = createLiveSheet(() =>
  StyleSheet.create({
    wrap: {
      gap: 6,
    },
    input: {
      fontFamily: tennisFontFamily.body,
      fontSize: 14,
      lineHeight: 22,
      color: tennisColors.primaryDark,
      minHeight: 100,
      textAlignVertical: "top",
      padding: 12,
      borderRadius: tennisRadii.md,
      borderWidth: 1,
      borderColor: tennisColors.border,
      backgroundColor: tennisColors.muted,
    },
    error: {
      fontFamily: tennisFontFamily.body,
      fontSize: 12,
      color: tennisColors.accent,
    },
  }),
);
