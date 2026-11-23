"use client";

import { TriangleAlert } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";

export default function Error({ retry }: { retry: () => void }) {
  return (
    <div className="grid gap-6">
      <PageHeading title="Erreur de chargement" />
      <EmptyState
        icon={TriangleAlert}
        title="La page est indisponible"
        description="Réessaie de charger la page dans quelques instants."
      >
        <button
          type="button"
          onClick={retry}
          className="min-h-11 cursor-pointer rounded-lg border border-border bg-secondary px-4 text-sm font-semibold hover:bg-accent"
        >
          Réessayer
        </button>
      </EmptyState>
    </div>
  );
}
