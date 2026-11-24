import Link from "next/link";

import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";

import { requestPasswordReset, signInWithPassword, signUp, updatePassword } from "./actions";

const inputClassName = "min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base";
const linkClassName = "font-medium text-primary hover:underline";

function NewPasswordFields() {
  return (
    <>
      <label className="grid gap-2 text-sm font-medium">
        Nouveau mot de passe
        <input type="password" name="password" autoComplete="new-password" required minLength={8} maxLength={72} className={inputClassName} />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Confirmer le mot de passe
        <input type="password" name="passwordConfirmation" autoComplete="new-password" required minLength={8} maxLength={72} className={inputClassName} />
      </label>
      <p className="text-sm text-muted-foreground">Utilise au moins 8 caractères.</p>
    </>
  );
}

export function SignedOutForm({ mode }: { mode: string | string[] | undefined }) {
  const signup = mode === "signup";
  const recovery = mode === "forgot-password";
  const title = signup ? "Créer un compte" : recovery ? "Mot de passe oublié" : "Connexion à GameVault";
  const action = signup ? signUp : recovery ? requestPasswordReset : signInWithPassword;
  const label = signup ? "Créer mon compte" : recovery ? "Envoyer le lien de réinitialisation" : "Se connecter";

  return (
    <Card className="max-w-xl p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {signup && <p className="mt-2 text-sm text-muted-foreground">Confirme ton adresse e-mail après l’inscription.</p>}
      {recovery && (
        <p className="mt-2 text-sm text-muted-foreground">
          Demande un lien pour définir un mot de passe. Tu peux aussi utiliser ce lien si ton compte a été créé par e-mail.
        </p>
      )}
      <form action={action} className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-medium">
          Adresse e-mail
          <input type="email" name="email" autoComplete="username" required maxLength={254} className={inputClassName} />
        </label>
        {signup && <NewPasswordFields />}
        {!signup && !recovery && (
          <label className="grid gap-2 text-sm font-medium">
            Mot de passe
            <input type="password" name="password" autoComplete="current-password" required maxLength={1024} className={inputClassName} />
          </label>
        )}
        <div><SubmitButton label={label} pendingLabel="En cours…" /></div>
      </form>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {signup || recovery ? (
          <Link href="/settings" className={linkClassName}>Revenir à la connexion</Link>
        ) : (
          <>
            <Link href="/settings?mode=signup" className={linkClassName}>Créer un compte</Link>
            <Link href="/settings?mode=forgot-password" className={linkClassName}>Mot de passe oublié</Link>
          </>
        )}
      </div>
    </Card>
  );
}

export function PasswordForm() {
  return (
    <Card className="max-w-xl p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Définir un mot de passe</h2>
      <form action={updatePassword} className="mt-5 grid gap-4">
        <NewPasswordFields />
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <SubmitButton label="Enregistrer le mot de passe" pendingLabel="Enregistrement…" />
          <Link href="/settings" className={linkClassName}>Retour aux paramètres</Link>
        </div>
      </form>
    </Card>
  );
}
