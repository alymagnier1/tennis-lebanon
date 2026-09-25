import type { PoliciesCopy } from "./types";

/**
 * Development draft — mirrors docs/legal/* for the mobile policies screen.
 * Not legally approved. Brand name matches the product surface (RacketBound).
 */
export const policiesEn: PoliciesCopy = {
  developmentWarning:
    "DEVELOPMENT DRAFT — not legally approved and not for public release.",
  version: "Version: {{version}}",
  otherDocuments: "Other policies",
  terms: {
    title: "Terms of Use",
    summary:
      "Adult-only pilot. Use the service lawfully and respectfully. Match and court arrangements are not guaranteed.",
    intro:
      "This provisional text supports product development and internal testing only. It is not legal advice and must be reviewed by qualified counsel before any pilot or public release.",
    sections: [
      {
        heading: "1. Pilot eligibility",
        body: "RacketBound is currently an adult-only development pilot. You must be at least 18 years old, provide accurate account information, and be able to enter into agreements in your jurisdiction. Junior accounts are not supported.",
      },
      {
        heading: "2. What the service does",
        body: "The service helps players find compatible adults, propose match times, coordinate in broad geographic zones, and request court bookings from participating clubs. It does not guarantee that another player is suitable, available, or trustworthy; that a match will fill, take place, or finish; that a club will accept a booking request; or that a court, price, schedule, or other third-party information will remain available.\n\nA booking is confirmed only when the participating club expressly accepts it. Any payment in the initial pilot is handled directly with the club, outside the service.",
      },
      {
        heading: "3. Account responsibilities",
        body: "Keep access to your account secure and use one account for yourself. Do not impersonate another person, create misleading profiles, evade a suspension, or misuse sign-in and invitation links. Tell the service team through the official in-app support path if you believe your account has been compromised.\n\nYou may request account deletion from Settings. Access may be restricted while the request is reviewed. Some operational, safety, dispute, and audit records may need to be retained under the final approved retention policy or applicable law.",
      },
      {
        heading: "4. Acceptable use",
        body: "You must communicate honestly and respectfully; attend agreed matches or cancel as early as reasonably possible; protect other people’s privacy and personal information; use match, chat, invitation, reporting, and booking features only for their intended purposes; and follow club rules and reasonable safety instructions.\n\nYou must not harass, threaten, discriminate against, stalk, defraud, spam, expose another person’s contact details, scrape data, interfere with the service, or use it for unlawful activity.",
      },
      {
        heading: "5. Safety and reporting",
        body: "Tennis involves physical activity and meeting people in person. Assess your own health, ability, venue, equipment, transport, and personal safety. Use established public clubs, tell someone your plans when appropriate, and leave or seek emergency help if you feel unsafe.\n\nUse the in-app reporting or blocking tools for concerning conduct. The service team may review reports, preserve relevant records, restrict features, suspend accounts, or contact a club where appropriate. The service is not an emergency service.",
      },
      {
        heading: "6. Service changes and limitations",
        body: "Development features may be incomplete, unavailable, changed, or removed without notice. The service may restrict access for security, safety, maintenance, suspected abuse, or policy violations. Final terms must define warranties, liability, dispute handling, governing law, and termination before release.",
      },
      {
        heading: "7. Required review",
        body: "These terms do not create release-ready obligations or replace legal review. Continued development use should be tied to this exact draft version so later consent can be requested when an approved version changes.",
      },
    ],
  },
  privacy: {
    title: "Privacy Notice",
    summary:
      "We collect minimal account, profile, coarse-area, and match data to operate the pilot. Contact details are not shown to other players.",
    intro:
      "This provisional notice supports product development and internal testing only. It is not legal advice and must be reviewed by qualified counsel before any pilot or public release.",
    sections: [
      {
        heading: "1. Scope",
        body: "This draft describes the intended handling of personal data in the adult-only RacketBound pilot. It does not cover junior users, payments, coaches, tournaments, advertising, or other features outside the planned pilot.",
      },
      {
        heading: "2. Data kept to a minimum",
        body: "The service is intended to collect only data needed to operate matching, onboarding, bookings, safety, and account access, including account and verified sign-in information; a display name, adult confirmation and birth year; chosen languages, provisional skill band, play intent, and format preferences; broad preferred play zones rather than a home address or live location; match participation, proposed times, booking status, attendance, and results; notification preferences and technical delivery records; reports, blocks, disputes, and limited audit records; and minimal diagnostics needed for reliability and security.\n\nThe MVP should not request an exact date of birth, home address, precise live location, payment credentials, or public phone number.",
      },
      {
        heading: "3. How data is used",
        body: "Data may be used to provide account access, create a tennis profile, suggest compatible players and matches, coordinate approved participants, process club booking requests, send requested or essential notices, prevent abuse, investigate reports, support users, and understand aggregate pilot performance.\n\nAnalytics and crash reports must not include names, contact details, message bodies, free-text notes, exact locations, authentication tokens, or invitation tokens.",
      },
      {
        heading: "4. What other people can see",
        body: "Eligible players may see public-safe profile details such as display name, avatar if provided, broad zone preferences, skill band, play intent, format preference, and aggregate match information. Exact contact details are not exposed to other players.\n\nPrivate match details, proposed times, chat, booking information, attendance, and result workflows are limited to authorized participants and appropriate operations staff. Club staff should receive only the information needed to process requests for their assigned club.\n\nUser-initiated sharing may open the device share sheet with a safe invitation link. This does not reveal a phone number or e-mail address through the service.",
      },
      {
        heading: "5. Service providers and access",
        body: "Approved infrastructure, authentication, notification, diagnostics, and hosting providers may process limited data to operate the service. Access should follow least-privilege controls. Personal data must not be sold or used for advertising in this pilot.\n\nAny cross-border processing, legal basis, processor terms, and Lebanon Law No. 81/2018 analysis require legal review before release.",
      },
      {
        heading: "6. Retention and deletion requests",
        body: "Users may submit an account-deletion request from Settings. The final process must explain verification, access restriction, deletion timing, exceptions, and completion.\n\nProvisional engineering defaults retain match chat and audit events for the life of the account plus 12 months after a deletion request, and safety reports or disputes for 24 months. These periods are not approved policy and must be reviewed before chat or public release.",
      },
      {
        heading: "7. Safety and security",
        body: "The service should use access controls, row-level authorization, secure transport, restricted operational access, and auditing for privileged actions. No system can guarantee absolute security.\n\nUsers can block or report concerning behavior in the product. Reports may include the selected reason and an optional note, visible only to authorized operations staff who need it for review.",
      },
      {
        heading: "8. User requests and final notice",
        body: "The approved notice must explain how users can request access, correction, deletion, or other applicable privacy rights through the official in-app support path. It must also identify the responsible operator, legal bases, processor details, incident contact, effective date, and complaint process before release.",
      },
    ],
  },
  community: {
    title: "Community Rules",
    summary:
      "Be respectful, communicate honestly, protect privacy, and report unsafe or abusive behavior.",
    intro:
      "This provisional text supports product development and internal testing only. It is not legal advice and must be reviewed before any pilot or public release.",
    sections: [
      {
        heading: "1. Adults only",
        body: "The development pilot is for people aged 18 or older. Do not create an account for a minor or invite a minor to use the service.",
      },
      {
        heading: "2. Respect other people",
        body: "Treat players, club staff, and service staff with respect. Harassment, threats, sexual misconduct, hate speech, discrimination, bullying, intimidation, stalking, and retaliation for a report are not allowed.\n\nRespect a person’s stated boundaries. A match invitation or chat message is not consent to personal, romantic, sexual, commercial, or off-platform contact.",
      },
      {
        heading: "3. Be honest and reliable",
        body: "Use an accurate display identity and a fair description of your playing level. Do not impersonate others, manipulate results, submit false reports, or misrepresent a court booking.\n\nJoin matches you genuinely intend to play. Respond to scheduling and booking updates, arrive as agreed, and cancel as early as reasonably possible. Genuine emergencies happen; communicate factually without sharing unnecessary private details.",
      },
      {
        heading: "4. Protect privacy",
        body: "Do not publish or request another person’s phone number, e-mail address, home address, live location, private messages, photographs, or other personal information without clear permission.\n\nUse broad play zones and the product’s match tools. Share invitations only through a user-initiated device share sheet, and do not post private invitation links publicly.",
      },
      {
        heading: "5. Keep the service focused on tennis",
        body: "Do not use profiles, invitations, chat, reports, or booking requests for spam, advertising, scams, solicitation, illegal activity, data collection, or unrelated content. Do not scrape profiles, probe accounts, evade rate limits, or interfere with the service.\n\nFollow the participating club’s rules, respect facilities and equipment, and pay the club directly when required. A request shown in the app is not a confirmed booking until the club accepts it.",
      },
      {
        heading: "6. Play safely",
        body: "Choose established venues, assess your own health and ability, use suitable equipment, and stop playing if conditions are unsafe. Arrange your own transport and take reasonable precautions when meeting someone for the first time.\n\nThe service is not an emergency service. If anyone is in immediate danger, leave the situation and contact the appropriate local emergency service.",
      },
      {
        heading: "7. Block and report",
        body: "Use in-app blocking or reporting for abuse, threats, unsafe conduct, privacy violations, suspected fraud, or repeated serious disruption. Include only information relevant to the concern and do not use reporting as leverage in a disagreement.\n\nAuthorized operations staff may review relevant account, match, booking, chat, and audit records. Depending on the facts, they may warn a user, limit features, suspend an account, preserve records, or coordinate with an involved club.",
      },
      {
        heading: "8. Fair enforcement",
        body: "Decisions should consider severity, context, credible evidence, repeated behavior, and immediate safety risk. Reliability records must remain factual and must not become a public shame score. Permanent or high-impact action should involve human review rather than automatic enforcement alone.\n\nFinal release rules must define notices, review or appeal paths, record retention, and escalation responsibilities.",
      },
    ],
  },
};
