import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { AdvisorAnswer } from "@/features/advisor/advisor-answer";
import { AdvisorForm } from "@/features/advisor/advisor-form";
import { advisorHasLibrary, listAdvisorHistory, readAdvisorConversation } from "@/features/advisor/data";
import { advisorProviderConfig } from "@/features/advisor/openai";
import { getLibraryViewer } from "@/features/library/data";
import { EmptyLibrary, LibraryAccess } from "@/features/library/library-ui";
import { formatLibraryDate } from "@/features/library/model";
import { hasSupabaseServerKey } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Game Advisor" };

export default async function GameAdvisorPage({ searchParams }: PageProps<"/game-advisor">) {
  const requested = (await searchParams).conversation;
  const id = z.uuid().safeParse(requested);
  const viewer = await getLibraryViewer();
  const heading = <PageHeading title="Game Advisor" description="Pose une question sur les jeux de ta bibliothèque." />;
  if (!viewer) return <div className="grid gap-6">{heading}<LibraryAccess /></div>;

  const [hasLibrary, history, selected] = await Promise.all([
    advisorHasLibrary(viewer),
    listAdvisorHistory(viewer),
    id.success ? readAdvisorConversation(viewer, id.data) : null,
  ]);
  const configured = Boolean(advisorProviderConfig()) && hasSupabaseServerKey();

  return (
    <div className="grid gap-6">
      {heading}
      {requested && !selected && (
        <p role="status" className="rounded-lg border border-border px-4 py-3 text-sm">Cette réponse est indisponible.</p>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="grid min-w-0 gap-5">
          {selected && <AdvisorAnswer key={selected.id} id={selected.id} question={selected.question} answer={selected.answer} />}
          {!hasLibrary ? <EmptyLibrary filtered={false} /> : configured ? (
            <AdvisorForm key={selected?.id ?? "new"} showExamples={!selected} />
          ) : (
            <Card className="flex gap-3 p-5">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">Configuration requise</h2>
                <p className="mt-1 text-sm text-muted-foreground">Configure la clé API OpenAI et la clé serveur Supabase pour poser une question.</p>
              </div>
            </Card>
          )}
        </div>
        <aside aria-labelledby="advisor-history" className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 id="advisor-history" className="font-semibold">Historique récent</h2>
          {selected && <Link href="/game-advisor" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">Nouvelle question</Link>}
          {history.length > 0 ? (
            <ul className="mt-3 grid gap-2">
              {history.map(({ id, question, created_at }) => (
                <li key={id}>
                  <Link href={"/game-advisor?conversation=" + id} aria-current={selected?.id === id ? "page" : undefined}
                    className={cn("block rounded-lg border px-3 py-2 text-sm", selected?.id === id
                      ? "border-primary/30 bg-primary/10" : "border-border bg-background hover:bg-accent")}>
                    <span className="line-clamp-2 break-words">{question}</span>
                    <time dateTime={created_at} className="mt-1 block text-xs text-muted-foreground">{formatLibraryDate(created_at)}</time>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-muted-foreground">Tes réponses enregistrées apparaîtront ici.</p>}
        </aside>
      </div>
    </div>
  );
}
