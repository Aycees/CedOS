/**
 * The navigation map from product spec §2.
 *
 * Grouped by intent, not by app type — and §14 says the platform grows by
 * adding an app to an existing group. Adding app #12 is one entry here plus
 * one folder under src/modules.
 *
 * `built: false` renders the entry with a calm "not built yet" page rather
 * than a 404, so the shape of the finished platform stays visible while
 * phases 3–10 land.
 */

export type NavItem = {
  label: string;
  href: string;
  /** Which count, if any, the sidebar badge shows. */
  badge?: "todayEvents" | "openTasks" | "habitsDue";
  built: boolean;
};

export type NavGroup = {
  /** null for Home, which sits above the first group heading. */
  label: string | null;
  items: NavItem[];
};

export const NAV: NavGroup[] = [
  {
    label: null,
    items: [{ label: "Home", href: "/", badge: "todayEvents", built: false }],
  },
  {
    label: "Plan",
    items: [
      { label: "Calendar", href: "/calendar", built: false },
      { label: "Tasks", href: "/tasks", badge: "openTasks", built: true },
    ],
  },
  {
    label: "Capture",
    items: [
      { label: "Notes", href: "/notes", built: false },
      { label: "Journal", href: "/journal", built: true },
    ],
  },
  {
    label: "Track",
    items: [
      { label: "Habits", href: "/habits", badge: "habitsDue", built: false },
      { label: "Finance", href: "/finance", built: false },
      { label: "Itinerary", href: "/itinerary", built: false },
    ],
  },
  {
    label: "Secure",
    items: [{ label: "Vault", href: "/vault", built: true }],
  },
];

export type NavBadges = Partial<Record<NonNullable<NavItem["badge"]>, number>>;
