"use client";

import { useState } from "react";

import { Button } from "./button";
import { Modal, ModalActions } from "./modal";
import { Select, SelectItem } from "./select";

/**
 * The shared "you are about to delete a thing other things point at" dialog.
 *
 * Decision A1 specifies this precisely, and specifies it in `core/` because
 * three separate places need exactly this shape: deleting a Calendar category
 * that owns events, deleting a Finance account with linked transactions
 * (product spec §9), and previewing an Itinerary push (§5.2). Writing it per
 * module is how the three drift apart.
 *
 * The rules, each with a reason:
 *
 *  · **List, don't count.** "42 events will be deleted" gives the user no way
 *    to judge whether those 42 matter. The list IS the confirmation — which
 *    is why no typed confirmation is required.
 *  · **Most recent first.** Recent records are the ones a user recognises;
 *    the long tail of old ones is what they are willing to lose.
 *  · **Truncate at 10**, expandable. The dialog must stay readable when a
 *    category owns hundreds of events.
 *  · **Two exits**, reassign (default, non-destructive) and delete
 *    (destructive, visually secondary).
 */

export type ImpactRecord = {
  id: string;
  /** The line the user reads, e.g. an event title. */
  label: string;
  /** Supporting metadata, e.g. "AUG 12, 2026 · 09:30". */
  meta?: string;
};

export type ReassignTarget = {
  id: string;
  label: string;
};

const VISIBLE_LIMIT = 10;

export function ImpactPreviewDialog({
  open,
  onOpenChange,
  title,
  /** e.g. "events", "transactions" — used in the prose. */
  noun,
  records,
  reassignTargets,
  reassignLabel = "Move all to",
  onReassign,
  onDeleteAll,
  pending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  noun: string;
  /** Already sorted most-recent-first by the caller. */
  records: ImpactRecord[];
  reassignTargets: ReassignTarget[];
  reassignLabel?: string;
  onReassign: (targetId: string) => void;
  onDeleteAll: () => void;
  pending?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [target, setTarget] = useState(reassignTargets[0]?.id ?? "");

  const visible = expanded ? records : records.slice(0, VISIBLE_LIMIT);
  const hidden = records.length - visible.length;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      kicker="Before you delete"
      title={title}
      width={520}
    >
      <p className="m-0 mt-3 font-mono text-[12.5px] leading-relaxed text-muted">
        {records.length} {records.length === 1 ? noun.replace(/s$/, "") : noun}{" "}
        {records.length === 1 ? "points" : "point"} at this.
      </p>

      <div className="mt-4 max-h-70 overflow-y-auto rounded-card border border-border">
        {visible.map((record) => (
          <div
            key={record.id}
            className="row-divider list-row flex items-baseline gap-3 px-3.5 first:border-t-0"
          >
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">
              {record.label}
            </span>
            {record.meta && (
              <span className="flex-none font-mono text-[11px] text-muted">
                {record.meta}
              </span>
            )}
          </div>
        ))}

        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="row-divider w-full px-3.5 py-2.5 text-left font-mono text-[11.5px] text-accent"
          >
            and {hidden} more
          </button>
        )}
      </div>

      {reassignTargets.length > 0 && (
        <label className="mt-4 flex flex-col gap-1.5">
          <span className="kicker">{reassignLabel}</span>
          <Select value={target} onValueChange={setTarget}>
            {reassignTargets.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </Select>
        </label>
      )}

      <ModalActions
        destructive={
          /* Destructive exit, visually secondary — reachable, not inviting. */
          <Button
            variant="outline"
            disabled={pending}
            onClick={onDeleteAll}
            className="text-accent-red"
          >
            delete all {records.length} {noun}
          </Button>
        }
      >
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          cancel
        </Button>
        {reassignTargets.length > 0 && (
          <Button disabled={pending || !target} onClick={() => onReassign(target)}>
            move &amp; delete
          </Button>
        )}
      </ModalActions>
    </Modal>
  );
}
