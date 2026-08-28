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
      body: "Open it to accept or decline.",
    },
    stale_match_reminder: {
      title: "Your match expires soon",
      body: "Nobody has locked a time yet. Add one or extend the listing.",
    },
    match_expired: {
      title: "Your match expired",
      body: "Nobody locked a time in. Create a new one when you are ready to play.",
    },
    match_cancelled: {
      title: "Your match was cancelled",
      body: "Open the match to see the reason.",
    },
    booking_pending_club: {
      title: "The club replied about your court",
      body: "Open the match to see whether your court is confirmed.",
    },
    booking_stale_participant: {
      title: "Your court is still unconfirmed",
      body: "The club has not replied yet. Chase it or try another club.",
    },
    attendance_prompt: {
      title: "Your match is waiting on you",
      body: "Say whether you played so the result can count.",
    },
    match_time_changed: {
      title: "The host moved your match",
      body: "Check the new time and make sure it still works for you.",
    },
    match_court_confirmed: {
      title: "Your court is booked",
      body: "The match is confirmed. Open it to check the details before you go.",
    },
    match_court_released: {
      title: "Your court fell through",
      body: "{{clubName}} at {{startsAt}} is gone. The match still needs a court.",
    },
    court_first_roster_short: {
      title: "Court booked, players missing",
      body: "Your court at {{clubName}} is on {{startsAt}}. Spots still open: {{spotsLeft}}. Invite someone or release the court.",
    },
    match_played_prompt: {
      title: "Did your match happen?",
      body: "Your match on {{startsAt}} never got a court in the app. Tell us if it happened so the result still counts.",
    },
    match_played_confirmed: {
      title: "Your match counts once you confirm",
      body: "Confirm you played and add the score so the result stands.",
    },
    match_join_request: {
      title: "Someone asked to join your match",
      body: "A player is waiting on your answer. Open it to accept or decline.",
    },
    match_request_accepted: {
      title: "You are in the match",
      body: "The host accepted your request. Open it to see the time and where you are playing.",
    },
    match_request_declined: {
      title: "Your request was not accepted",
      body: "The host went with someone else this time. Other matches are still looking for players.",
    },
    match_request_withdrawn: {
      title: "A join request was withdrawn",
      body: "Someone who asked to join your match has changed their mind.",
    },
    match_participant_joined: {
      title: "Your match gained a player",
      body: "Someone joined. Open it to see the roster and keep it moving.",
    },
    match_participant_left: {
      title: "Your match lost a player",
      body: "Someone left. Invite a replacement before the hour comes round.",
    },
    match_message: {
      title: "New message in your match",
      body: "Your match group is talking. Open the chat to catch up.",
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
      title: "دعاك {{name}} للعب",
      body: "افتح الدعوة لقبولها أو رفضها.",
    },
    stale_match_reminder: {
      title: "مباراتك تنتهي قريبًا",
      body: "لم يُثبَّت أي موعد بعد. أضف موعدًا أو مدّد الإعلان.",
    },
    match_expired: {
      title: "انتهت مباراتك",
      body: "لم يُثبَّت أي موعد. أنشئ مباراة جديدة عندما تكون مستعدًا للعب.",
    },
    match_cancelled: {
      title: "أُلغيت مباراتك",
      body: "افتح المباراة لمعرفة السبب.",
    },
    booking_pending_club: {
      title: "ردّ النادي بشأن ملعبك",
      body: "افتح المباراة لمعرفة إن تم تأكيد الملعب.",
    },
    booking_stale_participant: {
      title: "ملعبك لم يُؤكَّد بعد",
      body: "لم يردّ النادي حتى الآن. تابع الطلب أو جرّب ناديًا آخر.",
    },
    attendance_prompt: {
      title: "مباراتك بانتظارك",
      body: "أخبرنا إن كنت قد لعبت لتُحتسب النتيجة.",
    },
    match_time_changed: {
      title: "غيّر المضيف موعد مباراتك",
      body: "راجع الموعد الجديد وتأكد أنه ما زال مناسبًا لك.",
    },
    match_court_confirmed: {
      title: "تم حجز ملعبك",
      body: "المباراة مؤكدة. افتحها لمراجعة التفاصيل قبل الذهاب.",
    },
    match_court_released: {
      title: "تعذّر حجز ملعبك",
      body: "لم يعد {{clubName}} في {{startsAt}} متاحًا. لا تزال المباراة بحاجة إلى ملعب.",
    },
    court_first_roster_short: {
      title: "الملعب محجوز والعدد ناقص",
      body: "ملعبك في {{clubName}} موعده {{startsAt}}. الأماكن المتبقية: {{spotsLeft}}. ادعُ لاعبًا أو ألغِ حجز الملعب.",
    },
    match_played_prompt: {
      title: "هل جرت مباراتك؟",
      body: "مباراتك في {{startsAt}} لم تحصل على ملعب في التطبيق. أخبرنا إن جرت لتُحتسب النتيجة.",
    },
    match_played_confirmed: {
      title: "تُحتسب مباراتك بعد تأكيدك",
      body: "أكّد أنك لعبت وأضف النتيجة لتُعتمد.",
    },
    match_join_request: {
      title: "طلب أحدهم الانضمام إلى مباراتك",
      body: "لاعب ينتظر ردك. افتح المباراة للقبول أو الرفض.",
    },
    match_request_accepted: {
      title: "أنت الآن في المباراة",
      body: "قبل المضيف طلبك. افتح المباراة لرؤية الوقت والمكان.",
    },
    match_request_declined: {
      title: "لم يُقبل طلبك",
      body: "اختار المضيف لاعبًا آخر هذه المرة. هناك مباريات أخرى تبحث عن لاعبين.",
    },
    match_request_withdrawn: {
      title: "تم سحب طلب انضمام",
      body: "غيّر أحد من طلب الانضمام إلى مباراتك رأيه.",
    },
    match_participant_joined: {
      title: "انضم لاعب إلى مباراتك",
      body: "انضم أحدهم. افتح المباراة لرؤية القائمة ومتابعة التحضير.",
    },
    match_participant_left: {
      title: "غادر لاعب مباراتك",
      body: "غادر أحدهم. ادعُ بديلًا قبل حلول الموعد.",
    },
    match_message: {
      title: "رسالة جديدة في مباراتك",
      body: "هناك حديث في محادثة مباراتك. افتحها لمتابعة الرسائل.",
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
      title: "{{name}} vous invite à jouer",
      body: "Ouvrez pour accepter ou refuser.",
    },
    stale_match_reminder: {
      title: "Votre match expire bientôt",
      body: "Aucun créneau n'est encore fixé. Ajoutez-en un ou prolongez l'annonce.",
    },
    match_expired: {
      title: "Votre match a expiré",
      body: "Aucun créneau n'a été fixé. Créez-en un nouveau quand vous voulez jouer.",
    },
    match_cancelled: {
      title: "Votre match a été annulé",
      body: "Ouvrez le match pour voir la raison.",
    },
    booking_pending_club: {
      title: "Le club a répondu pour votre court",
      body: "Ouvrez le match pour voir si votre court est confirmé.",
    },
    booking_stale_participant: {
      title: "Votre court n'est toujours pas confirmé",
      body: "Le club n'a pas encore répondu. Relancez-le ou essayez un autre club.",
    },
    attendance_prompt: {
      title: "Votre match vous attend",
      body: "Dites si vous avez joué pour que le résultat compte.",
    },
    match_time_changed: {
      title: "L'organisateur a déplacé votre match",
      body: "Vérifiez le nouvel horaire et confirmez qu'il vous convient toujours.",
    },
    match_court_confirmed: {
      title: "Votre court est réservé",
      body: "Le match est confirmé. Ouvrez-le pour vérifier les détails avant de partir.",
    },
    match_court_released: {
      title: "Votre court est tombé à l'eau",
      body: "{{clubName}} à {{startsAt}} n'est plus disponible. Le match a toujours besoin d'un court.",
    },
    court_first_roster_short: {
      title: "Court réservé, joueurs manquants",
      body: "Votre court à {{clubName}} est le {{startsAt}}. Places encore libres : {{spotsLeft}}. Invitez quelqu'un ou libérez le court.",
    },
    match_played_prompt: {
      title: "Votre match a-t-il eu lieu ?",
      body: "Votre match du {{startsAt}} n'a jamais eu de court dans l'application. Dites-nous s'il a eu lieu pour que le résultat compte.",
    },
    match_played_confirmed: {
      title: "Votre match compte une fois confirmé",
      body: "Confirmez que vous avez joué et ajoutez le score pour qu'il soit retenu.",
    },
    match_join_request: {
      title: "Un joueur demande à rejoindre votre match",
      body: "Un joueur attend votre réponse. Ouvrez le match pour accepter ou refuser.",
    },
    match_request_accepted: {
      title: "Vous êtes dans le match",
      body: "L'hôte a accepté votre demande. Ouvrez le match pour voir l'heure et le lieu.",
    },
    match_request_declined: {
      title: "Votre demande n'a pas été retenue",
      body: "L'hôte a choisi quelqu'un d'autre cette fois. D'autres matchs cherchent encore des joueurs.",
    },
    match_request_withdrawn: {
      title: "Une demande a été retirée",
      body: "Un joueur qui voulait rejoindre votre match a changé d'avis.",
    },
    match_participant_joined: {
      title: "Un joueur a rejoint votre match",
      body: "Quelqu'un a rejoint. Ouvrez le match pour voir la composition et avancer.",
    },
    match_participant_left: {
      title: "Un joueur a quitté votre match",
      body: "Quelqu'un est parti. Invitez un remplaçant avant l'heure du match.",
    },
    match_message: {
      title: "Nouveau message dans votre match",
      body: "Ça discute dans le chat de votre match. Ouvrez-le pour suivre.",
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
