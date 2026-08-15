import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Newsreader } from "next/font/google";

import { getSession } from "@/core/auth/session";
import { QueryProvider } from "@/core/mutation/query-provider";
import { AppearanceScript } from "@/core/theme/appearance-script";
import { DEFAULT_APPEARANCE, isAccent, isDensity, isTheme } from "@/core/theme/types";

import "@/styles/globals.css";

/**
 * Two fonts only, no third (design-reference/readme.md): Newsreader for
 * headings and reflective moments, IBM Plex Mono for everything else.
 * Self-hosted rather than pulled from Google's CDN at runtime, which removes
 * both the external request and the flash of fallback type.
 */
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ced OS",
  description: "One place to plan, capture, track and secure the threads of a life.",
};

/*
 * The one place a colour literal is unavoidable: browser chrome reads this
 * meta tag before any stylesheet exists, so it cannot reference a CSS
 * variable. These two values must stay in step with --bg in
 * src/styles/tokens.css for the paper and dark themes respectively.
 */
export const viewport: Viewport = {
  themeColor: [
    // eslint-disable-next-line no-restricted-syntax -- mirrors --bg (paper)
    { media: "(prefers-color-scheme: light)", color: "#f0eade" },
    // eslint-disable-next-line no-restricted-syntax -- mirrors --bg (dark)
    { media: "(prefers-color-scheme: dark)", color: "#232220" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Rendering the appearance server-side from UserSettings means the first
  // paint is already correct — there is no flash to correct afterwards.
  //
  // For an unauthenticated visitor there is no UserSettings row, so the
  // attributes are left unset here rather than stamped with
  // DEFAULT_APPEARANCE: AppearanceScript below only fills in from
  // localStorage when the attribute is still empty, and an eagerly-set
  // default would block that guard from ever running.
  const session = await getSession();
  const appearance = session
    ? {
        theme: isTheme(session.theme) ? session.theme : DEFAULT_APPEARANCE.theme,
        accent: isAccent(session.accent) ? session.accent : DEFAULT_APPEARANCE.accent,
        density: isDensity(session.density)
          ? session.density
          : DEFAULT_APPEARANCE.density,
      }
    : null;

  return (
    <html
      lang="en"
      data-theme={appearance?.theme}
      data-accent={appearance?.accent}
      data-density={appearance?.density}
      className={`${newsreader.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <AppearanceScript />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
