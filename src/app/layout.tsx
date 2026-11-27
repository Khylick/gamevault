import type { Metadata } from "next";

import { AppHeader } from "@/components/app-header";
import { readTheme } from "@/features/appearance/preferences";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GameVault", template: "%s · GameVault" },
  description: "Un espace personnel pour organiser et retrouver tes jeux Steam.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await readTheme();

  return (
    <html lang="fr" data-theme={theme}>
      <body className="flex min-h-dvh flex-col bg-background font-sans text-foreground antialiased">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-20 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Aller au contenu
        </a>
        <div className="flex-1 lg:grid lg:grid-cols-[14.25rem_minmax(0,1fr)]">
          <AppHeader />
          <main id="contenu" tabIndex={-1} className="mx-auto w-full max-w-[90rem] px-5 pt-7 pb-12 sm:px-8 sm:pt-9 2xl:px-10">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
