// A dropdown for the strip above the interface.
//
// The shell is outside the GUI and cannot reach its DOM helpers, and a native
// <select> cannot be given the interface's own type, ground and hairline —
// so this is the one control the shell builds for itself. It is a listbox by
// the book: the button owns the value, the menu owns the options, and the
// keyboard reaches all of it.
//
// Built from elements rather than markup, like everything else here: an option
// label is data, and data is never parsed as HTML.

import { icon } from './vendor/feather.js';

/**
 * @param {object} spec
 * @param {Array<{value: string, name: string, code: string}>} spec.options
 * @param {string} spec.value      which option is selected to begin with
 * @param {string} spec.label      accessible name for the control
 * @param {(value: string) => void} spec.onChange
 * @returns {{ node: HTMLElement, setValue: (value: string) => void,
 *            setLabel: (label: string) => void, close: () => void }}
 */
export function dropdown({ options, value, label, onChange }) {
  const root = document.createElement('div');
  root.className = 'drop';

  const caret = icon('chevronDown', { size: 11 });
  caret.classList.add('drop__caret');

  const button = document.createElement('button');
  button.className = 'drop__btn';
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', label);
  const caption = document.createElement('span');
  button.append(caption, caret);

  const menu = document.createElement('ul');
  menu.className = 'drop__menu is-hidden';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', label);
  menu.tabIndex = -1;

  let current = value;
  let open = false;

  const items = options.map((option) => {
    const item = document.createElement('li');
    const choice = document.createElement('button');
    choice.className = 'drop__opt';
    choice.type = 'button';
    choice.setAttribute('role', 'option');
    choice.dataset.value = option.value;

    const tick = icon('check', { size: 12 });
    tick.classList.add('drop__tick');
    const name = document.createElement('span');
    name.className = 'drop__name';
    name.textContent = option.name;
    const code = document.createElement('span');
    code.className = 'drop__code';
    code.textContent = option.code;

    choice.append(tick, name, code);
    choice.addEventListener('click', () => {
      setValue(option.value);
      close({ focus: true });
      if (onChange) onChange(option.value);
    });
    item.append(choice);
    menu.append(item);
    return choice;
  });

  function paint() {
    const chosen =
      options.find((option) => option.value === current) || options[0];
    caption.textContent = chosen.code;
    for (const choice of items) {
      const selected = choice.dataset.value === chosen.value;
      choice.setAttribute('aria-selected', String(selected));
      choice.querySelector('.drop__tick').classList.toggle('is-off', !selected);
    }
  }

  function setValue(next) {
    current = next;
    paint();
  }

  /** Move the roving focus inside the open menu. */
  function step(delta) {
    const focused = items.indexOf(document.activeElement);
    const from =
      focused === -1
        ? items.findIndex(
            (choice) => choice.getAttribute('aria-selected') === 'true',
          )
        : focused;
    const next = (from + delta + items.length) % items.length;
    items[next].focus();
  }

  function openMenu({ toSelected = true } = {}) {
    if (open) return;
    open = true;
    menu.classList.remove('is-hidden');
    button.setAttribute('aria-expanded', 'true');
    if (toSelected) {
      const selected = items.find(
        (choice) => choice.getAttribute('aria-selected') === 'true',
      );
      (selected || items[0]).focus();
    }
  }

  function close({ focus = false } = {}) {
    if (!open) return;
    open = false;
    menu.classList.add('is-hidden');
    button.setAttribute('aria-expanded', 'false');
    if (focus) button.focus();
  }

  button.addEventListener('click', () => (open ? close() : openMenu()));

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      close({ focus: true });
      return;
    }
    if (!open) {
      if (
        ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key) &&
        document.activeElement === button
      ) {
        event.preventDefault();
        openMenu();
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0].focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1].focus();
    }
  });

  // Tabbing out of the control closes it: the menu is not a place to land in.
  root.addEventListener('focusout', (event) => {
    if (!root.contains(event.relatedTarget)) close();
  });

  // A click anywhere else is a dismissal. On the capture phase, so it fires
  // before whatever was clicked does its own work — the comment said capture
  // while the listener was on the bubble phase, which is the opposite order.
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (open && !root.contains(event.target)) close();
    },
    true,
  );

  root.append(button, menu);
  paint();

  return {
    node: root,
    setValue,
    /** The accessible name is in the player's language, so it changes too. */
    setLabel(next) {
      button.setAttribute('aria-label', next);
      menu.setAttribute('aria-label', next);
    },
    close: () => close(),
  };
}
