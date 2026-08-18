import Link from "next/link";

/**
 * A mistyped URL previously got Next's default 404, which shares nothing with
 * the rest of the app. Deliberately plain — this page has no session and no
 * shell around it.
 */
export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center p-8">
      <div className="flex max-w-105 flex-col items-start gap-4">
        <span className="kicker">404</span>
        <p className="m-0 font-serif text-[16.5px] italic leading-[1.65] text-muted">
          nothing lives at this address.
        </p>
        <Link
          href="/"
          className="font-mono text-[11.5px] text-muted underline decoration-dotted"
        >
          back to today
        </Link>
      </div>
    </div>
  );
}
