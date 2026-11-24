export const settingsNotices = {
  "auth-sent": { message: "Consulte ta boîte mail pour ouvrir le lien de connexion dans ce navigateur.", success: true },
  "auth-invalid-email": { message: "Saisis une adresse e-mail valide." },
  "auth-invalid-link": { message: "Ce lien a expiré ou a été ouvert dans un autre navigateur. Demande un nouveau lien." },
  "auth-rate-limit": { message: "Trop de demandes de connexion. Attends un moment avant de réessayer." },
  "auth-error": { message: "La connexion GameVault a échoué. Réessaie dans quelques instants." },
  "session-required": { message: "Connecte-toi à GameVault pour utiliser cette action." },
  "signed-out": { message: "Tu es déconnecté de GameVault.", success: true },
  "configuration": { message: "La configuration serveur est incomplète." },
  "service-error": { message: "GameVault n’a pas pu terminer l’opération. Réessaie dans quelques instants." },
  "steam-cancelled": { message: "Tu as annulé la connexion Steam." },
  "steam-invalid": { message: "La réponse de connexion Steam n’a pas pu être validée. Relance la connexion." },
  "steam-expired": { message: "Cette demande de connexion Steam a expiré. Relance la connexion." },
  "steam-conflict": { message: "Cette association est impossible. L’un des deux comptes est déjà associé." },
  "steam-not-linked": { message: "Associe ton compte Steam avant de synchroniser ta bibliothèque." },
  "steam-already-linked": { message: "Un compte Steam est déjà associé à GameVault.", success: true },
  "steam-unavailable": { message: "Steam est temporairement indisponible. Réessaie dans quelques instants." },
  "steam-rate-limit": { message: "Steam limite actuellement les requêtes. Attends quelques minutes avant de relancer l’import." },
  "steam-api-key": { message: "La clé Web API Steam est absente ou refusée. Vérifie la configuration serveur." },
  "steam-invalid-library": { message: "Steam a renvoyé des données de bibliothèque incomplètes. Les données déjà importées sont conservées." },
  "library-inaccessible": { message: "Steam ne permet pas de lire ta bibliothèque. Vérifie la visibilité des détails de jeu sur ton profil Steam, puis relance l’import." },
  "steam-synced": { message: "Ta bibliothèque Steam a été synchronisée.", success: true },
  "steam-empty": { message: "Steam a confirmé que la bibliothèque accessible est vide. Les jeux déjà importés sont conservés.", success: true },
  "steam-outdated": { message: "Une synchronisation plus récente est déjà enregistrée.", success: true },
} satisfies Record<string, { message: string; success?: boolean }>;

export type SettingsNotice = keyof typeof settingsNotices;

export function getSettingsNotice(value: string | string[] | undefined): { message: string; success?: boolean } | null {
  return typeof value === "string" && Object.hasOwn(settingsNotices, value)
    ? settingsNotices[value as SettingsNotice]
    : null;
}

export function settingsLocation(notice: SettingsNotice) {
  return "/settings?notification=" + notice;
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
