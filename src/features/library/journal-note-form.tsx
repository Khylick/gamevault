"use client";

import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";

import { saveJournalNote, type MutationResult } from "./actions";
import { journalNoteMaxLength, type JournalNote } from "./model";

export function JournalNoteForm({ gameId, note }: { gameId: string; note?: JournalNote }) {
  const [content, setContent] = useState(note?.content ?? "");
  const [result, dispatch, pending] = useActionState(async (previous: MutationResult, form: FormData) => {
    const result = await saveJournalNote(previous, form);
    if (result && !result.error && !note) setContent("");
    return result;
  }, null);

  return (
    <form action={dispatch} className="grid gap-3">
      <input type="hidden" name="gameId" value={gameId} />
      {note && <input type="hidden" name="noteId" value={note.id} />}
      <label className="grid gap-1.5 text-sm">
        {note ? "Modifier le texte de la note" : "Nouvelle note"}
        <textarea name="content" value={content} onChange={(event) => setContent(event.target.value)}
          readOnly={pending} required maxLength={journalNoteMaxLength} rows={3} className="library-field resize-y" />
      </label>
      <div>
        <SubmitButton label={note ? "Enregistrer la note" : "Ajouter une note"} pendingLabel="Enregistrement…" />
      </div>
      {result && (
        <p role={result.error ? "alert" : "status"} className="text-sm text-muted-foreground">{result.message}</p>
      )}
    </form>
  );
}
