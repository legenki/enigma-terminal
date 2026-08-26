// Tiny DOM helpers. Everything the GUI renders goes through `el`, which keeps
// values escaped by construction — no innerHTML anywhere in the panels.

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(
      child instanceof Node ? child : document.createTextNode(String(child)),
    );
  }
  return node;
}

export const clear = (node) => {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
};

export const replace = (node, ...children) => {
  clear(node);
  node.append(...children.flat().filter(Boolean));
  return node;
};

/** A titled window with the pinstripe bar. */
export const win = (title, body, extra = null) =>
  el(
    'section',
    { class: 'win' },
    el(
      'div',
      { class: 'win__bar' },
      el('span', { class: 'win__box', 'aria-hidden': 'true' }),
      el('span', { class: 'win__stripes', 'aria-hidden': 'true' }),
      el('h2', { class: 'win__title', text: title }),
      el('span', { class: 'win__stripes', 'aria-hidden': 'true' }),
      extra,
    ),
    body,
  );

export const section = (title, meta = null) =>
  el(
    'div',
    { class: 'section__head' },
    el('h3', { class: 'section__title', text: title }),
    meta ? el('span', { class: 'section__meta', text: meta }) : null,
  );

export const notice = (kind, title, ...lines) =>
  el(
    'div',
    { class: `notice notice--${kind}` },
    el('strong', { text: title }),
    ...lines.map((line) => el('div', { text: line })),
  );

export const badge = (kind, text) =>
  el('span', { class: `badge badge--${kind}`, text });

export const kv = (pairs) =>
  el(
    'dl',
    { class: 'kv' },
    ...pairs.flatMap(([key, value]) => [
      el('dt', { text: key }),
      el('dd', { class: 'break', text: String(value) }),
    ]),
  );

export const table = (headers, rows) =>
  el(
    'div',
    { class: 'scroll-x' },
    el(
      'table',
      { class: 'data' },
      el(
        'thead',
        {},
        el('tr', {}, ...headers.map((h) => el('th', { text: h }))),
      ),
      el(
        'tbody',
        {},
        ...rows.map((cells) =>
          el(
            'tr',
            {},
            ...cells.map((cell) =>
              cell?.node
                ? el('td', { class: cell.class || '' }, cell.node)
                : el('td', {
                    class: cell?.class || '',
                    text: cell && cell.text !== undefined ? cell.text : cell,
                  }),
            ),
          ),
        ),
      ),
    ),
  );

export const empty = (message) => el('div', { class: 'empty', text: message });
