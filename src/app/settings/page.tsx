import { Cable, Settings } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { MutationForm } from "@/features/library/mutation-form";
import { enrichSteamCatalog } from "@/features/steam/catalog-actions";
import { getSettingsNotice } from "@/features/steam/settings-notice";
import { getSteamAccount, hasSteamApiKey } from "@/features/steam/steam-service";
import { hasSupabaseServerKey } from "@/lib/supabase/admin";
import { getAppOrigin } from "@/lib/supabase/config";
import { createSessionClient } from "@/lib/supabase/session";

import { signOut, startSteamLink, syncSteamLibrary } from "./actions";
import { PasswordForm, SignedOutForm } from "./auth-forms";

export const metadata: Metadata = { title: "Paramètres" };

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

type SettingsClient = NonNullable<Awaited<ReturnType<typeof createSessionClient>>>;

async function SteamConnection({ supabase, userId }: { supabase: SettingsClient; userId: string }) {
  const account = await getSteamAccount(supabase, userId);
  if (account.error) {
    return (
      <EmptyState icon={Cable} title="État Steam indisponible" description="Réessaie de charger les paramètres dans quelques instants." />
    );
  }

  const serverReady = hasSupabaseServerKey();
  const apiReady = hasSteamApiKey();
  const connection = account.data;
  const library = connection?.last_synced_at
    ? await supabase.from("user_games")
        .select("game_id,games!inner(platform)", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("games.platform", "steam")
    : null;

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
          {serverReady && Boolean(library?.count) && (
            <div className="mt-5 border-t border-border pt-5">
              <p className="mb-3 text-sm text-muted-foreground">Complète les descriptions et les genres manquants par lots de 12 fiches.</p>
              <MutationForm action={enrichSteamCatalog}>
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
      <PageHeading title="Paramètres" description="Gère ton compte GameVault et ta bibliothèque Steam." />
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
          <SteamConnection supabase={supabase} userId={claims.sub} />
        </>
      )}
    </div>
  );
}
