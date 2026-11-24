# GameVault

GameVault est un compagnon personnel pour les bibliothèques de jeux Steam. Le tableau de bord et la navigation sont disponibles, et la phase 3 ajoute le socle Supabase local.

## Démarrage local

Depuis la racine du projet, sélectionne Node.js 24 avec nvm, installe les versions verrouillées, puis démarre le serveur de développement.

```sh
nvm use
npm ci
npm run dev
```

Ouvre [GameVault en local](http://localhost:3000). Le tableau de bord affiche des jeux et des statistiques de démonstration en développement. Le build de production affiche l’état de bibliothèque en attente.

Les variables utilisées lors des phases suivantes sont documentées dans `.env.example`. Quand une intégration les demandera, copie le modèle dans `.env.local` et renseigne les valeurs. Les variables `NEXT_PUBLIC_*` sont destinées à être publiques. La clé Steam doit rester côté serveur.

## Structure

- `src/app` contient les routes de l’App Router, le layout racine et les styles globaux.
- `src/components` contient les éléments d’interface partagés. Les composants shadcn/ui vivent dans `src/components/ui`.
- `src/features/dashboard` contient le tableau de bord, ses calculs et sa bibliothèque de démonstration.
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

Les migrations SQL versionnées dans `supabase/migrations` sont la référence du schéma. Les tests sont dans `supabase/tests`. La connexion de l’application à Supabase Auth et la synchronisation Steam seront mises en place lors de la phase 4.

Les migrations des futurs modules suivront le même modèle. Les définitions de succès seront rattachées au catalogue, et les déblocages à la bibliothèque de chaque utilisateur. La wishlist reliera un profil à des jeux du catalogue, y compris des jeux qu’il ne possède pas. Les conversations du Game Advisor appartiendront à leur utilisateur et seront protégées par RLS.

## Vérifications

Les scripts `dev` et `build` utilisent Webpack. Turbopack a besoin d’un port interne pour compiler le CSS dans cet environnement. Le contrôle des types de Next.js s’appuie sur l’API TypeScript, ce qui évite un processus détaché lors du build.

```sh
npm run lint       # Applique les règles ESLint de Next.js et de TypeScript
npm run typecheck  # Génère les types des routes et vérifie TypeScript
npm run build      # Produit le build de production
```
