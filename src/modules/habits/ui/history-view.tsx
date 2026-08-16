"use client";

import { useQuery } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { useState } from "react";

import { api } from "@/core/mutation/client";
import { Card } from "@/core/ui/card";
import { EmptyState } from "@/core/ui/page-header";
import { Segmented } from "@/core/ui/segmented";

import { addDays, weekBounds } from "../engine/cadence";
import type { HabitHistoryView } from "../schema";

const WEEKS = 26;
/** GitHub-contribution-style discrete shading, not a continuous gradient (design-reference/Ced OS.dc.html `shade()`). */
const ALPHA_STEPS = [15, 30, 50, 70, 100];
const EMPTY_CELL = "color-mix(in srgb, var(--text) 6%, transparent)";

function shade(color: string, ratio: number): string {
  if (ratio <= 0) return EMPTY_CELL;
  const bucket = Math.min(4, Math.floor(ratio * 4.999));
  return `color-mix(in srgb, ${color} ${ALPHA_STEPS[bucket]}%, transparent)`;
}

/** Share of due, non-skipped habits in scope that were complete on a date, or null if none were due. */
function dayRatio(scope: HabitHistoryView[], date: string): number | null {
  let due = 0;
  let got = 0;
  for (const row of scope) {
    const cell = row.cells.find((entry) => entry.date === date);
    if (!cell || !cell.due || cell.status === "SKIPPED") continue;
    due += 1;
    got += cell.progress;
  }
  return due ? got / due : null;
}

export function HistoryView({ today }: { today: string }) {
  const [chart, setChart] = useState<"grid" | "line">("grid");
  const [filter, setFilter] = useState<string>("all");

  const { data: rows = [] } = useQuery({
    queryKey: ["habits", "history", today],
    queryFn: () =>
      api.get<HabitHistoryView[]>(`/api/habits?view=history&today=${today}`),
  });

  if (rows.length === 0) {
    return <EmptyState line="no history yet" />;
  }

  const scope = filter === "all" ? rows : rows.filter((row) => row.id === filter);
  const scopeColor =
    filter === "all" ? "var(--accent-default)" : `var(--accent-${scope[0]?.color ?? "blue"})`;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 font-serif text-[19px] font-normal">History</h2>
        <Segmented
          className="ml-auto"
          aria-label="History chart"
          value={chart}
          onChange={setChart}
          options={[
            { label: "squares", value: "grid" },
            { label: "line", value: "line" },
          ]}
        />
      </div>

      <div className="mt-4 mb-4.5 flex flex-wrap gap-1.75">
        <FilterChip
          selected={filter === "all"}
          color="var(--accent-default)"
          label="All habits"
          onClick={() => setFilter("all")}
        />
        {rows.map((row) => (
          <FilterChip
            key={row.id}
            selected={filter === row.id}
            color={`var(--accent-${row.color})`}
            label={row.name}
            onClick={() => setFilter(row.id)}
          />
        ))}
      </div>

      {chart === "grid" ? (
        <SquaresGrid scope={scope} scopeColor={scopeColor} today={today} />
      ) : (
        <LineChart scope={scope} scopeColor={scopeColor} today={today} />
      )}
    </Card>
  );
}

function FilterChip({
  selected,
  color,
  label,
  onClick,
}: {
  selected: boolean;
  color: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.75 rounded-pill px-2.75 py-1.25 font-mono text-[11px] text-text whitespace-nowrap"
      style={{
        border: `1px solid ${selected ? color : "var(--border)"}`,
        background: selected ? `color-mix(in srgb, ${color} 10%, transparent)` : "transparent",
      }}
    >
      <span aria-hidden className="size-1.75 flex-none rounded-full" style={{ background: color }} />
      {label}
    </button>
  );
}

const DAY_LABEL_ROWS = [1, 3, 5]; // Mon, Wed, Fri in a Sunday-first week
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function SquaresGrid({
  scope,
  scopeColor,
  today,
}: {
  scope: HabitHistoryView[];
  scopeColor: string;
  today: string;
}) {
  const { start: weekStart } = weekBounds(today, 7);
  const gridStart = addDays(weekStart, -(WEEKS - 1) * 7);

  const weeks = Array.from({ length: WEEKS }, (_, w) => {
    const days = Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d));
    const first = DateTime.fromFormat(days[0], "yyyy-MM-dd", { zone: "utc" });
    const monthTag = first.day <= 7 ? first.toFormat("LLL") : "";
    return { days, monthTag };
  });

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-100 gap-2">
          <div className="flex flex-none flex-col gap-0.75">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="h-2.75 w-5.5 font-mono text-[9px] text-muted">
                {DAY_LABEL_ROWS.includes(i) ? DOW[i] : ""}
              </div>
            ))}
          </div>
          <div className="flex gap-0.75">
            {weeks.map((week, w) => (
              <div key={w} className="flex flex-col gap-0.75">
                {week.days.map((date) => {
                  const future = date > today;
                  const ratio = future ? null : dayRatio(scope, date);
                  const isToday = date === today;
                  return (
                    <div
                      key={date}
                      title={`${date}${ratio === null ? "" : ` · ${Math.round(ratio * 100)}%`}`}
                      className="size-2.75 rounded-xs"
                      style={{
                        background: future ? "transparent" : ratio === null ? EMPTY_CELL : shade(scopeColor, ratio),
                        boxShadow: isToday ? "inset 0 0 0 1.5px var(--text)" : "none",
                      }}
                    />
                  );
                })}
                <div className="w-2.75 whitespace-nowrap font-mono text-[9px] tracking-[0.06em] text-muted">
                  {week.monthTag}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.75">
        <span className="font-mono text-[10.5px] text-muted">less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((step) => (
          <span
            key={step}
            className="size-2.75 rounded-xs"
            style={{ background: shade(scopeColor, step) }}
          />
        ))}
        <span className="font-mono text-[10.5px] text-muted">more</span>
        <span className="ml-auto font-mono text-[10.5px] text-muted">{WEEKS} weeks</span>
      </div>
    </div>
  );
}

function LineChart({
  scope,
  scopeColor,
  today,
}: {
  scope: HabitHistoryView[];
  scopeColor: string;
  today: string;
}) {
  const width = 640;
  const height = 132;

  const points = Array.from({ length: 84 }, (_, i) => {
    const offset = 83 - i;
    const date = addDays(today, -offset);
    let sum = 0;
    let count = 0;
    for (let k = 0; k < 7; k++) {
      const ratio = dayRatio(scope, addDays(date, -k));
      if (ratio !== null) {
        sum += ratio;
        count += 1;
      }
    }
    return count ? sum / count : 0;
  });

  const px = (i: number) => (i / (points.length - 1)) * width;
  const py = (v: number) => height - 10 - v * (height - 22);
  const linePath = points
    .map((v, i) => `${i ? "L" : "M"}${px(i).toFixed(1)} ${py(v).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${width} ${height} L0 ${height} Z`;

  const now = Math.round(points[points.length - 1] * 100);
  const then = Math.round(points[0] * 100);
  const delta = now - then;

  return (
    <div>
      <div className="flex items-baseline gap-2.5">
        <div className="font-mono text-[30px] tracking-[-0.02em] text-text">{now}%</div>
        <div className="font-mono text-[11px] text-muted">7-day completion</div>
        <div
          className="ml-auto font-mono text-[11px]"
          style={{ color: delta >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}
        >
          {delta >= 0 ? "+" : ""}
          {delta} pts vs 12 wks ago
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="mt-3.5 block h-37.5 w-full overflow-visible"
      >
        <path d={areaPath} fill={`color-mix(in srgb, ${scopeColor} 12%, transparent)`} />
        <path
          d={linePath}
          fill="none"
          stroke={scopeColor}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="mt-1.5 flex justify-between font-mono text-[10.5px] text-muted">
        <span>12 weeks ago</span>
        <span>today</span>
      </div>
    </div>
  );
}
