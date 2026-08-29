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

const RESEND_COOLDOWN_MS = 30_000;

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

/** Monochrome so it follows the design system's currentColor-only icon rule. */
function GoogleGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 488 512" fill="currentColor" aria-hidden>
      <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
    </svg>
  );
}

type Screen =
  | { kind: "form" }
  | { kind: "forgot-password" }
  | { kind: "check-email"; email: string; purpose: "signup" | "reset" };

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = safeNext(params.get("next"));

  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [screen, setScreen] = useState<Screen>({ kind: "form" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("error") === "confirmation_failed"
      ? "That confirmation link is invalid or has expired."
      : null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (resendAvailableAt <= Date.now()) return;
    const id = setInterval(() => {
      if (Date.now() >= resendAvailableAt) clearInterval(id);
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [resendAvailableAt]);

  const resendCooldown = Math.max(0, Math.ceil((resendAvailableAt - nowTick) / 1000));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
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
              emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
            },
          });

    setPending(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (mode === "sign-up") {
      setScreen({ kind: "check-email", email, purpose: "signup" });
      setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
      return;
    }

    // A full navigation rather than a client push: the proxy needs to
    // see the new session cookie, and the root layout reads UserSettings to
    // stamp the appearance attributes on <html>.
    window.location.assign(nextPath);
    router.refresh();
  }

  async function submitForgotPassword(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`,
    });

    setPending(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setScreen({ kind: "check-email", email, purpose: "reset" });
    setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
  }

  async function resend(targetEmail: string, purpose: "signup" | "reset") {
    setPending(true);
    setError(null);
    setNotice(null);

    const supabase = createSupabaseBrowserClient();
    const { error: authError } =
      purpose === "signup"
        ? await supabase.auth.resend({
            type: "signup",
            email: targetEmail,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
            },
          })
        : await supabase.auth.resetPasswordForEmail(targetEmail, {
            redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`,
          });

    setPending(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setNotice(purpose === "signup" ? "Confirmation email sent." : "Reset email sent.");
    setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
  }

  async function signInWithGoogle() {
    setPending(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });

    // On success the browser is already being redirected to Google; only a
    // failure to even start that redirect (e.g. provider not configured)
    // leaves us here to report it.
    if (authError) {
      setPending(false);
      setError(authError.message);
    }
  }

  if (screen.kind === "check-email") {
    return (
      <CheckEmailScreen
        email={screen.email}
        purpose={screen.purpose}
        pending={pending}
        error={error}
        notice={notice}
        resendCooldown={resendCooldown}
        onResend={() => resend(screen.email, screen.purpose)}
        onBack={() => {
          setScreen({ kind: "form" });
          setError(null);
          setNotice(null);
        }}
      />
    );
  }

  if (screen.kind === "forgot-password") {
    return (
      <div className="grid h-full min-h-screen place-items-center p-6">
        <Card className="w-full max-w-100">
          <div className="kicker">Ced OS</div>
          <h1 className="m-0 mt-2 font-serif text-[27px] font-normal tracking-[-0.012em]">
            Reset your password
          </h1>
          <p className="m-0 mt-2 font-mono text-[11.5px] text-muted">
            We&rsquo;ll email a link to set a new password.
          </p>

          <form onSubmit={submitForgotPassword} className="mt-5 flex flex-col gap-3.5">
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

            {error && (
              <p className="m-0 font-mono text-[11.5px] text-accent-red">{error}</p>
            )}

            <Button type="submit" disabled={pending} className="mt-1 justify-center">
              {pending ? "…" : "send reset link"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="self-start"
              onClick={() => {
                setScreen({ kind: "form" });
                setError(null);
              }}
            >
              back to sign in
            </Button>
          </form>
        </Card>
      </div>
    );
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
          onChange={(value) => {
            setMode(value);
            setError(null);
            setNotice(null);
          }}
          options={[
            { label: "Sign in", value: "sign-in" },
            { label: "Sign up", value: "sign-up" },
          ]}
        />

        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={signInWithGoogle}
          className="mt-5 w-full justify-center gap-2"
        >
          <GoogleGlyph />
          continue with google
        </Button>

        <div className="my-4 flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-border" />
          <span className="kicker">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3.5">
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
                onClick={() => {
                  setScreen({ kind: "forgot-password" });
                  setError(null);
                  setNotice(null);
                }}
                className="self-start font-mono text-[11px] text-muted underline decoration-dotted"
              >
                Forgot password?
              </button>
            )}
          </label>

          {error && (
            <div className="flex flex-col items-start gap-1.5">
              <p className="m-0 font-mono text-[11.5px] text-accent-red">{error}</p>
              {params.get("error") === "confirmation_failed" && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending || !email || resendCooldown > 0}
                  onClick={() => resend(email, "signup")}
                >
                  {resendCooldown > 0
                    ? `resend confirmation email (${resendCooldown}s)`
                    : "resend confirmation email"}
                </Button>
              )}
            </div>
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

function CheckEmailScreen({
  email,
  purpose,
  pending,
  error,
  notice,
  resendCooldown,
  onResend,
  onBack,
}: {
  email: string;
  purpose: "signup" | "reset";
  pending: boolean;
  error: string | null;
  notice: string | null;
  resendCooldown: number;
  onResend: () => void;
  onBack: () => void;
}) {
  return (
    <div className="grid h-full min-h-screen place-items-center p-6">
      <Card className="w-full max-w-100">
        <div className="kicker">Ced OS</div>
        <h1 className="m-0 mt-2 font-serif text-[27px] font-normal tracking-[-0.012em]">
          Check your email
        </h1>
        <p className="m-0 mt-3 font-mono text-[11.5px] leading-relaxed text-muted">
          {purpose === "signup" ? (
            <>
              We sent a confirmation link to{" "}
              <span className="text-text">{email}</span>. Click it to finish
              creating your account.
            </>
          ) : (
            <>
              We sent a password reset link to{" "}
              <span className="text-text">{email}</span>. Click it to set a
              new password.
            </>
          )}
        </p>

        {error && (
          <p className="m-0 mt-3 font-mono text-[11.5px] text-accent-red">{error}</p>
        )}
        {notice && (
          <p className="m-0 mt-3 font-mono text-[11.5px] text-muted">{notice}</p>
        )}

        <div className="mt-5 flex flex-col gap-2.5">
          <Button
            type="button"
            variant="outline"
            disabled={pending || resendCooldown > 0}
            onClick={onResend}
            className="justify-center"
          >
            {resendCooldown > 0 ? `resend in ${resendCooldown}s` : "resend email"}
          </Button>
          <Button type="button" variant="ghost" className="self-start" onClick={onBack}>
            use a different email
          </Button>
        </div>
      </Card>
    </div>
  );
}
