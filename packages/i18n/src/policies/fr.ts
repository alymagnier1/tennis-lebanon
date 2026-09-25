import type { PoliciesCopy } from "./types";

/** Development draft — French. Not legally approved. */
export const policiesFr: PoliciesCopy = {
  developmentWarning:
    "BROUILLON DE DÉVELOPPEMENT — non approuvé juridiquement et non destiné à une publication publique.",
  version: "Version : {{version}}",
  otherDocuments: "Autres politiques",
  terms: {
    title: "Conditions d’utilisation",
    summary:
      "Pilote réservé aux adultes. Utilisez le service de façon légale et respectueuse. Les arrangements de match et de court ne sont pas garantis.",
    intro:
      "Ce texte provisoire sert uniquement au développement du produit et aux tests internes. Ce n’est pas un conseil juridique et il doit être relu par un conseil qualifié avant tout pilote ou lancement public.",
    sections: [
      {
        heading: "1. Éligibilité au pilote",
        body: "RacketBound est actuellement un pilote de développement réservé aux adultes. Vous devez avoir au moins 18 ans, fournir des informations de compte exactes et pouvoir conclure des accords dans votre juridiction. Les comptes juniors ne sont pas pris en charge.",
      },
      {
        heading: "2. Ce que fait le service",
        body: "Le service aide les joueurs à trouver des adultes compatibles, proposer des horaires de match, se coordonner dans de larges zones géographiques et demander des réservations de court auprès des clubs participants. Il ne garantit pas qu’un autre joueur soit adapté, disponible ou digne de confiance ; qu’un match se remplisse, ait lieu ou se termine ; qu’un club accepte une demande de réservation ; ni qu’un court, un tarif, un horaire ou une autre information tierce reste disponible.\n\nUne réservation n’est confirmée que lorsque le club participant l’accepte expressément. Tout paiement durant le pilote initial se fait directement avec le club, en dehors du service.",
      },
      {
        heading: "3. Responsabilités du compte",
        body: "Protégez l’accès à votre compte et utilisez un seul compte pour vous-même. N’usurpez pas l’identité d’autrui, ne créez pas de profils trompeurs, ne contournez pas une suspension et n’abusez pas des liens de connexion ou d’invitation. Prévenez l’équipe du service via le canal d’assistance officiel dans l’application si vous pensez que votre compte a été compromis.\n\nVous pouvez demander la suppression du compte depuis Paramètres. L’accès peut être restreint pendant l’examen de la demande. Certains dossiers opérationnels, de sécurité, de litige et d’audit peuvent devoir être conservés selon la politique de rétention finale approuvée ou la loi applicable.",
      },
      {
        heading: "4. Usage acceptable",
        body: "Vous devez communiquer avec honnêteté et respect ; assister aux matchs convenus ou annuler aussitôt que raisonnablement possible ; protéger la vie privée et les informations personnelles d’autrui ; utiliser les fonctions de match, chat, invitation, signalement et réservation uniquement à leurs fins prévues ; et respecter les règles du club ainsi que les consignes de sécurité raisonnables.\n\nIl est interdit de harceler, menacer, discriminer, harceler par suivi, frauder, spammer, exposer les coordonnées d’autrui, aspirer des données, perturber le service ou l’utiliser pour une activité illégale.",
      },
      {
        heading: "5. Sécurité et signalement",
        body: "Le tennis implique une activité physique et des rencontres en personne. Évaluez votre santé, vos capacités, le lieu, le matériel, le transport et votre sécurité personnelle. Privilégiez des clubs publics établis, informez quelqu’un de vos plans si besoin, et partez ou demandez de l’aide d’urgence si vous vous sentez en danger.\n\nUtilisez les outils de signalement ou de blocage dans l’application pour toute conduite préoccupante. L’équipe du service peut examiner les signalements, conserver des dossiers pertinents, restreindre des fonctions, suspendre des comptes ou contacter un club le cas échéant. Le service n’est pas un service d’urgence.",
      },
      {
        heading: "6. Évolutions et limites du service",
        body: "Les fonctions de développement peuvent être incomplètes, indisponibles, modifiées ou retirées sans préavis. Le service peut restreindre l’accès pour des raisons de sécurité, de sûreté, de maintenance, de soupçon d’abus ou de violation des politiques. Les conditions finales devront définir garanties, responsabilité, règlement des litiges, droit applicable et résiliation avant le lancement.",
      },
      {
        heading: "7. Revue obligatoire",
        body: "Ces conditions ne créent pas d’obligations prêtes pour la production et ne remplacent pas une revue juridique. L’usage en développement doit rester lié à cette version brouillon exacte afin qu’un nouveau consentement puisse être demandé lorsqu’une version approuvée change.",
      },
    ],
  },
  privacy: {
    title: "Avis de confidentialité",
    summary:
      "Nous collectons le minimum de données de compte, de profil, de zone approximative et de match pour faire tourner le pilote. Les coordonnées ne sont pas montrées aux autres joueurs.",
    intro:
      "Cet avis provisoire sert uniquement au développement du produit et aux tests internes. Ce n’est pas un conseil juridique et il doit être relu par un conseil qualifié avant tout pilote ou lancement public.",
    sections: [
      {
        heading: "1. Périmètre",
        body: "Ce brouillon décrit le traitement prévu des données personnelles dans le pilote RacketBound réservé aux adultes. Il ne couvre pas les juniors, les paiements, les coachs, les tournois, la publicité ni d’autres fonctions hors du pilote prévu.",
      },
      {
        heading: "2. Données réduites au minimum",
        body: "Le service est conçu pour collecter uniquement les données nécessaires au matching, à l’onboarding, aux réservations, à la sécurité et à l’accès au compte, notamment les informations de compte et de connexion vérifiée ; un nom d’affichage, une confirmation d’âge adulte et l’année de naissance ; les langues choisies, la bande de niveau provisoire, l’intention de jeu et les préférences de format ; de larges zones de jeu préférées plutôt qu’une adresse domicile ou une localisation en direct ; la participation aux matchs, les horaires proposés, le statut de réservation, la présence et les résultats ; les préférences de notification et les journaux techniques de livraison ; les signalements, blocages, litiges et dossiers d’audit limités ; ainsi que des diagnostics minimaux pour la fiabilité et la sécurité.\n\nLe MVP ne doit pas demander une date de naissance exacte, une adresse domicile, une localisation précise en direct, des identifiants de paiement ni un numéro de téléphone public.",
      },
      {
        heading: "3. Utilisation des données",
        body: "Les données peuvent servir à fournir l’accès au compte, créer un profil tennis, suggérer des joueurs et matchs compatibles, coordonner les participants approuvés, traiter les demandes de réservation des clubs, envoyer des avis demandés ou essentiels, prévenir les abus, enquêter sur les signalements, assister les utilisateurs et comprendre la performance agrégée du pilote.\n\nLes analyses et rapports de plantage ne doivent pas inclure de noms, coordonnées, corps de messages, notes en texte libre, localisations exactes, jetons d’authentification ou jetons d’invitation.",
      },
      {
        heading: "4. Ce que les autres peuvent voir",
        body: "Les joueurs éligibles peuvent voir des détails de profil sûrs pour le public tels que le nom d’affichage, l’avatar le cas échéant, les préférences de zone larges, la bande de niveau, l’intention de jeu, la préférence de format et des informations de match agrégées. Les coordonnées exactes ne sont pas exposées aux autres joueurs.\n\nLes détails privés de match, horaires proposés, chat, informations de réservation, présence et flux de résultats sont limités aux participants autorisés et au personnel d’exploitation approprié. Le personnel du club ne doit recevoir que les informations nécessaires pour traiter les demandes de son club.\n\nUn partage initié par l’utilisateur peut ouvrir la feuille de partage de l’appareil avec un lien d’invitation sûr. Cela ne révèle pas de numéro de téléphone ni d’adresse e-mail via le service.",
      },
      {
        heading: "5. Prestataires et accès",
        body: "Des prestataires approuvés d’infrastructure, d’authentification, de notification, de diagnostic et d’hébergement peuvent traiter des données limitées pour faire fonctionner le service. L’accès doit suivre le moindre privilège. Les données personnelles ne doivent pas être vendues ni utilisées à des fins publicitaires dans ce pilote.\n\nTout traitement transfrontalier, base légale, conditions de sous-traitants et analyse au regard de la loi libanaise n° 81/2018 exigent une revue juridique avant le lancement.",
      },
      {
        heading: "6. Conservation et demandes de suppression",
        body: "Les utilisateurs peuvent soumettre une demande de suppression de compte depuis Paramètres. Le processus final doit expliquer la vérification, la restriction d’accès, le délai de suppression, les exceptions et l’achèvement.\n\nLes défauts d’ingénierie provisoires conservent le chat de match et les événements d’audit pendant la durée de vie du compte plus 12 mois après une demande de suppression, et les signalements ou litiges de sécurité pendant 24 mois. Ces durées ne sont pas une politique approuvée et doivent être revues avant un lancement public.",
      },
      {
        heading: "7. Sûreté et sécurité",
        body: "Le service doit utiliser des contrôles d’accès, une autorisation au niveau des lignes, un transport sécurisé, un accès opérationnel restreint et un audit des actions privilégiées. Aucun système ne peut garantir une sécurité absolue.\n\nLes utilisateurs peuvent bloquer ou signaler un comportement préoccupant dans le produit. Les signalements peuvent inclure le motif choisi et une note optionnelle, visibles uniquement par le personnel d’exploitation autorisé qui en a besoin pour l’examen.",
      },
      {
        heading: "8. Demandes des utilisateurs et avis final",
        body: "L’avis approuvé devra expliquer comment les utilisateurs peuvent demander l’accès, la rectification, la suppression ou d’autres droits de confidentialité applicables via le canal d’assistance officiel dans l’application. Il devra aussi identifier l’opérateur responsable, les bases légales, les détails des sous-traitants, le contact en cas d’incident, la date d’effet et la voie de réclamation avant le lancement.",
      },
    ],
  },
  community: {
    title: "Règles de la communauté",
    summary:
      "Soyez respectueux, communiquez honnêtement, protégez la vie privée et signalez tout comportement dangereux ou abusif.",
    intro:
      "Ce texte provisoire sert uniquement au développement du produit et aux tests internes. Ce n’est pas un conseil juridique et il doit être relu avant tout pilote ou lancement public.",
    sections: [
      {
        heading: "1. Réservé aux adultes",
        body: "Le pilote de développement s’adresse aux personnes âgées de 18 ans ou plus. Ne créez pas de compte pour un mineur et n’invitez pas un mineur à utiliser le service.",
      },
      {
        heading: "2. Respecter autrui",
        body: "Traitez les joueurs, le personnel des clubs et le personnel du service avec respect. Le harcèlement, les menaces, l’inconduite sexuelle, les discours haineux, la discrimination, le harcèlement moral, l’intimidation, le harcèlement par suivi et les représailles après un signalement sont interdits.\n\nRespectez les limites exprimées par une personne. Une invitation à un match ou un message de chat n’est pas un consentement à un contact personnel, romantique, sexuel, commercial ou hors plateforme.",
      },
      {
        heading: "3. Honnêteté et fiabilité",
        body: "Utilisez une identité d’affichage exacte et une description juste de votre niveau. N’usurpez pas l’identité d’autrui, ne manipulez pas les résultats, ne déposez pas de faux signalements et ne présentez pas faussement une réservation de court.\n\nRejoignez des matchs que vous avez vraiment l’intention de jouer. Répondez aux mises à jour de planning et de réservation, arrivez comme convenu et annulez aussitôt que raisonnablement possible. Les vraies urgences existent ; communiquez factuellement sans partager de détails privés inutiles.",
      },
      {
        heading: "4. Protéger la vie privée",
        body: "Ne publiez pas et ne demandez pas le numéro de téléphone, l’e-mail, l’adresse domicile, la localisation en direct, les messages privés, les photos ou d’autres informations personnelles d’autrui sans permission claire.\n\nUtilisez de larges zones de jeu et les outils de match du produit. Partagez les invitations uniquement via la feuille de partage initiée par l’utilisateur, et ne publiez pas de liens d’invitation privés.",
      },
      {
        heading: "5. Garder le service centré sur le tennis",
        body: "N’utilisez pas les profils, invitations, chats, signalements ou demandes de réservation pour du spam, de la publicité, des arnaques, de la sollicitation, une activité illégale, de la collecte de données ou un contenu hors sujet. N’aspirez pas les profils, ne sondez pas les comptes, ne contournez pas les limites de débit et ne perturbez pas le service.\n\nRespectez les règles du club participant, les installations et le matériel, et payez le club directement lorsque c’est requis. Une demande affichée dans l’application n’est pas une réservation confirmée tant que le club ne l’a pas acceptée.",
      },
      {
        heading: "6. Jouer en sécurité",
        body: "Choisissez des lieux établis, évaluez votre santé et vos capacités, utilisez un équipement adapté et arrêtez de jouer si les conditions sont dangereuses. Organisez votre propre transport et prenez des précautions raisonnables lors d’une première rencontre.\n\nLe service n’est pas un service d’urgence. Si quelqu’un est en danger immédiat, quittez la situation et contactez le service d’urgence local approprié.",
      },
      {
        heading: "7. Bloquer et signaler",
        body: "Utilisez le blocage ou le signalement dans l’application pour les abus, menaces, conduites dangereuses, atteintes à la vie privée, fraudes suspectées ou perturbations graves répétées. N’incluez que les informations pertinentes et n’utilisez pas le signalement comme levier dans un désaccord.\n\nLe personnel d’exploitation autorisé peut examiner les dossiers de compte, match, réservation, chat et audit pertinents. Selon les faits, il peut avertir un utilisateur, limiter des fonctions, suspendre un compte, conserver des dossiers ou se coordonner avec un club concerné.",
      },
      {
        heading: "8. Application équitable",
        body: "Les décisions doivent tenir compte de la gravité, du contexte, des preuves crédibles, du comportement répété et du risque de sécurité immédiat. Les dossiers de fiabilité doivent rester factuels et ne pas devenir un score de honte public. Une action permanente ou à fort impact doit impliquer une revue humaine plutôt qu’une application automatique seule.\n\nLes règles de lancement final devront définir les notifications, les voies de revue ou d’appel, la conservation des dossiers et les responsabilités d’escalade.",
      },
    ],
  },
};
