import type { NextConfig } from "next";

/*
 * Content-Security-Policy, in Report-Only to begin with.
 *
 * The Vault decrypts credentials in the browser (system design §4.4), so the
 * browser is the last line of defence: any XSS — a dependency bug, a future
 * mis-escaped render — could read a decrypted password out of the DOM and
 * POST it anywhere. A CSP with a locked-down `connect-src` is what turns that
 * from "exfiltrated" into "blocked".
 *
 * Why Report-Only rather than enforcing: App Router streams inline hydration
 * scripts, and AppearanceScript (core/theme/appearance-script.tsx) is itself
 * an inline `beforeInteractive` script. Under an enforcing `script-src 'self'`
 * both are blocked and the app does not hydrate at all. Doing this properly
 * means a per-request nonce generated in proxy.ts, which forces every route
 * into dynamic rendering — cheap here, since every page already awaits
 * getSession(), but not a change to make blind. Report-Only collects the real
 * violation set first; promote the header to `Content-Security-Policy` once
 * the reports are clean.
 *
 * `style-src-attr 'unsafe-inline'` is not negotiable in either mode: the
 * design system leans on React inline `style={{…}}` for accent swatches and
 * colour-mix values, and those are style *attributes*.
 */
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  // 'unsafe-inline' is ignored by browsers that honour nonces, so it is a
  // fallback rather than a hole once the nonce lands. 'unsafe-eval' is dev
  // only — React uses eval there to rebuild server error stacks.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace(/^http/, "ws")}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

/** Headers that carry no breakage risk, so these go on enforcing. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy-Report-Only", value: csp },
];

const nextConfig: NextConfig = {
  /*
   * Next's dev server refuses /_next/* requests whose Host is not a known dev
   * origin, answering 403 — which silently prevents hydration rather than
   * failing loudly. Playwright drives the app over 127.0.0.1, so it has to be
   * listed alongside localhost. Development only; ignored in production.
   */
  allowedDevOrigins: ["localhost", "127.0.0.1"],

  /** Framework and version fingerprint, free to an attacker. Nothing needs it. */
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
