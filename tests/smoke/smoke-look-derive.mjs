// smoke-look-derive.mjs — the deriveLook module under jsdom.
// Sweeps every floor-legal ink × paper pair from the REAL catalog
// (imported from shelfTheme.js, the module side of the sync contract)
// across every finish and every raw-axis combination, asserting:
//   • page text, card text, and trim all clear the 2.0 floor
//   • 'dark' mode GUARANTEES a dark ground (the Stage promise)
//   • 'dark' and 'invert' truthfully coincide on dark inks / light papers
//   • Print on Sumi × Bone reproduces the control case (neutral #1a1a1a
//     cards, the #c9b48a gilded caption) — Phantom, derived
//   • applyToRoot writes the theme.css token names inline and clearRoot
//     removes every one of them (the beta toggle's rollback path)
import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'
import { INKS, PAPERS, contrastRatio } from '../../journal/src/shelf/shelfTheme.js'

const src = readFileSync(new URL('../../look-derive.js', import.meta.url), 'utf8')
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { runScripts: 'dangerously' })
const s = dom.window.document.createElement('script')
s.textContent = src
dom.window.document.body.appendChild(s)
const L = dom.window.TokLook

let pass = 0, fail = 0
const t = (n, c) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n)) }
console.log('smoke-look-derive')

const lumCss = c => { const m = c.match(/rgba?\((\d+),(\d+),(\d+)/).slice(1).map(Number)
  const q = m.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) })
  return .2126 * q[0] + .7152 * q[1] + .0722 * q[2] }
const con = (a, b) => { const l1 = lumCss(a), l2 = lumCss(b)
  return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05) }

t('TokLook rides window with the five finishes',
  L && L.FINISHES.length === 5 && L.FINISHES.map(f => f.key).join() === 'print,manuscript,ledger,stage,reversed')
t('matchFinish round-trips every finish and misses customs',
  L.FINISHES.every(f => L.matchFinish(f) === f.key)
  && L.matchFinish({ mode: 'dark', wells: 'neutral', trim: 'gold' }) === null)

// the control case: Print on Sumi × Bone = Phantom, derived
const sumi = INKS.find(i => i.key === 'sumi'), bone = PAPERS.find(p => p.key === 'bone')
const asObj = (I, P) => [{ ink: I.ink, accent: I.accent }, { paper: P.paper, dark: P.polarity === 'dark' }]
const print = L.finishOf('print')
const ctrl = L.deriveLook(...asObj(sumi, bone), print)
t('control: neutral #1a1a1a cards on the bone ground', ctrl.cardBg === 'rgb(26,26,26)' && ctrl.g === 'rgb(233,228,214)')
t('control: the gilded caption is #c9b48a', ctrl.trim === 'rgb(201,180,138)')
t('control: light ground, polarity light', !ctrl.groundDark)

// truthful coincidence: dark ink + light paper → 'dark' == 'invert'
const dkA = L.deriveLook(...asObj(sumi, bone), { mode: 'dark', wells: 'inked', trim: 'auto' })
const dkB = L.deriveLook(...asObj(sumi, bone), { mode: 'invert', wells: 'inked', trim: 'auto' })
t('dark and invert coincide on a dark ink (truthfully)', dkA.g === dkB.g && dkA.cardBg === dkB.cardBg && dkA.trim === dkB.trim)
const rose = INKS.find(i => i.key === 'rose')
const rsA = L.deriveLook(...asObj(rose, bone), { mode: 'dark', wells: 'inked', trim: 'auto' })
const rsB = L.deriveLook(...asObj(rose, bone), { mode: 'invert', wells: 'inked', trim: 'auto' })
t('dark and invert diverge on a light ink', rsA.g !== rsB.g)

// THE SWEEP: legal pairs × all axis combos → floor + stage guarantee
const MODES = ['follow', 'dark', 'invert'], WELLS = ['inked', 'neutral'], TRIMS = ['auto', 'gold', 'accent']
let combos = 0, bad = 0, stageBad = 0
for (const P of PAPERS) for (const I of INKS) {
  if (contrastRatio(I.ink, P.paper) < 2.0) continue      // the flyout's floor forbids the pair
  for (const mode of MODES) for (const wells of WELLS) for (const trim of TRIMS) {
    combos++
    const d = L.deriveLook(...asObj(I, P), { mode, wells, trim })
    if (con(d.t, d.g) < 2.0) bad++
    if (con(d.cardT, d.cardBg) < 2.0) bad++
    if (con(d.trim, d.cardBg) < 2.0) bad++
    if (mode === 'dark' && !d.groundDark) stageBad++
  }
}
t(`SWEEP: all ${combos} legal-pair axis combos clear the 2.0 floor on text, card text, and trim (violations: ${bad})`,
  bad === 0 && combos === 55 * 18)
t('SWEEP: dark mode keeps a dark ground on every legal pair (the Stage promise)', stageBad === 0)

// the well-surface family (July 4, the wash migration)
t('control: modal gradient = cardBg warmed by accent, driven to the pole',
  ctrl.modalG1 === 'rgb(40,29,27)' && ctrl.modalG2 === 'rgb(18,13,12)')
t('control: scrim, band, ember, dots all emitted as rgba literals',
  /^rgba\(/.test(ctrl.scrim) && /^rgba\(/.test(ctrl.band)
  && /^rgba\(/.test(ctrl.headerEmber) && ctrl.dots === 'rgba(0,0,0,0.3)')
let modalBad = 0, dotsBad = 0
for (const P of PAPERS) for (const I of INKS) {
  if (contrastRatio(I.ink, P.paper) < 2.0) continue
  for (const mode of MODES) for (const wells of WELLS) for (const trim of TRIMS) {
    const d = L.deriveLook(...asObj(I, P), { mode, wells, trim })
    // modal text + accent voice legible over BOTH gradient stops
    if (con(d.cardT, d.modalG1) < 2.0 || con(d.cardT, d.modalG2) < 2.0) modalBad++
    if (con(d.accOnModal, d.modalG1) < 2.0 || con(d.accOnModal, d.modalG2) < 2.0) modalBad++
    // halftone dots soften on light wells
    const cardLum = lumCss(d.cardBg)
    if (cardLum >= 0.35 && d.dots !== 'rgba(0,0,0,0.08)') dotsBad++
    if (cardLum < 0.35 && d.dots !== 'rgba(0,0,0,0.3)') dotsBad++
  }
}
t(`SWEEP: modal text and accent-on-modal clear the 2.0 floor over both gradient stops (violations: ${modalBad})`, modalBad === 0)
t('SWEEP: halftone dots follow well polarity on every combo', dotsBad === 0)

// applyToRoot / clearRoot — the beta toggle's two directions
const html = dom.window.document.documentElement
L.applyToRoot(ctrl)
t('applyToRoot writes the theme token names inline',
  html.style.getPropertyValue('--ink') === ctrl.g
  && html.style.getPropertyValue('--parchment') === ctrl.t
  && html.style.getPropertyValue('--gold') === ctrl.acc
  && html.style.getPropertyValue('--bubble-bg') === ctrl.cardBg
  && html.style.getPropertyValue('--noise-opacity') === '0.15'
  && html.getAttribute('data-look-polarity') === 'light')
t('fixed semantics are never written', html.style.getPropertyValue('--hp-good') === ''
  && html.style.getPropertyValue('--prof-color') === '' && html.style.getPropertyValue('--crit-color') === '')
t('applyToRoot writes the well-surface family to --look-* names',
  html.style.getPropertyValue('--look-card-bg') === ctrl.cardBg
  && html.style.getPropertyValue('--look-well') === ctrl.well
  && html.style.getPropertyValue('--look-trim') === ctrl.trim
  && html.style.getPropertyValue('--look-modal-g1') === ctrl.modalG1
  && html.style.getPropertyValue('--look-modal-g2') === ctrl.modalG2
  && html.style.getPropertyValue('--look-scrim') === ctrl.scrim
  && html.style.getPropertyValue('--look-header-ember') === ctrl.headerEmber
  && html.style.getPropertyValue('--look-dots') === ctrl.dots)
L.clearRoot()
t('clearRoot removes every token and the polarity attribute',
  html.style.getPropertyValue('--ink') === '' && html.style.getPropertyValue('--gold') === ''
  && html.style.getPropertyValue('--look-card-bg') === '' && html.style.getPropertyValue('--look-scrim') === ''
  && !html.hasAttribute('data-look-polarity') && !L.isApplied())

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
