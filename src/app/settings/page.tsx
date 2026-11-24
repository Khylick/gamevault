import { Cable, Mail, Settings } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { getSettingsNotice } from "@/features/steam/settings-notice";
import { getSteamAccount, hasSteamApiKey } from "@/features/steam/steam-service";
import { hasSupabaseServerKey } from "@/lib/supabase/admin";
import { getAppOrigin } from "@/lib/supabase/config";
import { createSessionClient } from "@/lib/supabase/session";

import { sendSignInLink, signOut, startSteamLink, syncSteamLibrary } from "./actions";

export const metadata: Metadata = { title: "Paramètres" };

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function SignInForm() {
  return (
    <Card className="max-w-2xl p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Mail className="size-4.5 text-primary" aria-hidden="true" />
        Connexion à GameVault
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">Un lien de connexion te permettra de retrouver tes jeux sur ce compte.</p>
      <form action={sendSignInLink} className="mt-5 grid gap-3">
        <label htmlFor="email" className="text-sm font-medium">Adresse e-mail</label>
        <div className="flex flex-wrap gap-3">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            className="min-h-11 min-w-0 flex-1 basis-50 rounded-lg border border-border bg-background px-3 text-base"
          />
          <SubmitButton label="Envoyer le lien" pendingLabel="Envoi en cours…" />
        </div>
      </form>
    </Card>
  );
}

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
  const { notification } = await searchParams;
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
        <SignInForm />
      ) : (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-semibold">Compte GameVault</h2>
              {claims.email && <p className="mt-1 break-all text-sm text-muted-foreground">{claims.email}</p>}
            </div>
            <form action={signOut}>
              <SubmitButton label="Se déconnecter" pendingLabel="Déconnexion…" secondary />
            </form>
          </Card>
          <SteamConnection supabase={supabase} userId={claims.sub} />
        </>
      )}
    </div>
  );
}
