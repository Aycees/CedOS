import { DEFAULT_APPEARANCE } from "./types";

/**
 * Runs before first paint.
 *
 * For a signed-in user the server already stamped the correct attributes on
 * <html> from UserSettings, so this script is a no-op. It exists for the
 * unauthenticated shell (login, signup), where there is no UserSettings row to
 * read and the last-used appearance lives only in localStorage. Without it,
 * a user on the dark theme gets a flash of parchment on every sign-in.
 */
const SCRIPT = `
(function () {
  try {
    var el = document.documentElement;
    var stored = JSON.parse(localStorage.getItem('ced-os:appearance') || '{}');
    if (stored.theme && !el.dataset.theme) el.dataset.theme = stored.theme;
    if (stored.accent && !el.dataset.accent) el.dataset.accent = stored.accent;
    if (stored.density && !el.dataset.density) el.dataset.density = stored.density;
  } catch (e) {
    /* corrupt or unavailable storage — the server defaults already apply */
  }
})();
`;

export function AppearanceScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}

export const APPEARANCE_STORAGE_KEY = "ced-os:appearance";

/** Attributes for <html>. Server-rendered, so the first paint is already correct. */
export function appearanceAttributes(appearance = DEFAULT_APPEARANCE) {
  return {
    "data-theme": appearance.theme,
    "data-accent": appearance.accent,
    "data-density": appearance.density,
  };
}
