import type { Collection } from "./model";

export function CollectionFields({ collection }: { collection?: Collection }) {
  return (
    <>
      <label className="grid gap-1.5 text-sm">
        Nom
        <input name="name" defaultValue={collection?.name ?? ""} maxLength={120} required className="library-field" />
      </label>
      <label className="grid gap-1.5 text-sm">
        Description
        <textarea name="description" defaultValue={collection?.description ?? ""} maxLength={1000} rows={2} className="library-field resize-y" />
      </label>
    </>
  );
}
