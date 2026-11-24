"use client";

import { useActionState, type ReactNode } from "react";

import type { MutationResult } from "./actions";

export function MutationForm({ action, children, className }: {
  action: (previous: MutationResult, form: FormData) => Promise<MutationResult>;
  children: ReactNode;
  className?: string;
}) {
  const [result, dispatch] = useActionState(action, null);

  return (
    <form action={dispatch} className={className}>
      {children}
      {result && (
        <p role={result.error ? "alert" : "status"} className="mt-2 text-sm text-muted-foreground">
          {result.message}
        </p>
      )}
    </form>
  );
}
