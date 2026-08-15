"use client";

import { useState } from "react";

import { Sidebar, type SidebarProps } from "./sidebar";

/**
 * The authenticated shell: dotted canvas, left rail, scrolling main column.
 *
 * Below `md` the Sidebar becomes an off-canvas drawer (no fixed-width rail
 * to give up on a phone screen) opened via a hamburger bar; this component
 * owns that open/close state since the App Router layout is a server
 * component and can't.
 */
export function AppShell({
  sidebarProps,
  children,
}: {
  sidebarProps: SidebarProps;
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="relative flex h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: "radial-gradient(var(--dot) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      {navOpen && (
        <div
          aria-hidden
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-overlay lg:hidden"
        />
      )}

      <Sidebar {...sidebarProps} open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 lg:hidden">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setNavOpen(true)}
            className="grid size-7 place-items-center rounded-[7px] border border-border text-muted"
          >
            <MenuGlyph />
          </button>
          <div className="font-mono text-[13px] font-medium tracking-[0.02em]">Ced OS</div>
        </div>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}

function MenuGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}
