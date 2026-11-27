export const settingsNotices = {
  "auth-signup-sent": { message: "Si une confirmation est nécessaire, tu recevras un e-mail. Ouvre le lien dans ce navigateur.", success: true },
  "auth-recovery-sent": { message: "Si cette adresse est associée à un compte, tu recevras un lien à ouvrir dans ce navigateur.", success: true },
  "auth-password-required": { message: "Saisis ton mot de passe." },
  "auth-invalid-password": { message: "Choisis un mot de passe d’au moins 8 caractères et de 72 octets maximum, puis saisis-le deux fois à l’identique." },
  "auth-weak-password": { message: "Ce mot de passe ne respecte pas les règles de sécurité. Choisis-en un autre." },
  "auth-same-password": { message: "Choisis un mot de passe différent du précédent." },
  "auth-invalid-credentials": { message: "L’adresse e-mail ou le mot de passe est incorrect." },
  "auth-email-unconfirmed": { message: "Confirme ton adresse e-mail avant de te connecter. Vérifie aussi les courriers indésirables." },
  "auth-password-reauth": { message: "Pour modifier ton mot de passe, reconnecte-toi ou utilise « Mot de passe oublié » depuis l’écran de connexion." },
  "auth-password-updated": { message: "Ton mot de passe a été enregistré.", success: true },
  "auth-invalid-email": { message: "Saisis une adresse e-mail valide." },
  "auth-invalid-link": { message: "Ce lien est invalide, a expiré ou a été ouvert dans un autre navigateur." },
  "auth-rate-limit": { message: "Trop de demandes de connexion. Attends un moment avant de réessayer." },
  "auth-error": { message: "La connexion GameVault a échoué. Réessaie dans quelques instants." },
  "session-required": { message: "Connecte-toi à GameVault pour utiliser cette action." },
  "signed-out": { message: "Tu es déconnecté de GameVault.", success: true },
  "configuration": { message: "La configuration serveur est incomplète." },
  "service-error": { message: "GameVault n’a pas pu terminer l’opération. Réessaie dans quelques instants." },
  "theme-invalid": { message: "Choisis un thème parmi ceux proposés." },
  "theme-saved": { message: "Ton thème a été enregistré.", success: true },
  "steam-cancelled": { message: "Tu as annulé la connexion Steam." },
  "steam-invalid": { message: "La réponse de connexion Steam n’a pas pu être validée. Relance la connexion." },
  "steam-expired": { message: "Cette demande de connexion Steam a expiré. Relance la connexion." },
  "steam-conflict": { message: "Cette association est impossible. L’un des deux comptes est déjà associé." },
  "steam-not-linked": { message: "Associe ton compte Steam avant de synchroniser ta bibliothèque." },
  "steam-already-linked": { message: "Un compte Steam est déjà associé à GameVault.", success: true },
  "steam-unavailable": { message: "Steam est temporairement indisponible. Réessaie dans quelques instants." },
  "steam-rate-limit": { message: "Steam limite actuellement les requêtes. Attends quelques minutes avant de relancer l’import." },
  "sync-rate-limit": { message: "Tu as atteint la limite horaire de synchronisation. Réessaie à l’heure suivante." },
  "steam-api-key": { message: "La clé Web API Steam est absente ou refusée. Vérifie la configuration serveur." },
  "steam-invalid-library": { message: "Steam a renvoyé des données de bibliothèque incomplètes. Les données déjà importées sont conservées." },
  "library-inaccessible": { message: "Steam ne permet pas de lire ta bibliothèque. Vérifie la visibilité des détails de jeu sur ton profil Steam, puis relance l’import." },
  "steam-synced": { message: "Ta bibliothèque Steam a été synchronisée.", success: true },
  "steam-empty": { message: "Steam a confirmé que la bibliothèque accessible est vide. Les jeux déjà importés sont conservés.", success: true },
  "steam-outdated": { message: "Une synchronisation plus récente est déjà enregistrée.", success: true },
  "auto-sync-enabled": { message: "La synchronisation automatique Steam est activée.", success: true },
  "auto-sync-disabled": { message: "La synchronisation automatique Steam est désactivée.", success: true },
} satisfies Record<string, { message: string; success?: boolean }>;

export type SettingsNotice = keyof typeof settingsNotices;
export type AuthMode = "signup" | "forgot-password" | "password";

export function getSettingsNotice(value: string | string[] | undefined): { message: string; success?: boolean } | null {
  return typeof value === "string" && Object.hasOwn(settingsNotices, value)
    ? settingsNotices[value as SettingsNotice]
    : null;
}

export function settingsLocation(notice: SettingsNotice, mode?: AuthMode) {
  return "/settings?notification=" + notice + (mode ? "&mode=" + mode : "");
}

export function returnToSettings(notice: SettingsNotice) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: settingsLocation(notice),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
