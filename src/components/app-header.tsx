"use client";

import { Cable, Layers3, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

import { dashboardLink, sections } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const links = [dashboardLink, ...sections.map(({ slug, label, icon }) => ({ label, icon, href: "/" + slug }))];

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link href="/" onNavigate={onNavigate} className="inline-flex items-center gap-3 rounded-lg">
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_3px_20px_#8b5cf640]">
        <Layers3 className="size-5" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <span className="text-xl font-semibold tracking-[-0.045em]">GameVault</span>
    </Link>
  );
}

function NavigationLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Navigation principale">
      <ul className="grid gap-1">
        {links.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

          return (
            <li key={href}>
              <Link
                href={href}
                onNavigate={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg border border-transparent px-3 text-sm font-medium transition-colors",
                  active
                    ? "border-primary/20 bg-primary/13 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-4.5 shrink-0" aria-hidden="true" />
                <span lang="en">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const mobileMenu = useRef<HTMLDetailsElement>(null);

  function closeMenu() {
    if (mobileMenu.current) mobileMenu.current.open = false;
  }

  return (
    <header className="border-b border-border bg-sidebar lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:overflow-y-auto lg:border-r lg:border-b-0">
      <div className="hidden flex-1 flex-col p-5 lg:flex">
        <div className="px-2 pt-1 pb-10">
          <Brand />
        </div>
        <NavigationLinks pathname={pathname} />
        <div className="mt-auto pt-10">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3">
            <Cable className="size-4.5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Steam</p>
              <p className="text-xs text-muted-foreground">Compte non connecté</p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative lg:hidden">
        <div className="flex min-h-17 items-center px-5">
          <Brand onNavigate={closeMenu} />
        </div>
        <details ref={mobileMenu} className="group">
          <summary className="absolute top-3 right-5 flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-accent [&::-webkit-details-marker]:hidden">
            <Menu className="size-4 group-open:hidden" aria-hidden="true" />
            <X className="hidden size-4 group-open:block" aria-hidden="true" />
            Menu
          </summary>
          <div className="border-t border-border px-5 py-3">
            <NavigationLinks pathname={pathname} onNavigate={closeMenu} />
          </div>
        </details>
      </div>
    </header>
  );
}
