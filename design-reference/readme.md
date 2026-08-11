# Ced OS Design System

Extracted from the "Ced OS" personal-operating-system app mockup built in this project (`Ced OS.dc.html`). No external codebase or Figma file was provided — this system's source of truth is that mockup itself. An earlier draft (`Atlas OS v2 - Claude System.dc.html`) used Anthropic's own default palette/type as a starting point; Ced OS diverged from it into its own warm-paper identity, and that divergent version is what this system documents.

Ced OS is a fictional all-in-one personal app (today view, notes, calendar, habits, finance, journal, password vault) styled like a warm, paper-bound daily planner rather than a typical SaaS dashboard.

## Content fundamentals
- Copy is plain and functional: section labels ("Today's schedule", "This month"), short link labels ("all →", "open calendar →"), lowercase micro-copy ("nothing scheduled", "no tasks for today").
- Kickers and metadata (dates, counts, units) are uppercase, letter-spaced, monospace — treated like a label printed on a ledger, not marketing copy.
- No emoji anywhere. Voice is neutral/observational, never chatty or exclamatory.
- Empty states are one quiet line plus a dashed "+" prompt, never illustration-heavy.

## Visual foundations
- **Type**: Newsreader (serif) for headings, page titles, and reflective moments (journal prompt, empty states) — sometimes italic. IBM Plex Mono for everything else: labels, buttons, data, body copy in dense UI. Two fonts only, no third.
- **Color**: a warm parchment "paper" theme is default; a "dark" theme swaps in near-black warm surfaces. Both share the same tokens (bg/sidebar/card/border/text/muted). One accent color is active at a time (terracotta default), chosen from a fixed 4-color set (blue/green/terracotta/violet); a wider 8-color set covers calendar/category tags.
- **Surfaces**: cards are flat — solid 1px border, 12px radius, card-color background, **no shadow**. The only shadows in the whole system are on modal dialogs.
- **Dividers**: internal row separators (between list items) are dashed; the border around a card/section is always solid. This solid-outside / dashed-inside pairing is a defining motif.
- **Buttons**: solid accent-filled for the one primary action per screen; ghost mono text links for "see all →" navigation; outline for secondary modal actions; dashed-border for empty-state "add" prompts.
- **Radii**: 8px inputs, 9px buttons/controls, 12px cards, 14px modals, 20px pills, 50% avatars/dots.
- **Spacing/density**: a Comfortable/Compact density toggle scales list-row padding (11px ↔ 7px) sitewide — the one built-in layout tweak.
- **Animation**: none observed — state changes are instant, no transitions/eases.
- **Imagery**: none — the whole UI is type, color fields, and thin borders. No photography, no illustration.

## Iconography
No icon font, no emoji. A handful of hand-set 24×24 stroke-line SVGs (stroke-width 2, round caps/joins, currentColor) for delete and back actions. Everything else uses plain unicode glyphs (⚙ settings, ›/⌄ chevrons, → arrows) or text.

## Index
- `styles.css` — import entrypoint (fonts, colors, spacing/radii tokens)
- `tokens/` — `fonts.css`, `colors.css` (paper + dark theme, accent palette), `spacing.css` (radii, density)
- `guidelines/` — specimen cards: colors (paper/dark/accent), type, radii, borders & dividers, iconography
- `components/core/` — Button, Card, Input, Segmented, Chip, Modal (jsx + .d.ts + prompt)
- `ui_kits/ced-os/` — `index.html`, a recreation of the Today dashboard with a working light/dark toggle
- `Ced OS.dc.html`, `Atlas OS v2 - Claude System.dc.html` — the original app mockups this system was extracted from

## Caveats
- Only the Today dashboard was rebuilt as a UI kit screen; Notes/Calendar/Habits/Finance/Journal/Vault/Settings exist in the source mockup but aren't recreated here yet.
- Component set is a minimal core (6 primitives) covering what those screens actually use — not an exhaustive framework-style kit.
- Newsreader and IBM Plex Mono are loaded from Google Fonts by URL (no font files bundled), since both are genuinely the mockup's fonts, not substitutions.
