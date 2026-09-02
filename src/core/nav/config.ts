/**
 * The navigation map from product spec §2.
 *
 * Grouped by intent, not by app type — and §14 says the platform grows by
 * adding an app to an existing group. Adding app #12 is one entry here plus
 * one folder under src/modules.
 */

export type NavItem = {
  label: string;
  href: string;
  /** Which count, if any, the sidebar badge shows. */
  badge?: "todayEvents" | "openTasks" | "habitsDue";
};

export type NavGroup = {
  /** null for Home, which sits above the first group heading. */
  label: string | null;
  items: NavItem[];
};

export const NAV: NavGroup[] = [
  {
    label: null,
    items: [{ label: "Home", href: "/", badge: "todayEvents" }],
  },
  {
    label: "Plan",
    items: [
      { label: "Calendar", href: "/calendar" },
      { label: "Tasks", href: "/tasks", badge: "openTasks" },
    ],
  },
  {
    label: "Capture",
    items: [
      { label: "Notes", href: "/notes" },
      { label: "Journal", href: "/journal" },
    ],
  },
  {
    label: "Track",
    items: [
      { label: "Habits", href: "/habits", badge: "habitsDue" },
      { label: "Finance", href: "/finance" },
      { label: "Itinerary", href: "/itinerary" },
    ],
  },
  {
    label: "Secure",
    items: [{ label: "Vault", href: "/vault" }],
  },
];

export type NavBadges = Partial<Record<NonNullable<NavItem["badge"]>, number>>;
