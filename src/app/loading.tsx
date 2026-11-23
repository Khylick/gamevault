export default function Loading() {
  return (
    <div role="status" className="grid gap-5 motion-safe:animate-pulse">
      <span className="sr-only">Chargement de la page</span>
      <div aria-hidden="true" className="h-9 w-48 rounded-lg bg-secondary" />
      <div aria-hidden="true" className="h-63 rounded-xl border border-border bg-card" />
    </div>
  );
}
