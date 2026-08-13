"use client";

import * as Dialog from "@radix-ui/react-dialog";

import { cn } from "./cn";

/**
 * The one shadowed surface in the system.
 *
 * Built on Radix Dialog for focus trapping, escape handling, scroll locking
 * and ARIA wiring — then restyled entirely to Ced OS tokens. Radix supplies
 * behaviour; it supplies none of the look (technical decisions §6).
 *
 * Product spec §13: create/edit flows are modals, not full-page navigation,
 * so the list underneath stays visible.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  kicker,
  width = 400,
  titleVisible = true,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Announced to screen readers; pass `titleVisible={false}` and render a visible title of your own in children if the design shows it differently. */
  title: string;
  kicker?: string;
  width?: number;
  titleVisible?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <Dialog.Content
          aria-describedby={undefined}
          aria-label={titleVisible ? undefined : title}
          style={{ width: `min(${width}px, 88vw)` }}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "max-h-[88vh] overflow-y-auto rounded-modal border border-border",
            "bg-card px-6.5 py-6 shadow-dialog",
          )}
        >
          {kicker ? <div className="kicker mb-2.5">{kicker}</div> : null}
          {titleVisible ? (
            <Dialog.Title className="m-0 font-serif text-[24px] font-normal tracking-[-0.015em] text-text">
              {title}
            </Dialog.Title>
          ) : null}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const ModalClose = Dialog.Close;

/** Right-aligned action row; `delete` sits left, per the mockup's stop/event modals. */
export function ModalActions({
  destructive,
  children,
}: {
  destructive?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 flex items-center gap-2.5">
      {destructive}
      <div className="ml-auto flex items-center gap-2.5">{children}</div>
    </div>
  );
}
