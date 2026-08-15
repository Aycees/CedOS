import { PageHeader } from "./page-header";

/**
 * Nav entries for modules that land in later phases render this rather than
 * a 404, so the shape of the finished platform stays legible while phases
 * 3–10 are built (system design §8.1).
 *
 * Delete each call site as its module ships.
 */
export function NotBuiltYet({
  kicker,
  title,
  phase,
}: {
  kicker: string;
  title: string;
  phase: string;
}) {
  return (
    <>
      <PageHeader kicker={kicker} title={title} />
      <div className="flex-1 overflow-auto p-8">
        <p className="m-0 max-w-105 font-serif text-[16.5px] italic leading-[1.65] text-muted">
          not built yet — {title.toLowerCase()} lands in {phase}.
        </p>
      </div>
    </>
  );
}
