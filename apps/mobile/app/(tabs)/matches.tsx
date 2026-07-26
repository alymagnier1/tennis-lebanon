import { useState } from "react";

import { Alert, Text, View } from "react-native";

import { router } from "expo-router";

import { useTranslation } from "react-i18next";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {

  acceptMatchInvitation,

  declineMatchInvitation,

  extendMatchListing,

  listMyMatchInvites,

  listMyMatches,

} from "@tennis-lebanon/api";

import {

  EmptyState,

  MatchCard,

  SegmentTabs,

  appStyles,

} from "../../src/components/AppUi";

import {

  PrimaryButton,

  Screen,

  SecondaryButton,

  formStyles,

} from "../../src/components/FormUi";

import { formatUtcInBeirut } from "../../src/lib/beirut-time";

import { supabase } from "../../src/lib/supabase";

import { CREATE_MATCH_ROUTE } from "../../src/lib/routes";



type MatchesSegment = "invites" | "active";



export default function MatchesScreen() {

  const { t } = useTranslation();

  const queryClient = useQueryClient();

  const [segment, setSegment] = useState<MatchesSegment>("invites");



  const invitesQuery = useQuery({

    queryKey: ["my-match-invites"],

    queryFn: () => listMyMatchInvites(supabase),

  });



  const matchesQuery = useQuery({

    queryKey: ["my-matches"],

    queryFn: () => listMyMatches(supabase),

  });



  const invalidate = async () => {

    await queryClient.invalidateQueries({ queryKey: ["my-match-invites"] });

    await queryClient.invalidateQueries({ queryKey: ["my-matches"] });

    await queryClient.invalidateQueries({ queryKey: ["match-hub"] });

    await queryClient.invalidateQueries({ queryKey: ["discover-matches"] });

  };



  const acceptMutation = useMutation({

    mutationFn: (invitationId: string) =>

      acceptMatchInvitation(supabase, invitationId),

    onSuccess: async (matchId) => {

      await invalidate();

      router.push({

        pathname: "/match/[id]",

        params: { id: matchId },

      });

    },

    onError: () => Alert.alert(t("matches.invite.acceptError")),

  });



  const declineMutation = useMutation({

    mutationFn: (invitationId: string) =>

      declineMatchInvitation(supabase, invitationId),

    onSuccess: invalidate,

    onError: () => Alert.alert(t("matches.invite.declineError")),

  });



  const extendMutation = useMutation({

    mutationFn: (matchId: string) => extendMatchListing(supabase, matchId),

    onSuccess: invalidate,

    onError: () => Alert.alert(t("matches.lifecycle.extendError")),

  });



  const refreshing =

    invitesQuery.isRefetching || matchesQuery.isRefetching;



  const onRefresh = async () => {

    await Promise.all([invitesQuery.refetch(), matchesQuery.refetch()]);

  };



  const showEmptyInvites =

    segment === "invites" &&

    invitesQuery.data?.length === 0 &&

    !invitesQuery.isLoading;



  const showEmptyActive =

    segment === "active" &&

    matchesQuery.data?.length === 0 &&

    !matchesQuery.isLoading;



  return (

    <Screen
      title={t("matches.list.title")}
      showTitle={false}
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
    >

      <SegmentTabs

        value={segment}

        options={[

          { value: "invites", label: t("matches.invite.inboxTab") },

          { value: "active", label: t("matches.list.activeTab") },

        ]}

        onChange={setSegment}

      />



      {segment === "invites" ? (

        <>

          {invitesQuery.isError ? (

            <Text style={formStyles.errorText}>

              {t("matches.invite.inboxLoadError")}

            </Text>

          ) : null}



          {showEmptyInvites ? (

            <EmptyState

              title={t("matches.invite.inboxEmptyTitle")}

              body={t("matches.invite.inboxEmpty")}

              action={

                <PrimaryButton

                  label={t("matches.create.organiseCta")}

                  onPress={() => router.push(CREATE_MATCH_ROUTE)}

                />

              }

            />

          ) : null}



          <View style={appStyles.cardList}>

            {invitesQuery.data?.map((invite) => (

              <View key={invite.invitation_id} style={formStyles.card}>

                <MatchCard

                  title={`${t(`formats.${invite.format}`)} · ${invite.inviter_display_name}`}

                  subtitle={t("matches.invite.fromCreator", {

                    name: invite.creator_display_name,

                  })}

                  meta={`${invite.participant_count}/${invite.capacity} · ${t(`matches.status.${invite.match_status}`)}${invite.soonest_time ? ` · ${formatUtcInBeirut(invite.soonest_time)}` : ""}`}

                />

                <PrimaryButton

                  label={t("matches.invite.accept")}

                  loading={acceptMutation.isPending}

                  onPress={() => acceptMutation.mutate(invite.invitation_id)}

                />

                <SecondaryButton

                  label={t("matches.invite.decline")}

                  disabled={declineMutation.isPending}

                  onPress={() => declineMutation.mutate(invite.invitation_id)}

                />

              </View>

            ))}

          </View>

        </>

      ) : (

        <>

          {matchesQuery.isError ? (

            <Text style={formStyles.errorText}>

              {t("matches.list.loadError")}

            </Text>

          ) : null}



          {showEmptyActive ? (

            <EmptyState

              title={t("matches.list.emptyTitle")}

              body={t("matches.list.empty")}

              action={

                <PrimaryButton

                  label={t("matches.create.organiseCta")}

                  onPress={() => router.push(CREATE_MATCH_ROUTE)}

                />

              }

            />

          ) : null}



          <View style={appStyles.cardList}>

            {matchesQuery.data?.map((match) => (

              <View key={match.match_id} style={formStyles.stack}>

                <MatchCard

                  title={`${t(`formats.${match.format}`)} · ${t(`matches.status.${match.status}`)}`}

                  subtitle={`${t(`matches.participantStatus.${match.participant_status}`)}${match.is_creator ? ` · ${t("matches.list.creator")}` : ""}`}

                  badge={

                    match.is_stale_warning

                      ? t("matches.lifecycle.staleBadge")

                      : undefined

                  }

                  meta={

                    match.soonest_time

                      ? formatUtcInBeirut(match.soonest_time)

                      : undefined

                  }

                  note={match.notes ?? undefined}

                  onPress={() =>

                    router.push({

                      pathname: "/match/[id]",

                      params: { id: match.match_id },

                    })

                  }

                />

                {match.can_extend_listing ? (

                  <SecondaryButton

                    label={t("matches.lifecycle.extendListing")}

                    loading={extendMutation.isPending}

                    onPress={() => extendMutation.mutate(match.match_id)}

                  />

                ) : null}

              </View>

            ))}

          </View>

        </>

      )}

    </Screen>

  );

}

