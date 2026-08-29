"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/core/auth/supabase-browser";
import { AppearanceProvider } from "@/core/theme/appearance-provider";
import { DEFAULT_APPEARANCE } from "@/core/theme/types";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { Input } from "@/core/ui/input";

/**
 * Landed on from /auth/callback after it exchanges a password-recovery
 * `code` for a session, so by the time this renders the user is already
 * authenticated — this page's only job is collecting the new password.
 */
export default function ResetPasswordPage() {
  return (
    <AppearanceProvider initial={DEFAULT_APPEARANCE}>
      <div className="grid h-full min-h-screen place-items-center p-6">
        <ResetPasswordForm />
      </div>
    </AppearanceProvider>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.updateUser({ password });

    if (authError) {
      setPending(false);
      setError(authError.message);
      return;
    }

    // Sign out the recovery session rather than carrying it into the app —
    // anyone with access to the reset link would otherwise be left signed
    // in. Requiring the new password at sign-in confirms the right person
    // completed the reset.
    await supabase.auth.signOut();

    window.location.assign("/sign-in?reset=success");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-100">
      <div className="kicker">Ced OS</div>
      <h1 className="m-0 mt-2 font-serif text-[27px] font-normal tracking-[-0.012em]">
        Set a new password
      </h1>

      <form onSubmit={submit} className="mt-5 flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="kicker">New password</span>
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error && (
          <p className="m-0 font-mono text-[11.5px] text-accent-red">{error}</p>
        )}

        <Button type="submit" disabled={pending} className="mt-1 justify-center">
          {pending ? "…" : "set password"}
        </Button>
      </form>
    </Card>
  );
}
