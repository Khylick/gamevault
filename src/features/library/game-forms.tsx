import Link from "next/link";

import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";

import { saveProgress, saveReview, updateMembership } from "./actions";
import { StatusOptions } from "./library-ui";
import type { Collection, LibraryEntry } from "./model";
import { MutationForm } from "./mutation-form";

export function ProgressForm({ game }: { game: LibraryEntry }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Progression</h2>
      <MutationForm action={saveProgress} className="mt-4 grid gap-4">
        <input type="hidden" name="gameId" value={game.game_id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            Statut
            <select name="status" defaultValue={game.status ?? ""} required className="library-field">
              <option value="" disabled>Choisir un statut</option>
              <StatusOptions />
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            Priorité
            <select name="priority" defaultValue={game.priority ?? ""} className="library-field">
              <option value="">Aucune</option>
              <option value="1">1 · Basse</option>
              <option value="2">2</option>
              <option value="3">3 · Moyenne</option>
              <option value="4">4</option>
              <option value="5">5 · Haute</option>
            </select>
          </label>
          <label className="grid min-w-0 gap-1.5 text-sm">
            Date de début
            <input type="date" name="startedOn" defaultValue={game.started_on ?? ""} className="library-field" />
          </label>
          <label className="grid min-w-0 gap-1.5 text-sm">
            Date de fin
            <input type="date" name="finishedOn" defaultValue={game.finished_on ?? ""} className="library-field" />
          </label>
        </div>
        <label className="grid gap-1.5 text-sm">
          Objectifs
          <textarea name="goals" defaultValue={game.goals ?? ""} maxLength={2000} rows={3} className="library-field resize-y" />
        </label>
        <div><SubmitButton label="Enregistrer la progression" pendingLabel="Enregistrement…" /></div>
      </MutationForm>
    </Card>
  );
}

export function ReviewForm({ game }: { game: LibraryEntry }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Avis personnel</h2>
      <MutationForm action={saveReview} className="mt-4 grid gap-4">
        <input type="hidden" name="gameId" value={game.game_id} />
        <label className="grid max-w-36 gap-1.5 text-sm">
          Note sur 10
          <input type="number" name="rating" defaultValue={game.rating ?? ""} min={1} max={10} className="library-field" />
        </label>
        <label className="grid gap-1.5 text-sm">
          Commentaire
          <textarea name="comment" defaultValue={game.comment ?? ""} maxLength={3000} rows={3} className="library-field resize-y" />
        </label>
        {(game.rating !== null || game.comment) && (
          <p className="text-xs text-muted-foreground">Vide les deux champs et enregistre pour supprimer ton avis.</p>
        )}
        <div><SubmitButton label="Enregistrer l’avis" pendingLabel="Enregistrement…" /></div>
      </MutationForm>
    </Card>
  );
}

export function GameCollections({ gameId, collections, memberships }: {
  gameId: string;
  collections: Collection[];
  memberships: Set<string>;
}) {
  const included = collections.filter(({ id }) => memberships.has(id));
  const available = collections.filter(({ id }) => !memberships.has(id));

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Collections</h2>
      {included.length > 0 && (
        <ul className="mt-3 divide-y divide-border">
          {included.map(({ id, name }) => (
            <li className="flex flex-wrap items-center justify-between gap-2 py-2" key={id}>
              <Link href={"/collections/" + id} className="break-words text-sm font-medium text-primary hover:underline">{name}</Link>
              <MutationForm action={updateMembership}>
                <input type="hidden" name="gameId" value={gameId} />
                <input type="hidden" name="collectionId" value={id} />
                <input type="hidden" name="membership" value="remove" />
                <SubmitButton label="Retirer" pendingLabel="Retrait…" secondary />
              </MutationForm>
            </li>
          ))}
        </ul>
      )}
      {available.length > 0 && (
        <MutationForm action={updateMembership} className="mt-4">
          <input type="hidden" name="gameId" value={gameId} />
          <input type="hidden" name="membership" value="add" />
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid min-w-0 flex-1 basis-52 gap-1.5 text-sm">
              Ajouter à une collection
              <select name="collectionId" defaultValue="" required className="library-field">
                <option value="" disabled>Choisir une collection</option>
                {available.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <SubmitButton label="Ajouter" pendingLabel="Ajout…" />
          </div>
        </MutationForm>
      )}
      {collections.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Crée une collection pour y ajouter ce jeu.</p>}
      <Link href="/collections" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Gérer mes collections</Link>
    </Card>
  );
}
