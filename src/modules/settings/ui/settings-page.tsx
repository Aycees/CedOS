"use client";

import Link from "next/link";

import { api } from "@/core/mutation/client";
import { useAppearance } from "@/core/theme/appearance-provider";
import { ACCENTS, type Accent } from "@/core/theme/types";
import { Card } from "@/core/ui/card";
import { cn } from "@/core/ui/cn";
import { Segmented } from "@/core/ui/segmented";
import { VaultExportPanel } from "@/modules/vault/ui/export-panel";

/**
 * Settings holds no data of its own (product spec §12) — it is a view onto
 * UserSettings. Every control here writes straight to the appearance
 * provider, which mutates <html>, so the change lands on every surface
 * instantly, including any modal that happens to be open.
 */
export function SettingsPage({
  name,
  email,
  weekStartsOn: initialWeekStart,
}: {
  name: string;
  email: string;
  weekStartsOn: number;
}) {
  const { theme, accent, density, setAppearance } = useAppearance();

  return (
    <div className="flex max-w-160 flex-col gap-4.5 p-8">
      <Card>
        <h2 className="m-0 font-serif text-[18px] font-normal">Appearance</h2>

        <Row label="Theme">
          <Segmented
            aria-label="Theme"
            value={theme}
            onChange={(value) => setAppearance({ theme: value })}
            options={[
              { label: "Paper", value: "paper" },
              { label: "Dark", value: "dark" },
            ]}
          />
        </Row>

        <Row label="Accent color">
          <div className="flex items-center gap-2">
            {ACCENTS.map((option) => (
              <AccentSwatch
                key={option}
                accent={option}
                selected={accent === option}
                onSelect={() => setAppearance({ accent: option })}
              />
            ))}
          </div>
        </Row>

        <Row label="Density">
          <Segmented
            aria-label="Density"
            value={density}
            onChange={(value) => setAppearance({ density: value })}
            options={[
              { label: "Comfortable", value: "comfortable" },
              { label: "Compact", value: "compact" },
            ]}
          />
        </Row>
      </Card>

      <Card>
        <h2 className="m-0 font-serif text-[18px] font-normal">Week</h2>
        <Row label="Week starts on">
          {/*
            Added by decision A5: an N-times-per-week habit cannot compute its
            weekly window without knowing where the week begins.
          */}
          <Segmented
            aria-label="Week starts on"
            value={initialWeekStart === 7 ? "sunday" : "monday"}
            onChange={(value) => {
              void api.patch("/api/settings/preferences", {
                weekStartsOn: value === "sunday" ? 7 : 1,
              });
            }}
            options={[
              { label: "Monday", value: "monday" },
              { label: "Sunday", value: "sunday" },
            ]}
          />
        </Row>
      </Card>

      <Card>
        <h2 className="m-0 font-serif text-[18px] font-normal">Data export</h2>
        <p className="m-0 mt-1.5 font-mono text-[11.5px] leading-relaxed text-muted">
          A single file with every module. Vault credentials are included as
          ciphertext by default — decrypting them for export is a separate,
          explicit step.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <a
            href="/api/export"
            download={`ced-os-export-${new Date().toISOString().slice(0, 10)}.json`}
            className="inline-flex items-center gap-1.5 rounded-control border border-border px-4 py-2.5 font-mono text-[12px] text-text"
          >
            export all data
          </a>
          <VaultExportPanel />
        </div>
      </Card>

      <Card>
        <h2 className="m-0 font-serif text-[18px] font-normal">Account</h2>
        <Link
          href="/profile"
          className="row-divider mt-2.5 flex items-center gap-3 pt-3.5"
        >
          <span
            aria-hidden
            className="grid size-9 flex-none place-items-center rounded-full bg-accent font-mono text-[14px] text-on-dark"
          >
            {(name.trim()[0] ?? "?").toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block font-mono text-[13px]">{name || "Unnamed"}</span>
            <span className="block font-mono text-[11px] text-muted">{email}</span>
          </span>
          <span aria-hidden className="ml-auto text-muted">
            ›
          </span>
        </Link>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="row-divider list-row mt-2.5 flex items-center gap-4">
      <span className="font-mono text-[12.5px]">{label}</span>
      <div className="ml-auto">{children}</div>
    </div>
  );
}

function AccentSwatch({
  accent,
  selected,
  onSelect,
}: {
  accent: Accent;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={accent}
      aria-pressed={selected}
      className={cn(
        "size-6 rounded-full border-2",
        selected ? "border-text" : "border-transparent",
      )}
      // Reads the token, never a literal — the swatch and the applied accent
      // are guaranteed to be the same colour because they are the same value.
      style={{ background: `var(--accent-${accent})` }}
    />
  );
}
