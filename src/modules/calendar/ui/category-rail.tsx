"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AppError, userMessage } from "@/core/errors";
import { newId } from "@/core/ids";
import { api } from "@/core/mutation/client";
import { Button } from "@/core/ui/button";
import { cn } from "@/core/ui/cn";
import { ImpactPreviewDialog } from "@/core/ui/impact-preview-dialog";
import { Input } from "@/core/ui/input";
import { Modal, ModalActions } from "@/core/ui/modal";
import { formatListDate } from "@/core/date";
import {
  CATEGORY_COLORS,
  type CategoryColor,
  type CategoryImpact,
  type CategoryView,
} from "../schema";

/**
 * The "CALENDARS" rail: the legend, the on/off filters, and category CRUD.
 *
 * Product spec §4: no categories exist by default — the user creates every
 * one. That is why the empty state here is a prompt rather than a list.
 */
export function CategoryRail({
  categories,
  hidden,
  onToggle,
}: {
  categories: CategoryView[];
  hidden: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [editing, setEditing] = useState<CategoryView | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="w-49 flex-none border-r border-border px-5 py-5.5">
      <div className="kicker mb-3.5">Calendars</div>

      {categories.length === 0 ? (
        <p className="m-0 mb-3 font-serif text-[14px] italic leading-snug text-muted">
          no calendars yet
        </p>
      ) : (
        categories.map((category) => {
          const on = !hidden.has(category.id);
          return (
            <div key={category.id} className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => onToggle(category.id)}
                aria-pressed={on}
                className="flex w-full items-center gap-2.5 py-1.5 text-left font-mono text-[12px]"
              >
                <span
                  aria-hidden
                  className={cn("size-2 flex-none rounded-full", !on && "opacity-25")}
                  style={{ background: `var(--accent-${category.color})` }}
                />
                <span className={cn("min-w-0 truncate", on ? "text-text" : "text-muted")}>
                  {category.name}
                </span>
                <span className="ml-auto flex-none font-mono text-[10.5px] text-muted">
                  {category.eventCount}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Edit ${category.name}`}
                onClick={() => setEditing(category)}
                className="flex-none px-1 font-mono text-[11px] text-muted"
              >
                ⋯
              </button>
            </div>
          );
        })
      )}

      <Button variant="dashed" className="mt-3 w-full" onClick={() => setCreating(true)}>
        + new calendar
      </Button>

      {(creating || editing) && (
        <CategoryModal
          category={editing}
          categories={categories}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function CategoryModal({
  category,
  categories,
  onClose,
}: {
  category: CategoryView | null;
  categories: CategoryView[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(category?.name ?? "");
  const [color, setColor] = useState<CategoryColor>(category?.color ?? "blue");
  const [error, setError] = useState<string | null>(null);
  const [impact, setImpact] = useState<CategoryImpact | null>(null);

  const done = () => {
    void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    onClose();
  };

  const save = useMutation({
    mutationFn: () =>
      category
        ? api.patch("/api/calendar/categories", { id: category.id, name, color })
        : api.post("/api/calendar/categories", { id: newId(), name, color }),
    onSuccess: done,
    onError: (e) => setError(userMessage(e, "That didn't save.")),
  });

  /*
   * A1: try the delete, and when the database's Restrict would bite, open the
   * impact preview instead of surfacing an error. The refusal is what makes
   * the flow necessary; the dialog is what makes it useful.
   */
  const attemptDelete = useMutation({
    mutationFn: () =>
      api.delete("/api/calendar/categories", { id: category!.id, mode: "check" }),
    onSuccess: done,
    onError: async (e) => {
      if (e instanceof AppError && e.code === "REFERENCED") {
        setImpact(
          await api.get<CategoryImpact>(
            `/api/calendar/categories?impactFor=${category!.id}`,
          ),
        );
        return;
      }
      setError("That calendar could not be deleted.");
    },
  });

  const resolveDelete = useMutation({
    mutationFn: (vars: { mode: "reassign" | "cascade"; targetCategoryId?: string }) =>
      api.delete("/api/calendar/categories", { id: category!.id, ...vars }),
    onSuccess: done,
  });

  if (impact && category) {
    return (
      <ImpactPreviewDialog
        open
        onOpenChange={(open) => !open && setImpact(null)}
        title={`Delete "${impact.categoryName}"?`}
        noun="events"
        records={impact.events.map((event) => ({
          id: event.id,
          label: event.title,
          meta: `${formatListDate(event.eventDate)}${event.startTime ? ` · ${event.startTime}` : ""}`,
        }))}
        reassignTargets={categories
          .filter((c) => c.id !== category.id)
          .map((c) => ({ id: c.id, label: c.name }))}
        reassignLabel="Move all to"
        pending={resolveDelete.isPending}
        onReassign={(targetCategoryId) =>
          resolveDelete.mutate({ mode: "reassign", targetCategoryId })
        }
        onDeleteAll={() => resolveDelete.mutate({ mode: "cascade" })}
      />
    );
  }

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      kicker={category ? "EDIT CALENDAR" : "NEW CALENDAR"}
      title={category ? "Edit calendar" : "New calendar"}
      width={400}
    >
      <div className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="kicker">Name</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="School, Personal, Travel…"
            autoFocus
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="kicker">Color</span>
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORY_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={option}
                aria-pressed={color === option}
                onClick={() => setColor(option)}
                className={cn(
                  "size-6 rounded-full border-2",
                  color === option ? "border-text" : "border-transparent",
                )}
                style={{ background: `var(--accent-${option})` }}
              />
            ))}
          </div>
        </div>

        {error && <p className="m-0 font-mono text-[11.5px] text-accent-red">{error}</p>}
      </div>

      <ModalActions
        destructive={
          category ? (
            <Button variant="outline" onClick={() => attemptDelete.mutate()}>
              delete
            </Button>
          ) : null
        }
      >
        <Button variant="outline" onClick={onClose}>
          cancel
        </Button>
        <Button onClick={() => save.mutate()} disabled={!name.trim() || save.isPending}>
          save
        </Button>
      </ModalActions>
    </Modal>
  );
}
