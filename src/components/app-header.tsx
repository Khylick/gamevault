import { Layers3 } from "lucide-react";
import Link from "next/link";

export function AppHeader() {
  return (
    <header className="border-b border-border bg-background/90">
      <div className="mx-auto flex min-h-17 max-w-6xl items-center px-5 sm:px-10">
        <Link href="/" className="inline-flex items-center gap-3 rounded-md font-semibold tracking-tight">
          <span className="grid size-9 place-items-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
            <Layers3 className="size-4.5" aria-hidden="true" />
          </span>
          GameVault
        </Link>
      </div>
    </header>
  );
}
