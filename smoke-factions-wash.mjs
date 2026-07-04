// smoke-factions-wash.mjs — the wash migration's page-side contract.
// factions.html was the first fossil page rewired onto the well-surface
// family (July 4). This smoke asserts, against the PUBLISHER's contract
// (ROOT_MAP token names parsed from look-derive.js itself, never a local
// copy):
//   • every --look-* token the page reads is one the module actually writes
//   • every rewired surface carries its original hand-painted literal as
//     the var() fallback (the switch-Off degrade is the pre-plumb page,
//     modal text excepted — see the drift note)
//   • no orphan fossil literals remain outside var() fallbacks
//   • the drift fix: modal text no longer reads var(--parchment)/(--parchment2)
//     (Parchment-era paint that Phantom's inverted semantics turned
//     near-black-on-brown); it reads well-polarity tokens with the
//     painter's cream literals as fallbacks
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('./factions.html', import.meta.url), 'utf8')
const mod  = readFileSync(new URL('./look-derive.js', import.meta.url), 'utf8')

let pass = 0, fail = 0
const t = (n, c) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n)) }
console.log('smoke-factions-wash')

// ── the publisher's contract: token names ROOT_MAP actually writes ──
const rootMapSrc = mod.match(/var ROOT_MAP = \{([\s\S]*?)\};/)[1]
const published = new Set([...rootMapSrc.matchAll(/'(--[a-z0-9-]+)'\s*:/g)].map(m => m[1]))
t(`ROOT_MAP parsed from look-derive.js (${published.size} tokens)`, published.size >= 30)

// every --look-* read on the page is a published name
const reads = [...page.matchAll(/var\((--look-[a-z0-9-]+)/g)].map(m => m[1])
const unpublished = [...new Set(reads)].filter(k => !published.has(k))
t(`every --look-* the page reads is published (${new Set(reads).size} distinct reads, orphan reads: ${unpublished.length}${unpublished.length ? ': ' + unpublished.join(', ') : ''})`,
  reads.length > 0 && unpublished.length === 0)

// ── the subscriptions, each with its exact painter fallback ──
const subs = [
  ['card bg',          'var(--look-card-bg, #1a1a1a)'],
  ['card border',      'var(--look-card-border, rgba(26,26,26,0.15))'],
  ['card text',        'var(--look-card-text, #f0ece4)'],
  ['card alias',       'var(--look-card-muted, var(--muted))'],
  ['heraldry well',    'var(--look-well, #111009)'],
  ['summary trim',     'var(--look-trim, #b8952a)'],
  ['hover border',     'var(--look-accent-strong, rgba(192,0,26,0.35))'],
  ['halftone dots',    'var(--look-dots, rgba(0,0,0,0.3))'],
  ['modal g1',         'var(--look-modal-g1, #2a1e10)'],
  ['modal g2',         'var(--look-modal-g2, #140f08)'],
  ['scrim',            'var(--look-scrim, rgba(10,8,5,0.85))'],
  ['heraldry band',    'var(--look-band, rgba(10,8,5,0.5))'],
  ['header ember',     'var(--look-header-ember, rgba(42,20,10,0.8))'],
  ['modal name (drift fix, cream fallback)',  'var(--look-card-text, #f0e6ce)'],
  ['modal text (drift fix, cream fallback)',  'var(--look-modal-text2, #e8d9b8)'],
  ['modal alias (drift fix, gold fallback)',  'var(--look-accent-on-modal, #b8952a)'],
  ['modal close (drift fix)',                 'var(--look-modal-muted, #6b5d4a)'],
]
for (const [name, needle] of subs) t(`subscribes: ${name}`, page.includes(needle))

// old-gold hairlines now ride the live gold family
t('hairlines ride --gold-dim / --gold-mid with old-gold fallbacks',
  page.includes('var(--gold-dim, rgba(184,149,42,0.15))')
  && page.includes('var(--gold-mid, rgba(184,149,42,0.3))')
  && page.includes('var(--gold-dim, rgba(184,149,42,0.1))'))

// ── no orphan fossils: every legacy literal appears only inside var() ──
const style = page.match(/<style>([\s\S]*?)<\/style>/)[1]
const fossils = ['#1a1a1a', '#111009', '#f0ece4', '#b8952a', '#2a1e10', '#140f08',
  'rgba(184,149,42', 'rgba(192,0,26', 'rgba(10,8,5', 'rgba(42,20,10']
let orphans = 0
for (const f of fossils) {
  let i = -1
  while ((i = style.indexOf(f, i + 1)) !== -1) {
    const before = style.slice(Math.max(0, i - 60), i)
    if (!/var\(--[a-z0-9-]+,\s*$/.test(before)) orphans++
  }
}
t(`no orphan fossil literals outside var() fallbacks (orphans: ${orphans})`, orphans === 0)

// ── the drift is gone: modal text never reads the page ramp ──
const modalBlock = style.slice(style.indexOf('.modal {'), style.indexOf('/* Scrollbar */'))
t('modal text no longer reads var(--parchment) / var(--parchment2)',
  !modalBlock.includes('var(--parchment)') && !modalBlock.includes('var(--parchment2)'))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
