import type { ReactNode } from "react";

export function PageHeading({ title, description, children }: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">{title}</h1>
        {description && <p className="mt-1.5 text-muted-foreground">{description}</p>}
      </div>
      {children}
    </header>
  );
}
