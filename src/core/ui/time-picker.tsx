"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "./cn";

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES_5 = Array.from({ length: 12 }, (_, i) => i * 5);
const MERIDIEMS = ["AM", "PM"] as const;
type Meridiem = (typeof MERIDIEMS)[number];

const PANEL_WIDTH = 176;

function parse(value: string) {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  return { h12: h % 12 === 0 ? 12 : h % 12, m, ampm: (h >= 12 ? "PM" : "AM") as Meridiem };
}

function toValue(h12: number, m: number, ampm: Meridiem) {
  const h24 = ampm === "AM" ? (h12 === 12 ? 0 : h12) : h12 === 12 ? 12 : h12 + 12;
  return `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Three-column hour/minute/meridiem popover, ported from the mockup's
 * draftTime* pattern (design-reference/Ced OS.dc.html ~1186-1212). Replaces a
 * native `<select>` because the mockup's picker has no HTML equivalent.
 *
 * The panel is portaled to `document.body` rather than positioned relative to
 * its trigger: Modal centers itself with a `translate` transform, which
 * creates a containing block for `position: fixed` descendants too, so an
 * in-place popover would be clipped by the modal's own `overflow-y-auto`.
 */
export function TimePicker({
  value,
  onChange,
  placeholder = "set time",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const parsed = parse(value);
  const label = parsed
    ? `${parsed.h12}:${String(parsed.m).padStart(2, "0")} ${parsed.ampm}`
    : placeholder;

  const toggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.right - PANEL_WIDTH });
    }
    setOpen((o) => !o);
  };

  const pick = (h12: number, m: number, ampm: Meridiem) => onChange(toValue(h12, m, ampm));

  const optionClass = (selected: boolean) =>
    cn(
      "flex-none rounded-md px-1 py-1.5 text-center font-mono text-[12px]",
      selected ? "bg-accent/10 text-accent" : "text-text",
    );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className={cn(
          "flex w-full items-center justify-between rounded-input border border-border bg-text/5 px-2.75 py-2 font-mono text-[12.5px]",
          parsed ? "text-text" : "text-muted",
        )}
      >
        <span>{label}</span>
        <span className={cn("text-[10px] text-muted", open && "rotate-180")}>▾</span>
      </button>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              style={{ top: pos.top, left: pos.left, width: PANEL_WIDTH }}
              className="fixed z-50 flex max-h-47.5 overflow-hidden rounded-modal border border-border bg-card shadow-dialog"
            >
              <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto border-r border-border p-1">
                {HOURS_12.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => pick(h, parsed?.m ?? 0, parsed?.ampm ?? "AM")}
                    className={optionClass(parsed?.h12 === h)}
                  >
                    {h}
                  </button>
                ))}
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto border-r border-border p-1">
                {MINUTES_5.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => pick(parsed?.h12 ?? 9, m, parsed?.ampm ?? "AM")}
                    className={optionClass(parsed?.m === m)}
                  >
                    {String(m).padStart(2, "0")}
                  </button>
                ))}
              </div>
              <div className="flex min-h-0 w-13 flex-none flex-col gap-0.5 overflow-y-auto p-1">
                {MERIDIEMS.map((ap) => (
                  <button
                    key={ap}
                    type="button"
                    onClick={() => pick(parsed?.h12 ?? 9, parsed?.m ?? 0, ap)}
                    className={optionClass(parsed?.ampm === ap)}
                  >
                    {ap}
                  </button>
                ))}
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
