import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { sections } from "@/lib/navigation";

export const dynamicParams = false;

export function generateStaticParams() {
  return sections.filter(({ slug }) => slug !== "settings").map(({ slug }) => ({ section: slug }));
}

export async function generateMetadata({ params }: PageProps<"/[section]">): Promise<Metadata> {
  const { section } = await params;
  const entry = sections.find(({ slug }) => slug === section);
  return { title: entry?.title };
}

export default async function SectionPage({ params }: PageProps<"/[section]">) {
  const { section } = await params;
  const entry = sections.find(({ slug }) => slug === section);

  if (!entry) notFound();

  return (
    <div className="grid gap-6">
      <PageHeading title={entry.title} />
      <EmptyState icon={entry.icon} title="Section en préparation" description={entry.description} />
    </div>
  );
}
