import { Cable, Settings } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { MutationForm } from "@/features/library/mutation-form";
import { enrichSteamCatalog } from "@/features/steam/catalog-actions";
import { readSteamMetadataProgress } from "@/features/steam/catalog-progress";
import { getSettingsNotice } from "@/features/steam/settings-notice";
import { getSteamAccount, hasSteamApiKey } from "@/features/steam/steam-service";
import { hasSupabaseServerKey } from "@/lib/supabase/admin";
import { getAppOrigin } from "@/lib/supabase/config";
import { createSessionClient } from "@/lib/supabase/session";

import { setSteamAutoSync, signOut, startSteamLink, syncSteamLibrary } from "./actions";
import { AppearanceSettings } from "./appearance-settings";
import { PasswordForm, SignedOutForm } from "./auth-forms";

export const metadata: Metadata = { title: "Paramètres" };

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

type SettingsClient = NonNullable<Awaited<ReturnType<typeof createSessionClient>>>;

type AutoSync = { auto_sync_enabled: boolean; auto_sync_attempted_at: string | null; auto_sync_result: string | null };

function SteamAutoSync({ settings, ready }: { settings: AutoSync; ready: boolean }) {
  const { auto_sync_enabled: active, auto_sync_attempted_at: lastAttempt, auto_sync_result: result } = settings;
  const message = result === "running"
    ? "Résultat du passage en attente."
    : result === "cancelled" ? "Passage annulé." : getSettingsNotice(result ?? undefined)?.message;

  return (
    <div className="mt-5 border-t border-border pt-5">
      <h3 className="text-sm font-semibold">Synchronisation automatique</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {!ready ? "Configuration du planificateur requise" : active ? "Activée · Passage quotidien" : "Désactivée"}
      </p>
      {lastAttempt && (
        <dl className="mt-3 text-sm">
          <dt className="text-muted-foreground">Dernier passage automatique</dt>
          <dd className="mt-1"><time dateTime={lastAttempt}>{dateFormatter.format(new Date(lastAttempt))} UTC</time></dd>
          {message && <dd className="mt-1">{message}</dd>}
        </dl>
      )}
      {(ready || active) && (
        <form action={setSteamAutoSync} className="mt-3">
          <input type="hidden" name="enabled" value={String(!active)} />
          <SubmitButton label={active ? "Désactiver la synchronisation automatique" : "Activer la synchronisation automatique"}
            pendingLabel="Enregistrement…" secondary />
        </form>
      )}
    </div>
  );
}

async function SteamConnection({ supabase, userId }: { supabase: SettingsClient; userId: string }) {
  const account = await getSteamAccount(supabase, userId);
  if (account.error) {
    return (
      <EmptyState icon={Cable} title="État Steam indisponible" description="Réessaie de charger les paramètres dans quelques instants." />
    );
  }

  const serverReady = hasSupabaseServerKey();
  const apiReady = hasSteamApiKey();
  const autoSyncReady = serverReady && apiReady && Boolean(process.env.CRON_SECRET?.trim());
  const connection = account.data;
  const autoSync = connection ? await supabase.from("steam_accounts")
    .select("auto_sync_enabled,auto_sync_attempted_at,auto_sync_result").eq("user_id", userId).maybeSingle<AutoSync>() : null;
  const library = connection?.last_synced_at
    ? await supabase.from("user_games")
        .select("game_id,games!inner(platform)", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("games.platform", "steam")
    : null;
  const progress = serverReady && library?.count ? await readSteamMetadataProgress(supabase) : null;

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Cable className="size-4.5 text-primary" aria-hidden="true" />
        Compte Steam
      </h2>
      {connection ? (
        <>
          <dl className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">SteamID64 associé</dt>
              <dd className="mt-1 font-mono text-sm">{connection.steam_id}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Dernière synchronisation</dt>
              <dd className="mt-1 text-sm">
                {connection.last_synced_at
                  ? <time dateTime={connection.last_synced_at}>{dateFormatter.format(new Date(connection.last_synced_at))} UTC</time>
                  : "En attente"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Jeux enregistrés</dt>
              <dd className="mt-1 text-sm">{library?.count ?? "Indisponible"}</dd>
            </div>
          </dl>
          {serverReady && apiReady && (
            <form action={syncSteamLibrary} className="mt-5">
              <SubmitButton label="Synchroniser la bibliothèque" pendingLabel="Synchronisation en cours…" />
            </form>
          )}
          {autoSync?.data && <SteamAutoSync settings={autoSync.data} ready={autoSyncReady} />}
          {serverReady && Boolean(library?.count) && (
            <div className="mt-5 border-t border-border pt-5">
              <h3 className="text-sm font-semibold">Enrichissement du catalogue</h3>
              {progress && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {progress.complete} {progress.complete === 1 ? "fiche prête" : "fiches prêtes"} · {progress.remaining} à compléter
                  {progress.deferred > 0 && <> · {progress.deferred} en attente d’une prochaine tentative</>}
                </p>
              )}
              <MutationForm action={enrichSteamCatalog} className="mt-3">
                <SubmitButton label="Enrichir les fiches Steam" pendingLabel="Enrichissement…" secondary />
              </MutationForm>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">Associe ton compte pour importer les jeux que Steam rend accessibles.</p>
          {serverReady && (
            <form action={startSteamLink} className="mt-5">
              <SubmitButton label="Connect with Steam" pendingLabel="Redirection vers Steam…" />
            </form>
          )}
        </>
      )}
      {!serverReady && <p className="mt-4 text-sm text-muted-foreground">L’association Steam nécessite la configuration de la clé serveur Supabase.</p>}
      {!apiReady && <p className="mt-4 text-sm text-muted-foreground">La synchronisation sera disponible après configuration de la clé Web API Steam.</p>}
    </Card>
  );
}

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const { mode, notification } = await searchParams;
  const notice = getSettingsNotice(notification);
  const supabase = await createSessionClient();
  const ready = supabase && getAppOrigin();
  const claims = ready && supabase ? (await supabase.auth.getClaims()).data?.claims : null;

  return (
    <div className="grid gap-6">
      <PageHeading title="Paramètres" description="Gère ton compte, l’apparence de GameVault et ta bibliothèque Steam." />
      {notice && (
        <p
          role="status"
          className={notice.success
            ? "rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-primary"
            : "rounded-xl border border-border bg-card px-4 py-3 text-sm"}
        >
          {notice.message}
        </p>
      )}
      {!ready || !supabase ? (
        <EmptyState icon={Settings} title="Configuration requise" description="Configure l’origine de GameVault et la connexion Supabase pour activer les comptes." />
      ) : !claims?.sub ? (
        <SignedOutForm mode={mode} />
      ) : mode === "password" ? (
        <PasswordForm />
      ) : (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-semibold">Compte GameVault</h2>
              {claims.email && <p className="mt-1 break-all text-sm text-muted-foreground">{claims.email}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/settings?mode=password" className="text-sm font-medium text-primary hover:underline">
                Définir un mot de passe
              </Link>
              <form action={signOut}>
                <SubmitButton label="Se déconnecter" pendingLabel="Déconnexion…" secondary />
              </form>
            </div>
          </Card>
          <AppearanceSettings />
          <SteamConnection supabase={supabase} userId={claims.sub} />
        </>
      )}
    </div>
  );
}
