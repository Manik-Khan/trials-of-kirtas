// shelfTheme.js — the two-axis reading theme, PURE (no DOM, headlessly
// smokable). Ink and paper are independent per-reader axes persisted as
// KEYS in profiles.appearance ({ ink:'sumi', paper:'bone' }) — hexes
// resolve here at render time, same philosophy as seat accents.
//
// The independence invariant is STRUCTURAL: inkVars() can only ever emit
// --sh-ink/--sh-accent; paperVars() can only ever emit --sh-paper. Smoke-
// asserted in smoke-shelf.mjs (pinned lesson 10).
//
// Every token is namespaced --sh-* and scoped to .sh-scope: theme.css owns
// --ink (the dark site background) and the --font-* names — the shelf must
// never collide with them (the "never change a theme variable" rule).

export const INKS = [
  { key: 'sumi',      name: 'Sumi',      ink: '#26231E', accent: '#A93A26' },
  { key: 'indigo',    name: 'Indigo',    ink: '#2B3A55', accent: '#B4652E' },
  { key: 'forest',    name: 'Forest',    ink: '#2E4A38', accent: '#A93A26' },
  { key: 'vermilion', name: 'Vermilion', ink: '#953122', accent: '#26231E' },
  { key: 'sepia',     name: 'Sepia',     ink: '#54402C', accent: '#8A2F3C' },
  { key: 'plum',      name: 'Plum',      ink: '#463049', accent: '#946A2D' },
]

export const PAPERS = [
  { key: 'bone',    name: 'Bone',    paper: '#E9E4D6' },
  { key: 'celadon', name: 'Celadon', paper: '#DEE5D8' },
  { key: 'blush',   name: 'Blush',   paper: '#ECDCD2' },
  { key: 'mist',    name: 'Mist',    paper: '#DCE1E4' },
  { key: 'straw',   name: 'Straw',   paper: '#EBE2C6' },
  { key: 'lilac',   name: 'Lilac',   paper: '#E3DEE8' },
]

export const DEFAULT_LOOK = { ink: 'sumi', paper: 'bone' }

export const resolveInk = key =>
  INKS.find(i => i.key === key) || INKS[0]

export const resolvePaper = key =>
  PAPERS.find(p => p.key === key) || PAPERS[0]

// Axis 1. Emits ONLY ink + accent — never paper.
export function inkVars(key) {
  const i = resolveInk(key)
  return { '--sh-ink': i.ink, '--sh-accent': i.accent }
}

// Axis 2. Emits ONLY paper — never ink or accent.
export function paperVars(key) {
  return { '--sh-paper': resolvePaper(key).paper }
}

// The full style object for the scope element.
export function lookVars(look) {
  const l = look || DEFAULT_LOOK
  return { ...inkVars(l.ink), ...paperVars(l.paper) }
}
