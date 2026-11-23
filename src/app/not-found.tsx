import { MapPinOff } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";

export default function NotFound() {
  return (
    <div className="grid gap-6">
      <PageHeading title="Page introuvable" />
      <EmptyState icon={MapPinOff} title="Cette adresse est inconnue" description="Vérifie l’adresse ou reprends depuis le tableau de bord.">
        <Link href="/" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Retour au tableau de bord
        </Link>
      </EmptyState>
    </div>
  );
}
