"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/core/auth/supabase-browser";
import { safeNext } from "@/core/auth/safe-redirect";
import { AppearanceProvider, useAppearance } from "@/core/theme/appearance-provider";
import { DEFAULT_APPEARANCE } from "@/core/theme/types";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { Input } from "@/core/ui/input";
import { Segmented } from "@/core/ui/segmented";

export default function SignInPage() {
  return (
    <AppearanceProvider initial={DEFAULT_APPEARANCE}>
      <SyncThemeFromDom />
      <div className="relative min-h-screen">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage: "radial-gradient(var(--dot) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <ThemeToggle />
        <Suspense>
          <SignInForm />
        </Suspense>
      </div>
    </AppearanceProvider>
  );
}

/**
 * AppearanceScript (core/theme/appearance-script.ts) already stamps <html>
 * from localStorage before first paint, but this provider's React state
 * always starts from DEFAULT_APPEARANCE to match the server-rendered markup
 * and avoid a hydration mismatch. Reconcile the two once, after mount.
 */
function SyncThemeFromDom() {
  const { theme, setAppearance } = useAppearance();

  useEffect(() => {
    const domTheme = document.documentElement.dataset.theme;
    if (domTheme && domTheme !== theme) {
      setAppearance({ theme: domTheme as typeof theme });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once, on mount
  }, []);

  return null;
}

function ThemeToggle() {
  const { theme, setAppearance } = useAppearance();

  return (
    <button
      type="button"
      title="Toggle day/night"
      aria-label={theme === "dark" ? "Switch to paper theme" : "Switch to dark theme"}
      onClick={() => setAppearance({ theme: theme === "dark" ? "paper" : "dark" })}
      className="absolute right-5 top-5 grid size-6.5 place-items-center rounded-[7px] border border-border text-muted"
    >
      {theme === "dark" ? <MoonGlyph /> : <SunGlyph />}
    </button>
  );
}

function SunGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const next = safeNext(params.get("next"));
    const { error: authError } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              // Supabase's confirmation email redirects the browser here
              // with a `?code=`, which /auth/callback exchanges for a
              // session. Without this it falls back to the project's Auth
              // "Site URL", which the confirmation link would otherwise
              // land on with no way to complete the sign-in.
              emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
            },
          });

    setPending(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (mode === "sign-up") {
      setError(null);
      setNotice("Check your email to confirm your account before signing in.");
      return;
    }

    // A full navigation rather than a client push: the proxy needs to
    // see the new session cookie, and the root layout reads UserSettings to
    // stamp the appearance attributes on <html>.
    window.location.assign(next);
    router.refresh();
  }

  return (
    <div className="grid h-full min-h-screen place-items-center p-6">
      <Card className="w-full max-w-100">
        <div className="kicker">Ced OS</div>
        <h1 className="m-0 mt-2 font-serif text-[27px] font-normal tracking-[-0.012em]">
          {mode === "sign-in" ? "Welcome back" : "Make an account"}
        </h1>

        <Segmented
          className="mt-5"
          aria-label="Sign in or sign up"
          value={mode}
          onChange={(next) => {
            setMode(next);
            setError(null);
            setNotice(null);
          }}
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
            {mode === "sign-in" && (
              <button
                type="button"
                className="self-start font-mono text-[11px] text-muted underline decoration-dotted"
              >
                Forgot password?
              </button>
            )}
          </label>

          {error && (
            <p className="m-0 font-mono text-[11.5px] text-accent-red">{error}</p>
          )}
          {notice && (
            <p className="m-0 font-mono text-[11.5px] text-muted">{notice}</p>
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
