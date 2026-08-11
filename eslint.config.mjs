import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * The five non-negotiables in CLAUDE.md are only real if something enforces
 * them. Each block below corresponds to one of them — the risk table calls out
 * that the Vault's client-only rule in particular is "violated by a single
 * careless server import", which is not a thing code review reliably catches.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Prisma client — not ours to lint.
    "src/generated/**",
    "design-reference/**",
  ]),

  {
    // ---- Non-negotiable #1: client-generated UUIDv7 ----
    // ---- Non-negotiable #7: CSS variables only, never a literal colour ----
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.name='crypto'][property.name='randomUUID']",
          message:
            "Ids are UUIDv7 from core/ids.ts newId(). crypto.randomUUID() is v4 — it throws away both the time ordering and the reason we generate ids client-side (technical decisions §1).",
        },
        {
          // Catches "#A8664A" in a style prop or className. Theme, accent and
          // density are three axes multiplying together (§6) — a literal
          // colour is invisible to all three and goes stale in one of them.
          selector: "Literal[value=/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/]",
          message:
            "Never hardcode a colour. Read it from the token layer — a Tailwind utility (bg-card, text-muted) or var(--accent-default). Values live in src/styles/tokens.css only.",
        },
      ],
    },
  },

  {
    // ---- Non-negotiable #6: only service.ts touches Prisma ----
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/core/db/**",
      // core/auth provisions the User/Profile/UserSettings rows on first
      // sign-in — it is part of the core data layer, not a feature module.
      "src/core/auth/**",
      "src/modules/*/service.ts",
      "src/modules/*/service/**",
      "prisma/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/generated/prisma", "@/generated/prisma/*", "@prisma/client"],
              message:
                "Only core/db/* and a module's service.ts may touch Prisma (decision log §7). Import the module's public interface instead. Types-only? Re-export them from the module.",
            },
            {
              group: ["@/core/db/client"],
              message:
                "Build queries through core/db/scope.ts so they carry an explicit userId. Prisma bypasses RLS, so the scope helpers are the actual security boundary (decision log §5).",
            },
          ],
        },
      ],
    },
  },

  {
    // ---- Non-negotiable #3: Vault is a client-only island ----
    //
    // System design §4.4: route handlers for the Vault accept and return
    // ciphertext only, and "a Vault handler that can see a plaintext password
    // is a bug by definition". Nothing under the Vault's UI may reach the
    // server data layer at all.
    files: ["src/modules/vault/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/core/db",
                "@/core/db/*",
                "@/generated/prisma",
                "@/generated/prisma/*",
                "@prisma/client",
                "server-only",
                "next/headers",
                "**/service",
                "**/service.ts",
              ],
              message:
                "The Vault is a client-only island (system design §4.4). No server component, RSC fetch or DB import may exist beneath modules/vault/ui — the decrypted record must never be reachable from the server.",
            },
          ],
        },
      ],
    },
  },

  {
    // ---- Non-negotiable #2: all writes go through core/mutation ----
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/core/mutation/**"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message:
            "No component calls fetch directly. Use core/mutation/client.ts — it is the seam the v2 offline outbox slots into (technical decisions §1).",
        },
      ],
    },
  },

  {
    // Tests and the seed script legitimately reach for Prisma directly.
    files: ["prisma/**/*.ts", "tests/**/*.ts", "**/*.test.ts"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-globals": "off",
    },
  },
]);

export default eslintConfig;
