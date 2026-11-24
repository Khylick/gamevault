# Déployer GameVault

## Valider la version locale

Avec Node.js 24, Docker et Chrome ou Chromium disponibles, lance les vérifications depuis la racine du dépôt.

```sh
npm ci
npm test
npm run lint
npm run typecheck
npm run test:e2e
```

`test:e2e` construit l’application dans un répertoire temporaire et démarre un projet Supabase distinct sur des ports locaux libres. Il rejoue les migrations, exécute pgTAP et le lint SQL, puis utilise Mailpit pour les liens de connexion. Steam et OpenAI sont simulés. Le scénario vérifie les droits entre deux comptes, l’import, les mutations, les graphiques et les réponses du Game Advisor. Il mesure ensuite les temps de réponse sur 5 002 jeux, puis arrête et supprime les ressources de ce projet de test.

`GAMEVAULT_CHROME_BIN` permet d’indiquer le chemin de Chrome ou Chromium. Le script utilise le CLI Supabase 3.3.0 via npm. `GAMEVAULT_SUPABASE_CLI` permet d’indiquer le chemin d’un binaire 3.3.0 déjà installé.

## Préparer la préproduction

1. Prépare un projet Supabase de test et relève sa référence. Dans Vercel, importe le dépôt GitHub de GameVault avec le préréglage Next.js et Node.js 24. Choisis une URL HTTPS de préproduction stable. Utilise les réglages **Preview** de Vercel pour les variables de test. [Versions Node.js](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) · [Environnements Vercel](https://vercel.com/docs/deployments/environments)
2. Dans Supabase Auth, renseigne l’origine HTTPS comme **Site URL** et autorise l’URL exacte `https://<domaine>/auth/callback`. Configure un SMTP si tes testeurs sont hors de l’équipe Supabase, puis vérifie la réception d’un lien dans le navigateur qui l’a demandé. Le suivi des clics du fournisseur SMTP peut altérer les liens de connexion. [URL de retour](https://supabase.com/docs/guides/auth/redirect-urls) · [SMTP personnalisé](https://supabase.com/docs/guides/auth/auth-smtp)
3. Dans Vercel, configure les variables du projet de test. Les changements de variables s’appliquent au prochain déploiement. [Variables d’environnement Vercel](https://vercel.com/docs/environment-variables)

| Variable | Valeur |
| --- | --- |
| `APP_URL` | Origine HTTPS exacte de ce déploiement |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase de cet environnement |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique de ce projet |
| `SUPABASE_SECRET_KEY` | Clé secrète du même projet, réservée au serveur |
| `STEAM_WEB_API_KEY` | Clé Steam Web API utilisée côté serveur |
| `OPENAI_API_KEY` | Clé du projet OpenAI côté serveur |
| `OPENAI_ADVISOR_MODEL` | Modèle facultatif, `gpt-4.1-mini` par défaut |

4. Applique les migrations au projet ciblé. Compare la ligne `Target:` et la liste des migrations avec la référence Supabase attendue avant de confirmer. [Migrations Supabase](https://supabase.com/docs/guides/deployment/database-migrations)

```sh
npx --yes supabase@3.3.0 login
npx --yes supabase@3.3.0 link --project-ref "REFERENCE_DU_PROJET"
npx --yes supabase@3.3.0 db push --dry-run --remote
npx --yes supabase@3.3.0 db push --remote
```

## Vérifier le parcours hébergé

- Depuis l’URL HTTPS de préproduction, ouvre le lien e-mail dans le navigateur où tu l’as demandé, puis associe un compte Steam de test. Vérifie le nombre de jeux importés et l’état affiché pour une bibliothèque inaccessible. Utilise les paramètres de confidentialité du compte Steam de test pour ces deux cas.
- Consulte un jeu importé, modifie son statut et vérifie qu’il apparaît dans le backlog. Consulte Analytics et vérifie la distinction entre temps connu et données indisponibles. Pose une question au Game Advisor avec une clé OpenAI du projet de test.
- Ouvre une deuxième session avec un autre compte. Vérifie que les fiches et réponses du premier compte lui restent inaccessibles. Si l’instance est destinée à un usage personnel, configure les inscriptions dans Supabase Auth et l’accès au déploiement dans Vercel en fonction des comptes autorisés. [Sécurité Supabase](https://supabase.com/docs/guides/security/production-checklist) · [Protection des déploiements Vercel](https://vercel.com/docs/deployment-protection)

## Passer en production

1. Vérifie la disponibilité d’une sauvegarde de la base de production et identifie le déploiement Vercel à rétablir si nécessaire.
2. Configure les variables **Production** de Vercel et les URL Supabase Auth de production. Vérifie la cible, puis applique les migrations en suivant la procédure ci-dessus.
3. Publie la révision validée et rejoue sur l’URL finale la connexion par e-mail, la liaison Steam, la synchronisation et une question au Game Advisor.
4. En cas de régression applicative, rétablis le déploiement Vercel précédent. Évalue les migrations déjà appliquées avant toute restauration de données. [Retour à un déploiement Vercel précédent](https://vercel.com/docs/deployments/instant-rollback)

Les compteurs serveur autorisent jusqu’à 10 demandes de synchronisation Steam et 30 questions Game Advisor par compte et par heure UTC. La limite s’applique avant l’appel externe. Une réponse de limitation invite à réessayer à l’heure suivante.
