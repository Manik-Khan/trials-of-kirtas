// smoke-npcs-wash.mjs — npcs.html joins the wash (factions-mirror
// subscription set, July 5). The publisher's contract is parsed from
// look-derive.js ITSELF, never restated here.
//
//   node _edits/smoke-npcs-wash.mjs      (from repo root)
//
import { readFileSync } from 'node:fs'

const page = readFileSync('npcs.html', 'utf8')
const modSrc = readFileSync('look-derive.js', 'utf8')

let pass = 0, fail = 0
const t = (n, c) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n)) }
console.log('smoke-npcs-wash')

// ── the publisher's contract, from the publisher ──
const rootMapSrc = modSrc.match(/var ROOT_MAP = \{([\s\S]*?)\};/)[1]
const published = new Set([...rootMapSrc.matchAll(/'(--[a-z0-9-]+)'\s*:/g)].map(m => m[1]))
t(`ROOT_MAP parsed from look-derive.js (${published.size} tokens)`, published.size >= 30)

// ── every --look-* npcs reads is a published name ──
const styleBlock = page.match(/<style>([\s\S]*?)<\/style>/)[1]
const reads = [...new Set([...styleBlock.matchAll(/var\((--look-[a-z0-9-]+)/g)].map(m => m[1]))]
const orphans = reads.filter(k => !published.has(k))
t(`reads only published --look-* names (${reads.length}: ${reads.join(', ')})`, orphans.length === 0)
t('subscription set mirrors factions (ember, card family, well voices, modal pair, dots, scrim, trim, accent-strong)',
  ['--look-header-ember', '--look-card-bg', '--look-card-border', '--look-card-text',
   '--look-card-muted', '--look-trim', '--look-accent-strong',
   '--look-modal-g1', '--look-modal-g2', '--look-dots', '--look-scrim']
    .every(k => reads.includes(k)))

// ── painter literals as fallbacks, byte-exact (switch-Off = pre-plumb page) ──
const exact = [
  ['ember', 'var(--look-header-ember, rgba(42,20,10,0.8)) 0%, transparent 70%'],
  ['card border', 'var(--look-card-border, rgba(26,26,26,0.15))'],
  ['hover accent-strong', 'var(--look-accent-strong, rgba(192,0,26,0.35))'],
  ['portrait stage floor', 'background: var(--look-card-bg, #1a1a1a);\n      margin-bottom: 0;'],
  ['portrait gradient, all three fossil stops',
   'var(--look-modal-g1, #2a2018) 0%, var(--look-modal-g2, #1a1410) 55%, var(--look-modal-g2, #0d0a07) 100%'],
  ['halftone dots', 'var(--look-dots, rgba(0,0,0,0.42))'],
  ['badge scrim', 'background: var(--look-scrim, rgba(0,0,0,0.72));'],
  ['card-name', 'var(--look-card-text, #f0ece4)'],
  ['card-desc trim', 'var(--look-trim, #b8952a)'],
  ['separator crest', 'var(--look-card-muted, rgba(255,255,255,0.6)) 50%'],
]
for (const [name, needle] of exact) t(`${name} fallback exact`, styleBlock.includes(needle))

// ── badge text drift fix: pinned light, no --parchment read on the scrim ──
const badge = styleBlock.match(/\.house-badge \{[\s\S]*?\}/)[0]
t('badge text pinned #f0ece4 (no drift-prone token on the scrim)',
  badge.includes('color: #f0ece4;') && !badge.includes('var(--parchment)'))

// ── KEEPERS: allegiance identity never follows the look ──
const keeperBlock = styleBlock.slice(styleBlock.indexOf('Faction wipe gradient definitions'))
t('five wipes intact, zero token reads (identity, not look)',
  (keeperBlock.match(/\.wipe-[a-z]+::before/g) || []).length === 5 && !/var\(--look-/.test(keeperBlock))
t('wipe gradients byte-exact (wolven sample)',
  keeperBlock.includes('rgba(30,60,120,0.9) 0%,') && keeperBlock.includes('rgba(255,255,255,0.5) 100%);'))
t('faction bars + name tints untouched',
  keeperBlock.includes('.bar-wolven     { background: linear-gradient(90deg, #1e3c78, #2a6438, #e8e8e8); }')
  && keeperBlock.includes('.faction-wolven     { color: #6a90d8; }'))
t('status dots fixed (game meaning)',
  styleBlock.includes('.dot-alive   { background: #5a9a6a; }')
  && styleBlock.includes('.dot-hostile { background: #8a3a3a; }'))
t('portrait-fade already token-faithful (rides --ink-deep, untouched)',
  styleBlock.includes('color-mix(in srgb, var(--ink-deep) 65%, transparent)'))

// ── structural invariants ──
t('script inventory unchanged (4 external + the shipped inline block)',
  (page.match(/<script/g) || []).length === 5 && (page.match(/<script>/g) || []).length === 1)
t('no color-mix introduced by the plumb (only the pre-existing fade pair)',
  (styleBlock.match(/color-mix/g) || []).length === 2)

console.log(`\n${pass}/${pass + fail} passed`)
process.exit(fail ? 1 : 0)
