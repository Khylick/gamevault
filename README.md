# GameVault

GameVault est un projet de compagnon personnel pour les bibliothèques de jeux Steam. La phase 2 ajoute la navigation, le thème et le tableau de bord.

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

## Vérifications

Les scripts `dev` et `build` utilisent Webpack. Turbopack a besoin d’un port interne pour compiler le CSS dans cet environnement. Le contrôle des types de Next.js s’appuie sur l’API TypeScript, ce qui évite un processus détaché lors du build.

```sh
npm run lint       # Applique les règles ESLint de Next.js et de TypeScript
npm run typecheck  # Génère les types des routes et vérifie TypeScript
npm run build      # Produit le build de production
```
