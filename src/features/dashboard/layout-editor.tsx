"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";

import { saveDashboardLayout } from "./actions";
import { blockLabels, defaultDashboardLayout, type DashboardBlock, type DashboardLayout } from "./layout";

const moveButton = "grid size-11 place-items-center rounded-lg border border-border hover:bg-accent aria-disabled:opacity-40 aria-disabled:hover:bg-transparent";

export function LayoutEditor({ initial }: { initial: DashboardLayout }) {
  const [layout, setLayout] = useState(initial);
  const [announcement, setAnnouncement] = useState("");
  const [error, action, pending] = useActionState(saveDashboardLayout, null);

  function move(index: number, step: -1 | 1, button: HTMLButtonElement) {
    const nextIndex = index + step;
    if (nextIndex < 0 || nextIndex >= layout.block_order.length) return;

    const order = [...layout.block_order];
    const [block] = order.splice(index, 1);
    order.splice(nextIndex, 0, block);
    setLayout((current) => ({ ...current, block_order: order }));
    setAnnouncement(blockLabels[block] + " en position " + (nextIndex + 1) + " sur " + order.length + ".");
    requestAnimationFrame(() => button.focus());
  }

  function setVisible(block: DashboardBlock, visible: boolean) {
    setLayout((current) => ({
      ...current,
      hidden_blocks: visible ? current.hidden_blocks.filter((hidden) => hidden !== block) : [...current.hidden_blocks, block],
    }));
  }

  function reset() {
    setLayout(defaultDashboardLayout);
    setAnnouncement("Disposition par défaut rétablie dans le formulaire.");
  }

  return (
    <Card className="max-w-2xl p-5 sm:p-6">
      <form action={action}>
        <input type="hidden" name="layout" value={JSON.stringify(layout)} />
        <fieldset disabled={pending}>
          <legend className="sr-only">Visibilité et ordre des blocs</legend>
          <ol className="divide-y divide-border">
            {layout.block_order.map((block, index) => (
              <li key={block} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0">
                <label className="flex min-h-11 min-w-0 items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={!layout.hidden_blocks.includes(block)}
                    onChange={(event) => setVisible(block, event.currentTarget.checked)}
                    className="size-5 shrink-0 accent-primary"
                  />
                  {blockLabels[block]}
                </label>
                <div className="flex gap-2">
                  <button type="button" className={moveButton} aria-label={"Monter " + blockLabels[block]}
                    aria-disabled={index === 0} onClick={(event) => move(index, -1, event.currentTarget)}>
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" className={moveButton} aria-label={"Descendre " + blockLabels[block]}
                    aria-disabled={index === layout.block_order.length - 1} onClick={(event) => move(index, 1, event.currentTarget)}>
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <SubmitButton label="Enregistrer la disposition" pendingLabel="Enregistrement…" />
            <Link href="/" className="font-medium text-primary hover:underline">Annuler</Link>
          </div>
          <button type="button" onClick={reset} className="mt-3 min-h-11 text-sm font-medium text-primary hover:underline">
            Rétablir la disposition par défaut
          </button>
        </fieldset>
        <p role="status" className="sr-only">{announcement}</p>
        {error && <p role="alert" className="mt-3 text-sm text-muted-foreground">{error}</p>}
      </form>
    </Card>
  );
}
