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
//
// ⚠ SYNC CONTRACT: the catalog below (INKS / PAPERS / FLOOR and the house/
// archive presets) is MIRRORED in root settings-flyout.js, which is a
// classic script and cannot import this module. smoke-settings-flyout.mjs
// parses both files and fails the build if they drift. Change BOTH.

export const INKS = [
  { key: 'sumi',      name: 'Sumi',      ink: '#26231E', accent: '#A93A26' },
  { key: 'indigo',    name: 'Indigo',    ink: '#2B3A55', accent: '#B4652E' },
  { key: 'forest',    name: 'Forest',    ink: '#2E4A38', accent: '#A93A26' },
  { key: 'vermilion', name: 'Vermilion', ink: '#953122', accent: '#26231E' },
  { key: 'sepia',     name: 'Sepia',     ink: '#54402C', accent: '#8A2F3C' },
  { key: 'plum',      name: 'Plum',      ink: '#463049', accent: '#946A2D' },
  // the expansion — light inks exist FOR dark papers; the floor governs
  { key: 'rose',      name: 'Rose',      ink: '#D98BA8', accent: '#8A2F3C' },
  { key: 'gold',      name: 'Gold',      ink: '#C9A227', accent: '#953122' },
  { key: 'glacier',   name: 'Glacier',   ink: '#A9C4D6', accent: '#B4652E' },
  { key: 'bonewhite', name: 'Bone',      ink: '#E7E0CE', accent: '#C9A227' },
]

export const PAPERS = [
  { key: 'bone',     name: 'Bone',     paper: '#E9E4D6', polarity: 'light' },
  { key: 'celadon',  name: 'Celadon',  paper: '#DEE5D8', polarity: 'light' },
  { key: 'blush',    name: 'Blush',    paper: '#ECDCD2', polarity: 'light' },
  { key: 'mist',     name: 'Mist',     paper: '#DCE1E4', polarity: 'light' },
  { key: 'straw',    name: 'Straw',    paper: '#EBE2C6', polarity: 'light' },
  { key: 'lilac',    name: 'Lilac',    paper: '#E3DEE8', polarity: 'light' },
  // the dark shelf — polarity flips grain blending on the consumer side
  { key: 'charcoal', name: 'Charcoal', paper: '#1C1A17', polarity: 'dark' },
  { key: 'slate',    name: 'Slate',    paper: '#262B31', polarity: 'dark' },
  { key: 'pine',     name: 'Pine',     paper: '#1D2822', polarity: 'dark' },
  { key: 'walnut',   name: 'Walnut',   paper: '#2B211A', polarity: 'dark' },
]

export const DEFAULT_LOOK = { ink: 'sumi', paper: 'bone' }

// ── the contrast floor: computed, never curated (M: 2.0 — try the combos) ──
export const FLOOR = 2.0

function lum(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16)
  const s = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]
    .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]
}

export function contrastRatio(a, b) {
  const la = lum(a), lb = lum(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export const isFloored = (inkKey, paperKey) =>
  contrastRatio(resolveInk(inkKey).ink, resolvePaper(paperKey).paper) < FLOOR

// The stranding answer: when a paper switch drops the held ink below the
// floor, the consumer nudges to the highest-contrast ink and says so.
export function nearestLegibleInk(paperKey) {
  const P = resolvePaper(paperKey)
  let best = INKS[0], bestC = 0
  for (const i of INKS) {
    const c = contrastRatio(i.ink, P.paper)
    if (c > bestC) { bestC = c; best = i }
  }
  return best
}

export const resolveInk = key =>
  INKS.find(i => i.key === key) || INKS[0]

export const resolvePaper = key =>
  PAPERS.find(p => p.key === key) || PAPERS[0]

// ── per-page looks: the default cascades; a page override wins ──
// appearance carries the DEPLOYED flat shape: { ink, paper, accent, …,
// pageLooks: { journal: {ink, paper}, … } }. Pure — the same resolution
// runs in the flyout (mirrored) and here for the journal's first paint.
export function resolveLookFor(appearance, page) {
  const a = appearance || {}
  const base = {
    ink: a.ink || DEFAULT_LOOK.ink,
    paper: a.paper || DEFAULT_LOOK.paper,
  }
  const o = a.pageLooks && page && a.pageLooks[page]
  if (o && (o.ink || o.paper)) {
    return { ink: o.ink || base.ink, paper: o.paper || base.paper }
  }
  return base
}

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
