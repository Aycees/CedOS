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

/** The word count shown in the editor's "edited … · N words" line. */
export function wordCount(body: string): number {
  const trimmed = body.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
