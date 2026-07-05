// smoke-lore-wash.mjs — lore.html joins the wash (candidate A, approved
// via mock-lore-wash.html, July 4–5). Factions-harness mold: the
// publisher's contract is parsed from look-derive.js ITSELF, never
// restated here.
//
//   node _edits/smoke-lore-wash.mjs      (from repo root)
//
import { readFileSync } from 'node:fs'

const lore = readFileSync('lore.html', 'utf8')
const modSrc = readFileSync('look-derive.js', 'utf8')

let pass = 0, fail = 0
const t = (n, c) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n)) }
console.log('smoke-lore-wash')

// ── the publisher's contract, from the publisher ──
const rootMapSrc = modSrc.match(/var ROOT_MAP = \{([\s\S]*?)\};/)[1]
const published = new Set([...rootMapSrc.matchAll(/'(--[a-z0-9-]+)'\s*:/g)].map(m => m[1]))
t(`ROOT_MAP parsed from look-derive.js (${published.size} tokens)`, published.size >= 30)

// ── every --look-* lore reads is a published name ──
const styleBlock = lore.match(/<style>([\s\S]*?)<\/style>/)[1]
const reads = [...new Set([...styleBlock.matchAll(/var\((--look-[a-z0-9-]+)/g)].map(m => m[1]))]
const orphans = reads.filter(k => !published.has(k))
t(`reads only published --look-* names (${reads.length}: ${reads.join(', ')})`,
  orphans.length === 0 && reads.length === 4)
t('exact subscription set (ember, well, band, card-text)',
  ['--look-header-ember', '--look-well', '--look-band', '--look-card-text']
    .every(k => reads.includes(k)))

// ── each rewired surface carries its painter literal as fallback,
//    byte-exact, so switch-Off degrades to the pre-plumb page ──
t('ember fallback exact',
  styleBlock.includes('var(--look-header-ember, rgba(42,20,10,0.8)) 0%, transparent 70%'))
t('callout gradient fallbacks exact (candidate A: well → band)',
  styleBlock.includes('var(--look-well, rgba(28,42,58,0.3)) 0%, var(--look-band, rgba(13,10,7,0.5)) 100%'))
t('callout text drift fix (card-text, parchment2 fallback)',
  styleBlock.includes('color: var(--look-card-text, var(--parchment2));'))

// ── the bold is real: italic 600 axis loaded, weight declared ──
t('font link carries Crimson Pro italic 600',
  lore.includes('family=Crimson+Pro:ital,wght@0,300;0,400;1,300;1,400;1,600'))
t('callout text is semibold', /\.lore-callout p \{[\s\S]*?font-weight: 600;[\s\S]*?\}/.test(styleBlock))

// ── orphan-literal scan: what remains hand-painted is ONLY the kept
//    gold hairline family (184,149,42 alphas — theme constant per the
//    factions precedent). No other bare surface literal survives
//    outside a var() fallback. ──
const noFallbacks = styleBlock.replace(/var\(--[a-z0-9-]+, (rgba?\([^)]*\))\)/g, 'var(_)')
const remaining = [...noFallbacks.matchAll(/rgba?\([^)]*\)/g)].map(m => m[0])
const nonGold = remaining.filter(l => !l.startsWith('rgba(184,149,42,'))
t(`remaining literals are gold hairlines only (${remaining.length} gold, ${nonGold.length} other)`,
  remaining.length === 4 && nonGold.length === 0)

// ── untouched invariants ──
t('callout keeps var(--blood) left border', styleBlock.includes('border-left: 3px solid var(--blood);'))
t('no color-mix / modern color syntax introduced', !/color-mix|oklch|lab\(|lch\(/.test(styleBlock))
t('no inline <script> added (lore stays script-external)',
  (lore.match(/<script/g) || []).length === 5 && !/<script>/.test(lore))

console.log(`\n${pass}/${pass + fail} passed`)
process.exit(fail ? 1 : 0)
