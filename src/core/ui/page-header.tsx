import { cn } from "./cn";

/**
 * The header pattern every app shares (product spec §13): an uppercase
 * letter-spaced mono kicker over a Newsreader serif title on the left, and
 * the primary "+ new X" action on the right.
 *
 * Every new app gets this same shape — it is what makes §14's "adding an app"
 * a matter of composition rather than design.
 */
export function PageHeader({
  kicker,
  title,
  actions,
  className,
}: {
  kicker: string;
  title: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-border px-4 pb-4 pt-5.5 sm:px-6 lg:px-8",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="kicker">{kicker}</div>
        <h1 className="m-0 mt-2 font-serif text-[27px] font-normal tracking-[-0.012em]">
          {title}
        </h1>
      </div>
      {actions ? (
        <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/**
 * The calm empty state product spec §13 requires everywhere: one quiet line
 * plus a dashed "+" prompt. Never an illustration, never lorem, never a blank
 * screen that reads as broken.
 */
export function EmptyState({
  line,
  action,
}: {
  line: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 py-6">
      <p className="m-0 font-serif text-[16.5px] italic text-muted">{line}</p>
      {action}
    </div>
  );
}
