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

`test:e2e` construit l’application dans un répertoire temporaire et démarre un projet Supabase distinct sur des ports locaux libres. Il rejoue les migrations, exécute pgTAP et le lint SQL, puis utilise Mailpit pour vérifier l’inscription et la récupération de compte. Steam et OpenAI sont simulés. Le scénario vérifie les droits entre deux comptes, l’import, les mutations, les graphiques et les réponses du Game Advisor. Il mesure ensuite les temps de réponse sur 5 002 jeux, puis arrête et supprime les ressources de ce projet de test.

`GAMEVAULT_CHROME_BIN` permet d’indiquer le chemin de Chrome ou Chromium. Le script utilise le CLI Supabase 3.3.0 via npm. `GAMEVAULT_SUPABASE_CLI` permet d’indiquer le chemin d’un binaire 3.3.0 déjà installé.

## Préparer la préproduction

1. Prépare un projet Supabase de test et relève sa référence. Dans Vercel, importe le dépôt GitHub de GameVault avec le préréglage Next.js et Node.js 24. Choisis une URL HTTPS de préproduction stable. Utilise les réglages **Preview** de Vercel pour les variables de test. [Versions Node.js](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) · [Environnements Vercel](https://vercel.com/docs/deployments/environments)
2. Dans Supabase Auth, renseigne l’origine HTTPS comme **Site URL** et autorise l’URL exacte `https://<domaine>/auth/callback`. Active la confirmation d’adresse si tu ouvres les inscriptions et configure un SMTP personnalisé pour les confirmations et la récupération de compte. Ouvre les liens dans le navigateur qui les a demandés. Désactive le suivi des clics pour éviter que le fournisseur SMTP altère les liens. [URL de retour](https://supabase.com/docs/guides/auth/redirect-urls) · [SMTP personnalisé](https://supabase.com/docs/guides/auth/auth-smtp)
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
| `CRON_SECRET` | Secret requis en **Production** pour autoriser les tâches Steam |

4. Applique les migrations au projet ciblé. Compare la ligne `Target:` et la liste des migrations avec la référence Supabase attendue avant de confirmer. [Migrations Supabase](https://supabase.com/docs/guides/deployment/database-migrations)

```sh
npx --yes supabase@3.3.0 login
npx --yes supabase@3.3.0 link --project-ref "REFERENCE_DU_PROJET"
npx --yes supabase@3.3.0 db push --dry-run --remote
npx --yes supabase@3.3.0 db push --remote
```

## Vérifier le parcours hébergé

- Après avoir associé un compte Steam de test, active la synchronisation automatique dans **Paramètres** et vérifie le résultat du premier passage et les changements de bibliothèque.
- Dans **Game Advisor**, pose une question sur les jeux à reprendre, puis une sur les jeux proches de tes meilleures notes. Vérifie que les statuts, les genres et les notes cités correspondent à ta bibliothèque.
- Note un jeu dont l’année de sortie Steam est connue et vérifie son groupe dans **Classements**. Renseigne une autre année sur sa fiche, puis vérifie qu’il rejoint le groupe correspondant.
- Depuis **Paramètres**, lance **Enrichir les fiches Steam** sur une bibliothèque déjà importée. Vérifie la description dans une fiche et la présence de ses genres dans les filtres de la bibliothèque.
- Depuis le tableau de bord, ouvre **Personnaliser**, déplace un bloc et masque-en un autre. Enregistre, recharge la page puis rétablis la disposition par défaut.
- Dans **Wishlist**, ajoute un jeu Steam absent de ta bibliothèque avec le lien de sa fiche, vérifie que son nom et son lien s’affichent, puis retire-le.
- Ouvre la fiche d’un jeu possédé qui propose des succès et sélectionne **Charger mes succès**. Compare le résultat à Steam et vérifie le message affiché si la confidentialité du profil empêche la lecture.
- Depuis l’URL HTTPS de préproduction, crée un compte, confirme l’adresse, puis déconnecte-toi et reconnecte-toi avec ton mot de passe. Vérifie aussi le parcours **Mot de passe oublié**. Associe un compte Steam de test et vérifie le nombre de jeux importés puis l’état affiché pour une bibliothèque inaccessible en modifiant la confidentialité du profil Steam.
- Consulte un jeu importé, modifie son statut et vérifie qu’il apparaît dans le backlog. Consulte Analytics et vérifie la distinction entre temps connu et données indisponibles. Pose une question au Game Advisor avec une clé OpenAI du projet de test.
- Compare le temps sur 14 jours d’un jeu dans **Joués récemment** et dans sa fiche après synchronisation. Si Steam ne fournit pas la date de dernière session, vérifie qu’elle reste indiquée comme inconnue.
- Ouvre une deuxième session avec un autre compte. Vérifie que les fiches et réponses du premier compte lui restent inaccessibles. Si l’instance est destinée à un usage personnel, configure les inscriptions dans Supabase Auth et l’accès au déploiement dans Vercel en fonction des comptes autorisés. [Sécurité Supabase](https://supabase.com/docs/guides/security/production-checklist) · [Protection des déploiements Vercel](https://vercel.com/docs/deployment-protection)

## Passer en production

1. Vérifie la disponibilité d’une sauvegarde de la base de production et identifie le déploiement Vercel à rétablir si nécessaire.
2. Configure les variables **Production** de Vercel et les URL Supabase Auth de production. Vérifie la cible, puis applique les migrations en suivant la procédure ci-dessus.
3. Publie la révision validée et rejoue sur l’URL finale la connexion par mot de passe, la liaison Steam, la synchronisation et une question au Game Advisor.
4. En cas de régression applicative, rétablis le déploiement Vercel précédent. Évalue les migrations déjà appliquées avant toute restauration de données. [Retour à un déploiement Vercel précédent](https://vercel.com/docs/deployments/instant-rollback)

## Activer les tâches Steam

Génère un secret aléatoire avec `openssl rand -hex 32` et enregistre-le sous `CRON_SECRET` dans les variables **Production** de Vercel. Si ce secret existe déjà pour l’enrichissement du catalogue, les deux tâches utilisent la même valeur. Applique les migrations Supabase, puis déploie la version qui contient `vercel.json`. Vercel transmet le secret dans l’en-tête `Authorization`. [Gestion des tâches Vercel](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs)

- `/api/cron/steam-sync` synchronise les comptes ayant activé l’option pendant le créneau quotidien de 02 h UTC. Le passage traite jusqu’à 12 comptes, par lots de trois, en commençant par ceux qui attendent depuis le plus longtemps. Consulte le résultat dans **Paramètres → Compte Steam**.
- `/api/cron/steam-metadata` enrichit jusqu’à 48 fiches, réparties en lots de 12, pendant le créneau quotidien de 03 h UTC. Si Steam limite les appels, le passage s’arrête et les fiches réservées redeviennent éligibles après leur délai de reprise.

Vérifie l’état de ces deux routes dans **Vercel → Cron Jobs**.

Les compteurs serveur autorisent jusqu’à 10 demandes de synchronisation Steam et 30 questions Game Advisor par compte et par heure UTC. La limite s’applique avant l’appel externe. Une réponse de limitation invite à réessayer à l’heure suivante.
