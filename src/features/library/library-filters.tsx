"use client";

import { LayoutGrid, List, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

import { pageHref, parseLibraryQuery, statusLabels, type LibraryQuery } from "./model";

export function LibraryFilters({ query, genres }: { query: LibraryQuery; genres: string[] }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  useEffect(() => () => clearTimeout(timer.current), []);

  function apply() {
    clearTimeout(timer.current);
    if (!form.current) return;
    const values = parseLibraryQuery(Object.fromEntries(new FormData(form.current)));
    startTransition(() => router.replace(pageHref("/library", values, 1), { scroll: false }));
  }

  function scheduleSearch() {
    clearTimeout(timer.current);
    timer.current = setTimeout(apply, 250);
  }

  return (
    <form
      ref={form}
      action="/library"
      onSubmit={(event) => { event.preventDefault(); apply(); }}
      className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:p-5"
      aria-label="Filtres de la bibliothèque"
      aria-busy={pending}
    >
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 basis-56">
          <span className="sr-only">Rechercher un jeu</span>
          <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" aria-hidden="true" />
          <input type="search" name="q" defaultValue={query.q} maxLength={100} onInput={scheduleSearch}
            placeholder="Rechercher un jeu" className="library-field pl-9" />
        </label>
        <fieldset className="flex gap-1 rounded-lg border border-border bg-background p-1">
          <legend className="sr-only">Mode d’affichage</legend>
          {([{ value: "grid", label: "Grille", icon: LayoutGrid }, { value: "list", label: "Liste", icon: List }] as const).map(({ value, label, icon: Icon }) => (
            <label key={value} className="cursor-pointer">
              <input type="radio" name="view" value={value} defaultChecked={query.view === value} onChange={apply} className="peer sr-only" />
              <span className="flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground peer-checked:bg-accent peer-checked:text-primary peer-focus-visible:outline-2 peer-focus-visible:outline-ring">
                <Icon className="size-4" aria-hidden="true" />{label}
              </span>
            </label>
          ))}
        </fieldset>
      </div>
      <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-4 xl:grid-cols-5">
        <label className="grid gap-1.5 text-sm">
          Genre
          <select name="genre" defaultValue={query.genre} onChange={apply} className="library-field">
            <option value="">Tous les genres</option>
            {genres.map((genre) => <option key={genre}>{genre}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          Statut
          <select name="status" defaultValue={query.status} onChange={apply} className="library-field">
            <option value="">Tous les statuts</option>
            <option value="none">Sans statut</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          Temps de jeu
          <select name="time" defaultValue={query.time} onChange={apply} className="library-field">
            <option value="">Toutes les durées</option>
            <option value="zero">Jamais lancé</option>
            <option value="under10">Moins de 10 h</option>
            <option value="over10">10 h et plus</option>
            <option value="unknown">Indisponible</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          Trier par
          <select name="sort" defaultValue={query.sort} onChange={apply} className="library-field">
            <option value="name">Nom</option>
            <option value="playtime">Temps de jeu</option>
            <option value="added">Date d’ajout</option>
            <option value="recent">Dernière session</option>
          </select>
        </label>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="favorite" value="1" defaultChecked={query.favorite === "1"}
            onChange={apply} className="size-4 accent-primary" /> Favoris uniquement
        </label>
        <noscript><button type="submit" className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">Appliquer</button></noscript>
      </div>
    </form>
  );
}
