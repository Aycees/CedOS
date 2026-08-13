"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders a note's stored markdown.
 *
 * react-markdown rather than a markdown-to-HTML library on purpose: it
 * produces React elements, so nothing is ever injected as raw HTML. Every
 * element below is mapped to the token layer, matching the `.md` rules in the
 * source mockup.
 *
 * The supported set is deliberately the one product spec §6 names — headings,
 * bold/italic, checklists, blockquotes, inline code, horizontal rules. GFM is
 * enabled for the task-list syntax (`- [ ]` / `- [x]`).
 *
 * Checklist state here is *content*, not a task tracker. Toggling a box edits
 * the markdown; it never reaches the Tasks module. Product spec §6 asks for
 * that boundary to stay clear as the product grows.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="font-serif text-[16.5px] leading-[1.65] text-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="m-0 mb-3.5 font-serif text-[29px] font-medium tracking-[-0.01em]">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2.5 mt-6.5 font-serif text-[22px] font-medium">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-5.5 font-mono text-[14px] font-semibold uppercase tracking-[0.08em] text-muted">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="m-0 mb-3.5">{children}</p>,
          ul: ({ children }) => <ul className="m-0 mb-3.5 pl-5">{children}</ul>,
          ol: ({ children }) => (
            <ol className="m-0 mb-3.5 list-decimal pl-5">{children}</ol>
          ),
          li: ({ children, className, node }) => {
            /*
             * remark-gfm turns `- [x] …` into an `li.task-list-item` whose
             * first child is a disabled checkbox input. The checked state
             * therefore lives on that child, not on the `li` — so it is read
             * off the hast node here, and the input itself is suppressed
             * below in favour of the mockup's flat square.
             */
            if (!className?.includes("task-list-item")) {
              return <li className="mb-1.5">{children}</li>;
            }

            const input = node?.children.find(
              (child) => child.type === "element" && child.tagName === "input",
            );
            const checked =
              input?.type === "element" && Boolean(input.properties?.checked);

            return (
              <li className="-ml-5 mb-1.5 flex list-none items-start gap-2.5">
                <span
                  aria-hidden
                  className={
                    "mt-0.75 grid size-3.75 flex-none place-items-center rounded-sm border-[1.5px] font-mono text-[10px] leading-none " +
                    (checked
                      ? "border-accent-green bg-accent-green text-on-dark"
                      : "border-checkbox")
                  }
                >
                  {checked ? "✓" : ""}
                </span>
                <span className={checked ? "text-muted line-through" : undefined}>
                  {children}
                </span>
              </li>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="m-0 mb-3.5 border-l-2 border-accent-blue py-0.5 pl-4 font-serif text-[17px] italic text-muted">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded-sm bg-[color-mix(in_srgb,var(--text)_7%,transparent)] px-1.5 py-[1.5px] font-mono text-[13.5px]">
              {children}
            </code>
          ),
          hr: () => <hr className="my-5.5 border-0 border-t border-dashed border-border" />,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ children, href }) => (
            <a href={href} className="text-accent-blue underline">
              {children}
            </a>
          ),
          // The GFM checkbox input is suppressed; `li` draws the square.
          input: () => null,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/**
 * A plain-text digest for grid cards, so a very long note previews rather
 * than trying to render in full (product spec §6).
 */
export function markdownPreview(body: string, limit = 180): string {
  const flattened = body
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*]\s+\[[ xX]\]\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/[*_`]/g, "")
    .replace(/^---$/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  return flattened.length > limit ? `${flattened.slice(0, limit)}…` : flattened;
}
