"use client";

import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

export function SubmitButton({ label, pendingLabel, secondary = false }: {
  label: string;
  pendingLabel: string;
  secondary?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "min-h-11 cursor-pointer rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60",
        secondary
          ? "border border-border bg-secondary hover:bg-accent"
          : "bg-primary text-primary-foreground hover:bg-primary/85",
      )}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
