// Eight icons from Feather (https://feathericons.com), MIT, © Cole Bemis.
// See LICENSE-feather beside this file.
//
// Only the paths are vendored, not the library: the sidebar needs eight fixed
// glyphs and nothing else, and a build step for that would cost more than it
// saves. Every icon is the stock 24×24 Feather geometry, unaltered, so a
// future swap against the real set stays a straight comparison.
//
// Written as element descriptors rather than markup, because nothing in this
// project builds DOM from strings — the rule that keeps a seed phrase or a
// case title from ever being parsed as HTML applies to icons too.

const ICONS = {
	folder: [
		[
			"path",
			{
				d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z",
			},
		],
	],
	grid: [
		["rect", { x: 3, y: 3, width: 7, height: 7 }],
		["rect", { x: 14, y: 3, width: 7, height: 7 }],
		["rect", { x: 14, y: 14, width: 7, height: 7 }],
		["rect", { x: 3, y: 14, width: 7, height: 7 }],
	],
	key: [
		[
			"path",
			{
				d: "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
			},
		],
	],
	database: [
		["ellipse", { cx: 12, cy: 5, rx: 9, ry: 3 }],
		["path", { d: "M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" }],
		["path", { d: "M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" }],
	],
	search: [
		["circle", { cx: 11, cy: 11, r: 8 }],
		["line", { x1: 21, y1: 21, x2: 16.65, y2: 16.65 }],
	],
	shuffle: [
		["polyline", { points: "16 3 21 3 21 8" }],
		["line", { x1: 4, y1: 20, x2: 21, y2: 3 }],
		["polyline", { points: "21 16 21 21 16 21" }],
		["line", { x1: 15, y1: 15, x2: 21, y2: 21 }],
		["line", { x1: 4, y1: 4, x2: 9, y2: 9 }],
	],
	bookOpen: [
		["path", { d: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" }],
		["path", { d: "M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" }],
	],
	terminal: [
		["polyline", { points: "4 17 10 11 4 5" }],
		["line", { x1: 12, y1: 19, x2: 20, y2: 19 }],
	],
	info: [
		["circle", { cx: 12, cy: 12, r: 10 }],
		["line", { x1: 12, y1: 16, x2: 12, y2: 12 }],
		["line", { x1: 12, y1: 8, x2: 12.01, y2: 8 }],
	],
};

const NS = "http://www.w3.org/2000/svg";

/**
 * One Feather glyph as an <svg>, stroked in the current text colour so it
 * follows the palette like any other piece of type.
 */
export function icon(name, { size = 15 } = {}) {
	const node = document.createElementNS(NS, "svg");
	for (const [key, value] of Object.entries({
		viewBox: "0 0 24 24",
		width: String(size),
		height: String(size),
		fill: "none",
		stroke: "currentColor",
		"stroke-width": "2",
		"stroke-linecap": "round",
		"stroke-linejoin": "round",
		"aria-hidden": "true",
		class: "icon",
	})) {
		node.setAttribute(key, value);
	}
	for (const [tag, attrs] of ICONS[name] || ICONS.info) {
		const child = document.createElementNS(NS, tag);
		for (const [key, value] of Object.entries(attrs)) {
			child.setAttribute(key, String(value));
		}
		node.appendChild(child);
	}
	return node;
}

export const ICON_NAMES = Object.keys(ICONS);
