/** Transactional waitlist receipt. No tracking pixels, remote images or app-access link. */
export function welcomeEmail(firstName: string, supportEmail: string) {
  const greeting = firstName.replace(/[\r\n]/g, " ");
  const text = `Hi ${greeting},

You're on the RacketBound Beirut list. 🎾

We'll email your app invitation when access opens for you. There's nothing else you need to do for now.

Questions? Contact ${supportEmail}.

RacketBound`;
  return { subject: "You're on the RacketBound Beirut list", text };
}
