/** Transactional waitlist receipt. No tracking pixels, remote images or app-access link. */
export function welcomeEmail(firstName: string, supportEmail: string) {
  const greeting = firstName.replace(/[\r\n]/g, " ");
  const text = `Hi ${greeting},

You're on the RacketBound Beirut list.

Thanks for joining. We're bringing together tennis players in Beirut so you can find more people to play with at your level.

We'll email your app invitation when access opens for you. There's nothing else you need to do for now.

Questions, a correction, or want to leave the list? Reply to this email or contact ${supportEmail}.

Ali
RacketBound
https://racketbound.com/beirut
Privacy: https://racketbound.com/beirut/privacy`;
  return { subject: "You're on the RacketBound Beirut list", text };
}
