import Link from "next/link";

import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";

import { deleteJournalNote } from "./actions";
import type { readGameJournal } from "./data";
import { JournalNoteForm } from "./journal-note-form";
import { formatLibraryDate } from "./model";
import { MutationForm } from "./mutation-form";

export function GameJournal({ gameId, journal }: {
  gameId: string;
  journal: Awaited<ReturnType<typeof readGameJournal>>;
}) {
  function pageHref(page: number) {
    return "/library/" + gameId + (page === 1 ? "" : "?journalPage=" + page) + "#journal";
  }

  return (
    <section id="journal" aria-labelledby="journal-title" className="scroll-mt-6">
      <Card className="p-5 sm:p-6">
        <h2 id="journal-title" className="text-lg font-semibold">Journal de jeu</h2>
        {!journal ? (
          <p className="mt-2 text-sm text-muted-foreground">Le journal est temporairement indisponible.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">Tes notes sont privées et datées automatiquement.</p>
            {journal.page === 1 && <div className="mt-4"><JournalNoteForm key={gameId} gameId={gameId} /></div>}
            {journal.notes.length ? (
              <ol className="mt-5 divide-y divide-border border-t border-border">
                {journal.notes.map((note) => (
                  <li key={note.id} className="py-4 last:pb-0">
                    <time dateTime={note.created_at} className="text-xs font-medium text-muted-foreground">
                      {formatLibraryDate(note.created_at)}
                    </time>
                    <p className="mt-1 text-sm wrap-anywhere whitespace-pre-wrap">{note.content}</p>
                    <details className="mt-3">
                      <summary className="w-fit cursor-pointer text-sm font-medium text-primary">
                        Modifier ou supprimer
                      </summary>
                      <div className="mt-3 grid gap-3 rounded-lg border border-border p-3">
                        <JournalNoteForm gameId={gameId} note={note} />
                        <MutationForm action={deleteJournalNote}>
                          <input type="hidden" name="gameId" value={gameId} />
                          <input type="hidden" name="noteId" value={note.id} />
                          <SubmitButton label="Supprimer la note" pendingLabel="Suppression…" secondary />
                        </MutationForm>
                      </div>
                    </details>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">Aucune note pour ce jeu.</p>
            )}
            {journal.pages > 1 && (
              <nav aria-label="Pagination du journal" className="mt-5 flex flex-wrap items-center gap-4 text-sm">
                {journal.page > 1 && <Link className="font-medium text-primary hover:underline" href={pageHref(journal.page - 1)}>Notes plus récentes</Link>}
                <span className="text-muted-foreground">Page {journal.page} sur {journal.pages}</span>
                {journal.page < journal.pages && <Link className="font-medium text-primary hover:underline" href={pageHref(journal.page + 1)}>Notes plus anciennes</Link>}
              </nav>
            )}
          </>
        )}
      </Card>
    </section>
  );
}
