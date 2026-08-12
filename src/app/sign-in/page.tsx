"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { createSupabaseBrowserClient } from "@/core/auth/supabase-browser";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { Input } from "@/core/ui/input";
import { Segmented } from "@/core/ui/segmented";

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: authError } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setPending(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    // A full navigation rather than a client push: the middleware needs to
    // see the new session cookie, and the root layout reads UserSettings to
    // stamp the appearance attributes on <html>.
    window.location.assign(params.get("next") ?? "/");
    router.refresh();
  }

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <Card className="w-full max-w-[400px]">
        <div className="kicker">Ced OS</div>
        <h1 className="m-0 mt-2 font-serif text-[27px] font-normal tracking-[-0.012em]">
          {mode === "sign-in" ? "Welcome back" : "Make an account"}
        </h1>

        <Segmented
          className="mt-5"
          aria-label="Sign in or sign up"
          value={mode}
          onChange={setMode}
          options={[
            { label: "Sign in", value: "sign-in" },
            { label: "Sign up", value: "sign-up" },
          ]}
        />

        <form onSubmit={submit} className="mt-5 flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="kicker">Email</span>
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="kicker">Password</span>
            <Input
              type="password"
              autoComplete={
                mode === "sign-in" ? "current-password" : "new-password"
              }
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
            {pending ? "…" : mode === "sign-in" ? "sign in" : "create account"}
          </Button>
        </form>

        {/*
          This password is owned by Supabase Auth and is recoverable by email.
          The Vault master password is a separate secret with a different
          lifecycle and is deliberately NOT recoverable (decision log §5).
        */}
        <p className="m-0 mt-4 font-mono text-[11px] leading-relaxed text-muted">
          this is your account password. the vault has its own, which is never
          recoverable.
        </p>
      </Card>
    </div>
  );
}
