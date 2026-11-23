import { LibraryBig } from "lucide-react";

import { Card } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="vault-background flex w-full items-center px-5 py-16 sm:px-10">
      <section aria-labelledby="welcome-title" className="mx-auto w-full max-w-6xl">
        <div className="max-w-2xl">
          <h1 id="welcome-title" className="text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
            Ta bibliothèque Steam
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
            Retrouve tes jeux, organise ton backlog et suis ton temps de jeu au même endroit.
          </p>
        </div>

        <Card className="mt-10 flex max-w-2xl flex-col gap-4 p-6 sm:flex-row sm:items-center sm:p-8">
          <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <LibraryBig className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold">Bibliothèque en attente</h2>
            <p className="mt-1 text-muted-foreground">
              Tes jeux apparaîtront ici lorsque la synchronisation Steam sera disponible.
            </p>
          </div>
        </Card>
      </section>
    </div>
  );
}
