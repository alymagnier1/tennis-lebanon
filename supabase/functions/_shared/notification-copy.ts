/**
 * Localized push copy, keyed by recipient locale and notification kind.
 *
 * Push text is composed here, in the Edge Function, so it cannot read the
 * mobile app's i18n bundle at runtime. These strings are therefore duplicated
 * from `packages/i18n/src/locales/*.json` under `notifications.kinds.*`.
 * The duplication is deliberate — importing across the monorepo into the Deno
 * bundle is fragile at deploy time — and it is guarded: the parity test in
 * `apps/mobile/src/lib/notification-copy-parity.test.ts` fails if the two ever
 * disagree, so neither can drift. (It lives in the mobile app because
 * `packages/i18n` and `packages/domain` both pin `rootDir` to their own `src`
 * and so cannot reference a file under `supabase/`.)
 *
 * Placeholders use i18next's `{{name}}` syntax for exactly that reason: the two
 * copies stay byte-identical.
 */

export const NOTIFICATION_LOCALES = ["en", "ar", "fr"] as const;

export type NotificationLocale = (typeof NOTIFICATION_LOCALES)[number];

export const DEFAULT_NOTIFICATION_LOCALE: NotificationLocale = "en";

export type NotificationCopyEntry = {
  title: string;
  body: string;
};

export const NOTIFICATION_COPY: Record<
  NotificationLocale,
  Record<string, NotificationCopyEntry>
> = {
  en: {
    match_invitation: {
      title: "{{name}} invited you to play",
      body: "Tap to accept or decline.",
    },
    stale_match_reminder: {
      title: "Your match expires soon",
      body: "No time agreed yet. Add one or keep it open.",
    },
    match_expired: {
      title: "Your match expired",
      body: "No time was agreed. Start a new one anytime.",
    },
    match_cancelled: {
      title: "Your match was cancelled",
      body: "Tap to see why.",
    },
    booking_pending_club: {
      title: "The club replied",
      body: "Tap to see if your court is confirmed.",
    },
    booking_stale_participant: {
      title: "Court not confirmed yet",
      body: "The club hasn't replied. Chase it or try another club.",
    },
    attendance_prompt: {
      title: "Did you play?",
      body: "Let us know so the result counts.",
    },
    match_time_changed: {
      title: "Your match has a new time",
      body: "Check it still works for you.",
    },
    match_court_confirmed: {
      title: "Your court is booked",
      body: "You're all set. Tap for the details.",
    },
    match_court_released: {
      title: "Your court fell through",
      body: "{{clubName}} at {{startsAt}} is off. Find another court.",
    },
    court_first_roster_short: {
      title: "Court booked, players missing",
      body: "{{clubName}}, {{startsAt}}. Spots open: {{spotsLeft}}.",
    },
    match_played_prompt: {
      title: "Did your match happen?",
      body: "Your match on {{startsAt}} had no court in the app. Did you play?",
    },
    match_played_confirmed: {
      title: "Confirm you played",
      body: "Add the score so the result counts.",
    },
    match_join_request: {
      title: "Someone wants to join",
      body: "Tap to accept or decline.",
    },
    match_request_accepted: {
      title: "You're in!",
      body: "The host accepted you. Tap for time and place.",
    },
    match_request_declined: {
      title: "Request not accepted",
      body: "Other matches are still looking for players.",
    },
    match_invitation_superseded: {
      title: "That match filled up",
      body: "Other matches near you still need players.",
    },
    match_seat_reopened: {
      title: "A spot opened up",
      body: "Someone dropped out. Your invite is back on.",
    },
    match_request_withdrawn: {
      title: "Join request withdrawn",
      body: "A player changed their mind.",
    },
    match_participant_joined: {
      title: "A player joined your match",
      body: "Your match is filling up.",
    },
    match_participant_left: {
      title: "A player left your match",
      body: "Invite someone to take the spot.",
    },
    match_participant_removed: {
      title: "You were removed from a match",
      body: "The host removed you. {{reason}}",
    },
    match_message: {
      title: "New message",
      body: "Your match group is chatting.",
    },
    result_confirm_request: {
      title: "Confirm the score",
      body: "Your opponent added it. Confirm it or flag a mistake.",
    },
    result_auto_confirmed: {
      title: "Score confirmed",
      body: "No one objected within 3 days, so it stands.",
    },
  },
  ar: {
    match_invitation: {
      title: "دعاك {{name}} للعب",
      body: "اضغط للقبول أو الرفض.",
    },
    stale_match_reminder: {
      title: "مباراتك تنتهي قريبًا",
      body: "لم يُحدَّد موعد بعد. أضف موعدًا أو أبقِها مفتوحة.",
    },
    match_expired: {
      title: "انتهت مباراتك",
      body: "لم يُحدَّد موعد. أنشئ مباراة جديدة متى شئت.",
    },
    match_cancelled: {
      title: "أُلغيت مباراتك",
      body: "اضغط لمعرفة السبب.",
    },
    booking_pending_club: {
      title: "ردّ النادي",
      body: "اضغط لمعرفة إن تم تأكيد ملعبك.",
    },
    booking_stale_participant: {
      title: "ملعبك لم يُؤكَّد بعد",
      body: "لم يردّ النادي. تابع الطلب أو جرّب ناديًا آخر.",
    },
    attendance_prompt: {
      title: "هل لعبت؟",
      body: "أخبرنا لتُحتسب النتيجة.",
    },
    match_time_changed: {
      title: "موعد جديد لمباراتك",
      body: "تأكد أنه ما زال مناسبًا لك.",
    },
    match_court_confirmed: {
      title: "تم حجز ملعبك",
      body: "كل شيء جاهز. اضغط للتفاصيل.",
    },
    match_court_released: {
      title: "تعذّر حجز ملعبك",
      body: "لم يعد {{clubName}} في {{startsAt}} متاحًا. ابحث عن ملعب آخر.",
    },
    court_first_roster_short: {
      title: "الملعب محجوز والعدد ناقص",
      body: "{{clubName}}، {{startsAt}}. الأماكن المتبقية: {{spotsLeft}}.",
    },
    match_played_prompt: {
      title: "هل جرت مباراتك؟",
      body: "مباراتك في {{startsAt}} لم يكن لها ملعب في التطبيق. هل لعبت؟",
    },
    match_played_confirmed: {
      title: "أكّد أنك لعبت",
      body: "أضف النتيجة لتُحتسب.",
    },
    match_join_request: {
      title: "أحدهم يريد الانضمام",
      body: "اضغط للقبول أو الرفض.",
    },
    match_request_accepted: {
      title: "أنت في المباراة!",
      body: "قبلك المضيف. اضغط لمعرفة الوقت والمكان.",
    },
    match_request_declined: {
      title: "لم يُقبل طلبك",
      body: "مباريات أخرى لا تزال تبحث عن لاعبين.",
    },
    match_invitation_superseded: {
      title: "اكتملت تلك المباراة",
      body: "مباريات أخرى قريبة منك تبحث عن لاعبين.",
    },
    match_seat_reopened: {
      title: "شغر مكان",
      body: "انسحب أحد اللاعبين. دعوتك متاحة مجددًا.",
    },
    match_request_withdrawn: {
      title: "سُحب طلب انضمام",
      body: "غيّر أحد اللاعبين رأيه.",
    },
    match_participant_joined: {
      title: "انضم لاعب إلى مباراتك",
      body: "مباراتك تكتمل.",
    },
    match_participant_left: {
      title: "غادر لاعب مباراتك",
      body: "ادعُ أحدًا ليأخذ مكانه.",
    },
    match_participant_removed: {
      title: "أُزلت من مباراة",
      body: "أزالك المضيف. {{reason}}",
    },
    match_message: {
      title: "رسالة جديدة",
      body: "هناك حديث في مجموعة مباراتك.",
    },
    result_confirm_request: {
      title: "أكّد النتيجة",
      body: "أضافها خصمك. أكّدها أو أشر إلى خطأ.",
    },
    result_auto_confirmed: {
      title: "تم تأكيد النتيجة",
      body: "لم يعترض أحد خلال 3 أيام، لذا اعتُمدت.",
    },
  },
  fr: {
    match_invitation: {
      title: "{{name}} vous invite à jouer",
      body: "Touchez pour accepter ou refuser.",
    },
    stale_match_reminder: {
      title: "Votre match expire bientôt",
      body: "Aucun horaire fixé. Ajoutez-en un ou gardez-le ouvert.",
    },
    match_expired: {
      title: "Votre match a expiré",
      body: "Aucun horaire n'a été fixé. Créez-en un quand vous voulez.",
    },
    match_cancelled: {
      title: "Votre match a été annulé",
      body: "Touchez pour voir pourquoi.",
    },
    booking_pending_club: {
      title: "Le club a répondu",
      body: "Touchez pour voir si votre court est confirmé.",
    },
    booking_stale_participant: {
      title: "Court pas encore confirmé",
      body: "Le club n'a pas répondu. Relancez-le ou essayez un autre club.",
    },
    attendance_prompt: {
      title: "Avez-vous joué ?",
      body: "Dites-le-nous pour que le résultat compte.",
    },
    match_time_changed: {
      title: "Votre match a un nouvel horaire",
      body: "Vérifiez qu'il vous convient toujours.",
    },
    match_court_confirmed: {
      title: "Votre court est réservé",
      body: "Tout est prêt. Touchez pour les détails.",
    },
    match_court_released: {
      title: "Votre court est tombé à l'eau",
      body: "{{clubName}} à {{startsAt}} est annulé. Trouvez un autre court.",
    },
    court_first_roster_short: {
      title: "Court réservé, joueurs manquants",
      body: "{{clubName}}, {{startsAt}}. Places libres : {{spotsLeft}}.",
    },
    match_played_prompt: {
      title: "Votre match a-t-il eu lieu ?",
      body: "Votre match du {{startsAt}} n'avait pas de court dans l'application. Avez-vous joué ?",
    },
    match_played_confirmed: {
      title: "Confirmez que vous avez joué",
      body: "Ajoutez le score pour que le résultat compte.",
    },
    match_join_request: {
      title: "Un joueur veut rejoindre",
      body: "Touchez pour accepter ou refuser.",
    },
    match_request_accepted: {
      title: "Vous êtes dans le match !",
      body: "L'hôte vous a accepté. Touchez pour l'heure et le lieu.",
    },
    match_request_declined: {
      title: "Demande non retenue",
      body: "D'autres matchs cherchent encore des joueurs.",
    },
    match_invitation_superseded: {
      title: "Ce match est complet",
      body: "D'autres matchs près de chez vous cherchent des joueurs.",
    },
    match_seat_reopened: {
      title: "Une place s'est libérée",
      body: "Un joueur s'est retiré. Votre invitation est de retour.",
    },
    match_request_withdrawn: {
      title: "Demande retirée",
      body: "Un joueur a changé d'avis.",
    },
    match_participant_joined: {
      title: "Un joueur a rejoint votre match",
      body: "Votre match se remplit.",
    },
    match_participant_left: {
      title: "Un joueur a quitté votre match",
      body: "Invitez quelqu'un pour prendre sa place.",
    },
    match_participant_removed: {
      title: "Vous avez été retiré d'un match",
      body: "L'hôte vous a retiré. {{reason}}",
    },
    match_message: {
      title: "Nouveau message",
      body: "Ça discute dans votre match.",
    },
    result_confirm_request: {
      title: "Confirmez le score",
      body: "Votre adversaire l'a saisi. Confirmez-le ou signalez une erreur.",
    },
    result_auto_confirmed: {
      title: "Score confirmé",
      body: "Personne n'a contesté sous 3 jours : il est retenu.",
    },
  },
};

/** Closed reason codes from `remove_match_participant`. Localized here so push copy can interpolate `{{reason}}`. */
export const REMOVAL_REASON_COPY: Record<
  NotificationLocale,
  Record<string, string>
> = {
  en: {
    match_requirements_mismatch: "Match requirements mismatch",
    player_requested_removal: "Player requested removal",
    conduct_issue: "Conduct issue",
  },
  ar: {
    match_requirements_mismatch: "عدم توافق متطلبات المباراة",
    player_requested_removal: "طلب اللاعب الإزالة",
    conduct_issue: "مشكلة في السلوك",
  },
  fr: {
    match_requirements_mismatch: "Les exigences du match ne correspondent pas",
    player_requested_removal: "Le joueur a demandé à être retiré",
    conduct_issue: "Problème de conduite",
  },
};

export function localizeRemovalReason(
  reason: string | undefined,
  locale: NotificationLocale,
): string | undefined {
  if (!reason) return undefined;
  return (
    REMOVAL_REASON_COPY[locale]?.[reason] ?? REMOVAL_REASON_COPY.en[reason]
  );
}

export function normalizeNotificationLocale(
  value: string | null | undefined,
): NotificationLocale {
  const trimmed = value?.trim().toLowerCase();
  return NOTIFICATION_LOCALES.includes(trimmed as NotificationLocale)
    ? (trimmed as NotificationLocale)
    : DEFAULT_NOTIFICATION_LOCALE;
}

/**
 * Renders `{{name}}` placeholders. Deliberately tiny rather than pulling in an
 * i18n runtime: the Edge Function needs substitution and nothing else, and the
 * matching client path goes through i18next, which understands the same syntax.
 *
 * An unknown placeholder is left as-is rather than blanked, so a missing param
 * shows up in testing instead of silently producing a half-empty sentence.
 */
export function interpolateNotificationCopy(
  template: string,
  params: Record<string, string | number | undefined> | undefined,
): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}
