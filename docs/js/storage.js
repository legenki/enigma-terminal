// One place that knows how this page talks to localStorage.
//
// Everything the game remembers goes through here: the progress store, the
// journal, the language and daylight choices, the sound toggle and the folded
// state of the rail. The guard is the point — private browsing and blocked
// site data make the accessor itself throw rather than return nothing, so an
// unguarded read takes the page down instead of costing it a preference.

/** Read `key`, or null where storage is unavailable. */
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
