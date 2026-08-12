import type { MetadataRoute } from "next";

/*
 * The manifest spec has no notion of a CSS variable — a PWA's home-screen
 * icon and splash background render before any stylesheet exists. Same
 * constraint and same resolution as the `viewport.themeColor` literals in
 * src/app/layout.tsx: this value must stay in step with --bg (paper) in
 * design-reference/tokens/colors.css.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ced OS",
    short_name: "Ced OS",
    description:
      "A single-user life-management platform — calendar, tasks, notes, journal, habits, finance, itinerary and vault.",
    start_url: "/",
    display: "standalone",
    // eslint-disable-next-line no-restricted-syntax -- mirrors --bg (paper)
    background_color: "#f0eade",
    // eslint-disable-next-line no-restricted-syntax -- mirrors --bg (paper)
    theme_color: "#f0eade",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
