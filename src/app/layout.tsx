import type { Metadata } from "next";

import { AppHeader } from "@/components/app-header";

import "./globals.css";

export const metadata: Metadata = {
  title: "GameVault",
  description: "Un espace personnel pour organiser et retrouver tes jeux Steam.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="dark">
      <body className="flex min-h-dvh flex-col bg-background font-sans text-foreground antialiased">
        <AppHeader />
        <main className="flex flex-1">{children}</main>
      </body>
    </html>
  );
}
