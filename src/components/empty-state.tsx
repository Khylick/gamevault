import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

export function EmptyState({ icon: Icon, title, description, children }: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <Card className="flex min-h-65 flex-col items-center justify-center px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h2 className="mt-5 text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      {children && <div className="mt-5">{children}</div>}
    </Card>
  );
}
