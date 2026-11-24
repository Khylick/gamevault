"use client";

import { useActionState, useRef, useState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";

import { askAdvisor } from "./actions";
import { advisorExamples } from "./model";

export function AdvisorForm({ showExamples }: { showExamples: boolean }) {
  const [state, submit, pending] = useActionState(askAdvisor, null);
  const [question, setQuestion] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <form action={submit} aria-busy={pending} className="grid gap-3">
        <label htmlFor="advisor-question" className="text-lg font-semibold">Ta question</label>
        <textarea
          id="advisor-question"
          ref={input}
          name="question"
          rows={3}
          minLength={2}
          maxLength={500}
          required
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          aria-describedby="advisor-privacy"
          placeholder="À quoi jouer dans ma bibliothèque ?"
          className="library-field min-h-24 resize-y"
        />
        <p id="advisor-privacy" className="text-xs leading-relaxed text-muted-foreground">
          OpenAI reçoit ta question pour en comprendre l’intention. GameVault consulte ta bibliothèque séparément.
        </p>
        {state?.error && <p role="alert" className="rounded-md border border-destructive/40 p-2.5 text-sm">{state.message}</p>}
        <div><SubmitButton label="Poser la question" pendingLabel="Analyse en cours…" /></div>
      </form>
      {showExamples && (
        <section className="mt-6 border-t border-border pt-4" aria-labelledby="advisor-examples">
          <h2 id="advisor-examples" className="text-sm font-semibold">Exemples de questions</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {advisorExamples.map((example) => (
              <li key={example}>
                <button type="button" disabled={pending} className="cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-left text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground disabled:opacity-60"
                  onClick={() => { setQuestion(example); input.current?.focus(); }}>
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
