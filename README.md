# GameVault

GameVault est un compagnon personnel pour les bibliothèques de jeux Steam. Après l’import, tu peux retrouver tes jeux, suivre ta progression et créer des collections. La wishlist te permet de garder une liste des jeux que tu aimerais acquérir.

## Démarrage local

Depuis la racine du projet, sélectionne Node.js 24 avec nvm, installe les versions verrouillées, puis démarre le serveur de développement.

```sh
nvm use
npm ci
npm run dev
```

Ouvre [GameVault en local](http://localhost:3000). Le tableau de bord d’un compte connecté affiche sa bibliothèque réelle. En développement, les visiteurs voient un tableau de bord de démonstration identifié.

Pour activer la connexion, démarre les services Supabase et suis la configuration décrite ci-dessous.

## Structure

- `src/app` contient les routes de l’App Router, le layout racine et les styles globaux.
- `src/components` contient les éléments d’interface partagés. Les composants shadcn/ui vivent dans `src/components/ui`.
- `src/features/dashboard` contient le tableau de bord, ses calculs et sa bibliothèque de démonstration.
- `src/features/steam` contient le protocole de liaison Steam, le client Web API et l’orchestration de la synchronisation.
- `src/features/library` contient les lectures paginées, les filtres et les formulaires de la bibliothèque, du backlog et des collections.
- `src/features/analytics` contient les lectures des agrégats et les graphiques Recharts.
- `src/features/advisor` contient l’appel d’outil OpenAI, les recherches côté serveur et les réponses construites à partir de la bibliothèque.
- `src/lib/supabase` contient les clients serveur de session et de synchronisation.
- `src/lib` contient les utilitaires transverses.
- `components.json` indique au CLI shadcn/ui où écrire les composants et trouver les styles et alias.

Les futures fonctionnalités ajouteront les dossiers métier, les services externes, l’accès aux données et les validations à mesure qu’ils seront utilisés.

## Base Supabase locale

Avec Node.js 24 et Docker démarré, exécute ces commandes depuis la racine. La première lance PostgreSQL 17 et applique les migrations au premier démarrage. La deuxième exécute les tests pgTAP avec deux comptes de test dans une transaction annulée à la fin.

```sh
npx --yes supabase@3.3.0 db start
npx --yes supabase@3.3.0 test db
```

Pour vérifier la reconstruction du schéma sur une base de test jetable, `npx --yes supabase@3.3.0 db reset --no-seed` réinitialise la base locale et rejoue les migrations. Cette commande efface les données de cette base. `npx --yes supabase@3.3.0 stop` arrête la base locale en conservant les données.

### Modèle et droits

- `users` relie le profil GameVault à l’identité Supabase Auth. `steam_accounts` associe à ce profil un SteamID64 unique conservé en texte.
- `games` est le catalogue partagé. Le couple plateforme et identifiant externe identifie une entrée. `user_games` porte la possession, les favoris et le dernier temps synchronisé pour chaque profil.
- `game_playtime` conserve des observations cumulées par jeu et par jour UTC. Les écarts entre observations servent de base aux analyses. Un intervalle entre deux observations ne donne pas la date exacte des sessions. Un temps inconnu est conservé sous forme de `NULL` dans `user_games`.
- Backlog, collections et avis appartiennent à chaque profil. Les clés étrangères composites relient ces éléments à des jeux ou à des collections du même utilisateur.
- Les politiques RLS limitent les données privées au compte connecté. Le rôle de synchronisation serveur gère le catalogue, les associations Steam et les mesures importées. Un utilisateur connecté peut gérer ses données personnelles, dont ses favoris.

Les migrations SQL versionnées dans `supabase/migrations` sont la référence du schéma. Les tests sont dans `supabase/tests`.

La wishlist relie chaque profil à des jeux du catalogue, y compris des jeux qu’il ne possède pas. Les définitions de succès pourront être rattachées au catalogue, et les déblocages à la bibliothèque de chaque utilisateur.

## Connexion Steam et première synchronisation

Pour utiliser l’authentification locale, démarre la pile Supabase complète et applique les nouvelles migrations.

```sh
npx --yes supabase@3.3.0 start
npx --yes supabase@3.3.0 migration up
```

Copie `.env.example` dans `.env.local` et renseigne `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` avec la configuration locale. Garde `SUPABASE_SECRET_KEY` et `STEAM_WEB_API_KEY` réservées au serveur. Utilise [la page Steam de gestion de clé Web API](https://steamcommunity.com/dev/apikey) pour obtenir la clé Steam. En local, `APP_URL` vaut `http://localhost:3000`. Pour une instance hébergée, définis l’origine HTTPS de GameVault et autorise le retour `/auth/callback` sur cette origine dans Supabase Auth.

Dans **Settings**, crée un compte avec ton adresse e-mail et un mot de passe, puis confirme l’adresse depuis le même navigateur. La pile locale capture le message dans Mailpit, à l’adresse affichée par le CLI. Tu peux ensuite te connecter avec ton mot de passe. Si ton compte a été créé par lien de connexion, choisis **Définir un mot de passe** dans ta session ou **Mot de passe oublié** si tu es déconnecté.

Une fois connecté à GameVault, utilise **Connect with Steam**. Après validation OpenID, GameVault enregistre le SteamID64 et tente un premier import. Le bouton de synchronisation permet de relancer l’opération.

Dans **Paramètres → Compte Steam**, tu peux aussi activer la synchronisation automatique quotidienne et consulter le résultat du dernier passage. Le planificateur répartit les comptes activés en petits lots. Une bibliothèque inaccessible ou une erreur Steam laisse en place les données du dernier import réussi. [Configuration des tâches planifiées](docs/deploiement.md#activer-les-tâches-steam)

L’import utilise `IPlayerService/GetOwnedGames`. Si des temps récents manquent, GameVault interroge aussi `IPlayerService/GetRecentlyPlayedGames` pour compléter les jeux importés. La visibilité des détails de jeu sur Steam détermine les données accessibles. GameVault conserve la bibliothèque déjà importée quand Steam refuse l’accès ou renvoie une liste vide ou incomplète. L’import peut aboutir si seule la requête d’activité échoue. Les jeux sans titre peuvent être identifiés par leur AppID Steam. [API Steamworks](https://partner.steamgames.com/doc/webapi/IPlayerService)

## Gérer ta bibliothèque

Après la synchronisation, ouvre **My Library** pour chercher un titre, filtrer les jeux ou passer de la grille à la liste. Les filtres figurent dans l’URL. Les genres et descriptions affichés proviennent du catalogue. Une illustration de remplacement s’affiche quand la pochette Steam est indisponible.

Dans la fiche d’un jeu, tu peux l’ajouter aux favoris, compléter sa progression, l’évaluer et le placer dans plusieurs collections. Une fois le statut renseigné, le jeu apparaît dans **Backlog**, où tu peux changer son statut tout en conservant les autres champs. Dans **Collections**, tu peux créer, renommer ou supprimer une collection et retirer ses jeux.

Dans **Paramètres → Compte Steam**, le compteur indique les fiches prêtes et celles qui restent à compléter. La tâche Vercel traite en arrière-plan les jeux Steam déjà importés. **Enrichir les fiches Steam** lance aussi un lot manuel de 12 fiches maximum. Les données du magasin Steam alimentent les filtres, les statistiques par genre et les recommandations de Game Advisor. [Configuration de la tâche planifiée](docs/deploiement.md#activer-les-tâches-steam)

## Consulter les succès Steam

Ouvre la fiche d’un jeu Steam de ta bibliothèque et sélectionne **Charger mes succès**. GameVault interroge Steam à la demande, affiche les succès reçus et indique la date de déblocage quand elle est disponible. Une réponse inaccessible s’affiche séparément d’une liste vide. La lecture utilise la clé Steam existante et les données sont consultées sans stockage dans GameVault. [API Steamworks](https://partner.steamgames.com/doc/webapi/ISteamUserStats)

## Ajouter des jeux à la wishlist

Depuis **Wishlist**, colle le lien d’une fiche Steam ou saisis son AppID. GameVault réutilise le jeu s’il figure déjà dans son catalogue. Sinon, il vérifie son AppID et récupère son nom auprès de Steam avec `STEAM_WEB_API_KEY`. La liste est privée et disponible dès que tu es connecté à GameVault. Si tu importes ensuite ce jeu dans ta bibliothèque, la wishlist affiche un lien vers sa fiche. [Catalogue Steam](https://partner.steamgames.com/doc/webapi/IStoreService)

## Retrouver tes meilleures notes

Ouvre **Classements** pour retrouver tes jeux notés sur 10, regroupés par année. Tu peux choisir **Année de la note** dans la fiche du jeu. Si le champ est vide, GameVault utilise l’année de sortie Steam lorsqu’elle est disponible. Les autres notes apparaissent dans **Sans année**. Les jeux de même note partagent le même rang dans leur groupe.

## Comprendre les statistiques

- Depuis le tableau de bord, **Personnaliser** permet de choisir quels blocs afficher et de changer leur ordre. Enregistre la disposition pour la retrouver sur ton compte. Tu peux retrouver l’ordre et la visibilité d’origine avec **Rétablir la disposition par défaut**, puis enregistrer.
- Le tableau de bord additionne les temps de jeu connus et indique combien de jeux disposent d’une mesure si la couverture est partielle.
- Le bloc **Joués récemment** affiche les durées sur 14 jours au dernier import, avec la date de dernière session si elle est connue. En l’absence d’activité mesurée sur cette période, le tableau de bord affiche les dernières sessions connues lorsqu’elles sont disponibles.
- **Analytics** affiche les huit dernières semaines ou les six derniers mois, période en cours comprise. Un écart entre deux relevés d’un même jeu est attribué à une période uniquement si les deux relevés y figurent. Les périodes sans mesure sont affichées comme indisponibles, les écarts entre périodes sont signalés séparément et les baisses de compteur sont écartées.
- Le temps d’un jeu est associé à chacun de ses genres renseignés. La couverture de ces métadonnées compte chaque jeu une seule fois.
- Les jeux délaissés ont une dernière session connue de plus de 90 jours. Les ajouts récents sont datés par leur arrivée dans GameVault. Le graphique du backlog représente les statuts actuels.

## Game Advisor

Applique les migrations avec `npx --yes supabase@3.3.0 migration up`. Renseigne ensuite `OPENAI_API_KEY` dans `.env.local` et conserve la clé côté serveur. Le modèle par défaut est `gpt-4.1-mini`. Tu peux choisir un modèle compatible avec les appels d’outils stricts via `OPENAI_ADVISOR_MODEL`. La clé serveur Supabase sert à enregistrer les réponses calculées.

Ouvre **Game Advisor** après avoir synchronisé ta bibliothèque. OpenAI reçoit la question pour sélectionner une recherche structurée. GameVault exécute cette recherche sous la session du compte connecté, puis construit la réponse avec ses données privées. Les réponses sont enregistrées dans l’historique du compte et peuvent être supprimées.

Les suggestions de détente et de similarité dépendent des genres renseignés. La recherche des abandons s’appuie sur les statuts personnels et sur le temps connu lorsqu’un seuil est indiqué. Un temps cumulé Steam ne permet pas de déterminer la durée d’une session ou de complétion. Ces durées restent indiquées comme inconnues.

Pour **reprendre un jeu du backlog**, Game Advisor cherche parmi les jeux en cours ou en pause. Il privilégie ceux qui partagent des genres avec tes favoris ou avec des titres notés au moins 8/10. Pour trouver un **jeu proche de tes meilleures notes**, il prend comme référence les jeux qui ont obtenu ta note la plus élevée et affiche les titres de référence et leurs notes lorsque leurs genres correspondent.

## Vérifications

Les scripts `dev` et `build` utilisent Webpack. Turbopack a besoin d’un port interne pour compiler le CSS dans cet environnement. Le contrôle des types de Next.js s’appuie sur l’API TypeScript, ce qui évite un processus détaché lors du build.

```sh
npm run lint       # Applique les règles ESLint de Next.js et de TypeScript
npm test           # Vérifie Steam et la validation des appels d’outil du Game Advisor
npm run typecheck  # Génère les types des routes et vérifie TypeScript
npm run build      # Produit le build de production
npm run test:e2e   # Rejoue les migrations et le parcours dans Chrome sur une pile locale isolée
```

La [procédure de déploiement](docs/deploiement.md) décrit les prérequis du scénario de test, la préproduction sur Vercel et Supabase, puis les contrôles sur l’URL finale.
