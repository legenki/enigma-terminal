// One place that knows how this page talks to localStorage.
//
// The project was renamed from "neon terminal" to "enigma terminal" after the
// game had already been published, so saves made before the rename sit under
// the old prefix. Reading through `migrated` copies such a save across on
// first touch: the rename costs nobody their progress, and the copy happens
// once because the new key exists from then on.

const LEGACY_PREFIX = 'neon-terminal/';
const CURRENT_PREFIX = 'enigma-terminal/';

/** Read `key`, adopting a pre-rename save if this is the first read. */
export const migrated = (key) => {
  try {
    let value = localStorage.getItem(key);
    if (value === null && key.startsWith(CURRENT_PREFIX)) {
      const legacy = localStorage.getItem(
        LEGACY_PREFIX + key.slice(CURRENT_PREFIX.length),
      );
      if (legacy !== null) {
        localStorage.setItem(key, legacy);
        value = legacy;
      }
    }
    return value;
  } catch {
    // Private browsing, or site data blocked: the game still runs, unsaved.
    return null;
  }
};
