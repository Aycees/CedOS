/**
 * One tile in the Habits page's stat row (Done today / Best streak / Last 7
 * days) — a big mono number, a muted unit, and a thin progress bar
 * (design-reference/Ced OS.dc.html, the habit page's `tile()` helper).
 */
export function StatTile({
  label,
  value,
  unit,
  progress,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  /** 0–1. Always renders at least a 2% sliver, matching the mockup. */
  progress: number;
  color: string;
}) {
  return (
    <div className="rounded-card border border-border bg-card px-4.5 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="font-mono text-[26px] tracking-[-0.02em] text-text">{value}</div>
        <div className="font-mono text-[11px] text-muted">{unit}</div>
      </div>
      <div
        className="mt-3.25 h-1.25 overflow-hidden rounded-[3px]"
        style={{ background: "color-mix(in srgb, var(--text) 9%, transparent)" }}
      >
        <div
          className="h-full rounded-[3px]"
          style={{ width: `${Math.max(2, Math.round(progress * 100))}%`, background: color }}
        />
      </div>
    </div>
  );
}
