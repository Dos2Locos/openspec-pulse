// A tiny element builder. Text only ever goes in through text nodes, never innerHTML, so change
// names and task text cannot inject markup.

type AttrValue = string | number | boolean | null | undefined
type Handler = (event: Event) => void
export type Attrs = Record<string, AttrValue | Handler>
export type Child = Node | string | null | undefined | false

function append(parent: Element, children: readonly Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue
    parent.append(typeof child === 'string' ? document.createTextNode(child) : child)
  }
}

/** `on<event>` attributes become listeners; `true` sets an empty attribute; null/false/undefined skip it. */
function apply(el: Element, attrs: Attrs): void {
  for (const [name, value] of Object.entries(attrs)) {
    if (typeof value === 'function') el.addEventListener(name.slice(2).toLowerCase(), value)
    else if (value === true) el.setAttribute(name, '')
    else if (value !== false && value !== null && value !== undefined) el.setAttribute(name, String(value))
  }
}

export function h(tag: string, attrs: Attrs = {}, children: readonly Child[] = []): HTMLElement {
  const el = document.createElement(tag)
  apply(el, attrs)
  append(el, children)
  return el
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/** A 24×24 stroke icon from path data, hidden from screen readers (its button has the name). */
export function icon(paths: readonly string[], size = 16): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  for (const [name, value] of Object.entries({
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false'
  })) {
    svg.setAttribute(name, String(value))
  }
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', d)
    svg.append(path)
  }
  return svg
}

// Lucide icons (ISC licence), path data only.
export const ICONS = {
  layers: [
    'm12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z',
    'm22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65',
    'm22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65'
  ],
  plus: ['M5 12h14', 'M12 5v14'],
  lightbulb: [
    'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5',
    'M9 18h6',
    'M10 22h4'
  ],
  refresh: ['M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8', 'M21 3v5h-5'],
  back: ['m15 18-6-6 6-6'],
  next: ['M5 12h14', 'm12 5 7 7-7 7'],
  play: ['m6 3 14 9-14 9Z'],
  check: ['M20 6 9 17l-5-5'],
  archive: ['M21 8v13H3V8', 'M1 3h22v5H1Z', 'M10 12h4'],
  box: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z'],
  boxChecked: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z', 'm8 12 3 3 5-6'],
  file: ['M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z', 'M14 2v4a2 2 0 0 0 2 2h4'],
  book: ['M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20']
} as const
