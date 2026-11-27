import { Palette } from "lucide-react";

import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { readTheme } from "@/features/appearance/preferences";
import { themeLabels, themeSchema } from "@/features/appearance/themes";

import { saveTheme } from "./actions";

export async function AppearanceSettings() {
  const currentTheme = await readTheme();

  return (
    <section aria-labelledby="appearance-title">
      <Card className="p-5 sm:p-6">
        <h2 id="appearance-title" className="flex items-center gap-2 text-lg font-semibold">
          <Palette className="size-4.5 text-primary" aria-hidden="true" />
          Apparence
        </h2>
        <form action={saveTheme} className="mt-4 grid justify-items-start gap-4">
          <fieldset className="w-full min-w-0">
            <legend className="mb-2 text-sm text-muted-foreground">Thème visuel</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {themeSchema.options.map((theme) => (
                <label key={theme} className="flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent has-checked:border-primary has-checked:bg-primary/10">
                  <input type="radio" name="theme" value={theme} defaultChecked={theme === currentTheme} required className="size-4 shrink-0 accent-primary" />
                  <span>{themeLabels[theme]}</span>
                  <span data-theme={theme} aria-hidden="true" className="ml-auto flex gap-1 rounded border border-border bg-background p-1">
                    <span className="size-2 rounded-full bg-foreground" />
                    <span className="size-2 rounded-full bg-primary" />
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <SubmitButton label="Enregistrer le thème" pendingLabel="Enregistrement…" />
        </form>
      </Card>
    </section>
  );
}
