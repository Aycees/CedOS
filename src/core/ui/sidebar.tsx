"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { NAV, type NavBadges } from "@/core/nav/config";
import { useAppearance } from "@/core/theme/appearance-provider";

import { cn } from "./cn";

/**
 * The left rail. Groups are individually collapsible (product spec §2), and
 * Settings is pinned separately at the bottom, always visible.
 */
export function Sidebar({
  name,
  dateLabel,
  badges,
}: {
  name: string;
  dateLabel: string;
  badges: NavBadges;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { theme, setAppearance } = useAppearance();

  return (
    <aside className="flex w-[216px] flex-none flex-col border-r border-border bg-sidebar">
      <div className="flex items-center gap-2.5 px-5 pb-1 pt-5">
        <div className="font-mono text-[13px] font-medium tracking-[0.02em]">Ced OS</div>
        <button
          type="button"
          title="Toggle day/night"
          aria-label={theme === "dark" ? "Switch to paper theme" : "Switch to dark theme"}
          onClick={() => setAppearance({ theme: theme === "dark" ? "paper" : "dark" })}
          className="ml-auto grid size-[26px] place-items-center rounded-[7px] border border-border text-muted"
        >
          {theme === "dark" ? <MoonGlyph /> : <SunGlyph />}
        </button>
      </div>

      <nav className="flex flex-col gap-0.5 overflow-y-auto px-3 py-3.5">
        {NAV.map((group) => {
          const isCollapsed = group.label ? collapsed[group.label] : false;
          return (
            <div key={group.label ?? "home"} className="flex flex-col gap-0.5">
              {group.label && (
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [group.label!]: !c[group.label!] }))
                  }
                  aria-expanded={!isCollapsed}
                  className="mt-3 flex items-center px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted"
                >
                  {group.label}
                  <span aria-hidden className="ml-auto text-[11px]">
                    {isCollapsed ? "›" : "⌄"}
                  </span>
                </button>
              )}

              {!isCollapsed &&
                group.items.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  const count = item.badge ? badges[item.badge] : undefined;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 font-mono text-[12.5px]",
                        active
                          ? "bg-[color-mix(in_srgb,var(--text)_6%,transparent)] text-text"
                          : "text-muted",
                      )}
                    >
                      {item.label}
                      {count ? (
                        <span className="ml-auto font-mono text-[11px] text-muted">
                          {count}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 px-3 pb-4 pt-3.5">
        <Link
          href="/settings"
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 font-mono text-[12.5px]",
            pathname.startsWith("/settings")
              ? "bg-[color-mix(in_srgb,var(--text)_6%,transparent)] text-text"
              : "text-muted",
          )}
        >
          <span aria-hidden>⚙</span> Settings
        </Link>

        <Link
          href="/profile"
          className="mt-1 flex items-center gap-2.5 border-t border-dashed border-border px-3 pt-3.5"
        >
          <span
            aria-hidden
            className="grid size-7 flex-none place-items-center rounded-full bg-accent font-mono text-[12px] text-on-dark"
          >
            {(name.trim()[0] ?? "?").toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-mono text-[12.5px] text-text">
              {name.trim() || "Unnamed"}
            </span>
            <span className="block font-mono text-[10px] tracking-[0.1em] text-muted">
              {dateLabel}
            </span>
          </span>
        </Link>
      </div>
    </aside>
  );
}

/* The system has no icon font and no emoji — a handful of hand-set 24×24
   stroke-line SVGs, stroke-width 2, round caps, currentColor. */

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
