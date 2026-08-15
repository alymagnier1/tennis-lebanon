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
      title: "Match invite",
      body: "Someone invited you to a match.",
    },
    stale_match_reminder: {
      title: "Match expiring soon",
      body: "Add a new time or extend your listing.",
    },
    match_expired: {
      title: "Match expired",
      body: "This match is no longer active.",
    },
    booking_pending_club: {
      title: "Booking update",
      body: "A club responded to your booking request.",
    },
    booking_stale_participant: {
      title: "Booking waiting",
      body: "Your court request is still pending.",
    },
    attendance_prompt: {
      title: "Did you play?",
      body: "Confirm attendance after your match.",
    },
    match_time_changed: {
      title: "Match time changed",
      body: "The host moved this match. Open the app to see the new time.",
    },
    match_court_confirmed: {
      title: "Court confirmed",
      body: "A court has been arranged with the club. Your match is confirmed.",
    },
    match_court_released: {
      title: "Court no longer booked",
      body: "{{clubName}} at {{startsAt}} fell through. The match still needs a court.",
    },
    court_first_roster_short: {
      title: "Court booked, players missing",
      body: "Your court at {{clubName}} is on {{startsAt}}. Spots still open: {{spotsLeft}}. Invite someone or release the court.",
    },
    match_played_prompt: {
      title: "Did you play?",
      body: "Your match on {{startsAt}} never got a court in the app. Tell us if it happened so the result still counts.",
    },
    match_played_confirmed: {
      title: "Match marked as played",
      body: "Confirm your attendance and add the result so it counts.",
    },
    match_participant_joined: {
      title: "A player joined",
      body: "Someone joined your match. Open the app to see the roster.",
    },
    match_participant_left: {
      title: "A player left",
      body: "Someone left your match. You may need to invite a replacement.",
    },
    match_message: {
      title: "New message",
      body: "There are new messages in your match chat.",
    },
    result_confirm_request: {
      title: "A score is waiting on you",
      body: "Your opponent added the score. Confirm it, or say it is wrong.",
    },
    result_auto_confirmed: {
      title: "Score confirmed",
      body: "Nobody objected within three days, so this score now stands.",
    },
  },
  ar: {
    match_invitation: {
      title: "دعوة مباراة",
      body: "دعاك أحد إلى مباراة.",
    },
    stale_match_reminder: {
      title: "المباراة تنتهي قريبًا",
      body: "أضف وقتًا جديدًا أو مدّد الإعلان.",
    },
    match_expired: {
      title: "انتهت المباراة",
      body: "لم تعد هذه المباراة نشطة.",
    },
    booking_pending_club: {
      title: "تحديث الحجز",
      body: "ردّ نادٍ على طلب حجزك.",
    },
    booking_stale_participant: {
      title: "حجز بانتظار الرد",
      body: "طلب حجز الملعب لا يزال قيد الانتظار.",
    },
    attendance_prompt: {
      title: "هل لعبت؟",
      body: "أكّد حضورك بعد مباراتك.",
    },
    match_time_changed: {
      title: "تغيّر موعد المباراة",
      body: "غيّر المضيف موعد هذه المباراة. افتح التطبيق لرؤية الموعد الجديد.",
    },
    match_court_confirmed: {
      title: "تم تأكيد الملعب",
      body: "تم تأمين ملعب مع النادي. مباراتك مؤكدة.",
    },
    match_court_released: {
      title: "لم يعد الملعب محجوزًا",
      body: "تعذّر حجز {{clubName}} في {{startsAt}}. لا تزال المباراة بحاجة إلى ملعب.",
    },
    court_first_roster_short: {
      title: "الملعب محجوز والعدد ناقص",
      body: "ملعبك في {{clubName}} موعده {{startsAt}}. الأماكن المتبقية: {{spotsLeft}}. ادعُ لاعبًا أو ألغِ حجز الملعب.",
    },
    match_played_prompt: {
      title: "هل لعبت؟",
      body: "مباراتك في {{startsAt}} لم تحصل على ملعب في التطبيق. أخبرنا إن جرت لتُحتسب النتيجة.",
    },
    match_played_confirmed: {
      title: "تم تسجيل المباراة كملعوبة",
      body: "أكّد حضورك وأضف النتيجة لتُحتسب.",
    },
    match_participant_joined: {
      title: "انضم لاعب",
      body: "انضم أحدهم إلى مباراتك. افتح التطبيق لرؤية القائمة.",
    },
    match_participant_left: {
      title: "غادر لاعب",
      body: "غادر أحدهم مباراتك. قد تحتاج إلى دعوة بديل.",
    },
    match_message: {
      title: "رسالة جديدة",
      body: "هناك رسائل جديدة في محادثة مباراتك.",
    },
    result_confirm_request: {
      title: "نتيجة بانتظار تأكيدك",
      body: "أضاف خصمك النتيجة. أكّدها أو أشر إلى أنها غير صحيحة.",
    },
    result_auto_confirmed: {
      title: "تم تأكيد النتيجة",
      body: "لم يعترض أحد خلال ثلاثة أيام، لذا اعتُمدت هذه النتيجة.",
    },
  },
  fr: {
    match_invitation: {
      title: "Invitation à un match",
      body: "Quelqu'un vous a invité à un match.",
    },
    stale_match_reminder: {
      title: "Match bientôt expiré",
      body: "Ajoutez un nouveau créneau ou prolongez votre annonce.",
    },
    match_expired: {
      title: "Match expiré",
      body: "Ce match n'est plus actif.",
    },
    booking_pending_club: {
      title: "Mise à jour de réservation",
      body: "Un club a répondu à votre demande de réservation.",
    },
    booking_stale_participant: {
      title: "Réservation en attente",
      body: "Votre demande de court est toujours en attente.",
    },
    attendance_prompt: {
      title: "Avez-vous joué ?",
      body: "Confirmez votre présence après votre match.",
    },
    match_time_changed: {
      title: "Horaire du match modifié",
      body: "L'organisateur a déplacé ce match. Ouvrez l'application pour voir le nouvel horaire.",
    },
    match_court_confirmed: {
      title: "Court confirmé",
      body: "Un court a été réservé auprès du club. Votre match est confirmé.",
    },
    match_court_released: {
      title: "Court plus réservé",
      body: "{{clubName}} à {{startsAt}} est tombé à l'eau. Le match a toujours besoin d'un court.",
    },
    court_first_roster_short: {
      title: "Court réservé, joueurs manquants",
      body: "Votre court à {{clubName}} est le {{startsAt}}. Places encore libres : {{spotsLeft}}. Invitez quelqu'un ou libérez le court.",
    },
    match_played_prompt: {
      title: "Avez-vous joué ?",
      body: "Votre match du {{startsAt}} n'a jamais eu de court dans l'application. Dites-nous s'il a eu lieu pour que le résultat compte.",
    },
    match_played_confirmed: {
      title: "Match marqué comme joué",
      body: "Confirmez votre présence et ajoutez le résultat pour qu'il compte.",
    },
    match_participant_joined: {
      title: "Un joueur a rejoint",
      body: "Quelqu'un a rejoint votre match. Ouvrez l'application pour voir la composition.",
    },
    match_participant_left: {
      title: "Un joueur est parti",
      body: "Quelqu'un a quitté votre match. Vous devrez peut-être inviter un remplaçant.",
    },
    match_message: {
      title: "Nouveau message",
      body: "Il y a de nouveaux messages dans la discussion de votre match.",
    },
    result_confirm_request: {
      title: "Un score attend votre réponse",
      body: "Votre adversaire a saisi le score. Confirmez-le, ou signalez une erreur.",
    },
    result_auto_confirmed: {
      title: "Score confirmé",
      body: "Personne n'a contesté sous trois jours : ce score est désormais retenu.",
    },
  },
};

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
