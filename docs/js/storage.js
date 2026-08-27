// One place that knows how this page talks to localStorage.
//
// The project was renamed from "neon terminal" to "enigma terminal" after the
// game had already been published, so saves made before the rename sit under
// the old prefix. Reading through `migrated` copies such a save across on
// first touch: the rename costs nobody their progress, and the copy happens
// once because the new key exists from then on.

const LEGACY_PREFIX = 'neon-terminal/';
const CURRENT_PREFIX = 'enigma-terminal/';

/**
 * Read `key`, or null where storage is unavailable.
 *
 * Private browsing and blocked site data make the accessor itself throw, not
 * just return nothing, so every read has to be guarded. Three modules had
 * grown their own copy of this try/catch; this is the one the page uses.
 */
export const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** Write `key`, silently doing nothing where storage is unavailable. */
export const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    // Private browsing, or site data blocked: the game still runs, unsaved.
    return false;
  }
};

/** Read `key`, adopting a pre-rename save if this is the first read. */
export const migrated = (key) => {
  const value = read(key);
  if (value !== null || !key.startsWith(CURRENT_PREFIX)) return value;
  const legacy = read(LEGACY_PREFIX + key.slice(CURRENT_PREFIX.length));
  if (legacy !== null) write(key, legacy);
  return legacy;
};
