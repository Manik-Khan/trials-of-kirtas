// smoke-settings-flyout.mjs — the ◐ Settings flyout under jsdom, plus the
// SYNC GUARD: the catalog in settings-flyout.js (a classic script) is a
// mirror of journal/src/shelf/shelfTheme.js (an ES module it cannot
// import). This smoke imports the real module, extracts the mirror from the
// live script's window globals… no — the catalog is IIFE-scoped, so the
// guard drives the RENDERED DOM instead: every dot's color must match the
// module's catalog, in order. Drift fails here before it ships.
//
// The script is loaded as a REAL <script> under runScripts:'dangerously'
// (pinned lesson 4: indirect eval scopes let/const to the eval call).
// Successor to smoke-nav-cog-flyout.mjs (retired with the cog itself).
import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'
import {
  INKS, PAPERS, FLOOR, DEFAULT_LOOK, contrastRatio, isFloored,
  nearestLegibleInk, resolveLookFor,
} from './journal/src/shelf/shelfTheme.js'

const flyoutSrc = readFileSync(new URL('./settings-flyout.js', import.meta.url), 'utf8')
const deriveSrc = readFileSync(new URL('./look-derive.js', import.meta.url), 'utf8')

let pass = 0, fail = 0
const t = (n, c) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n)) }

console.log('smoke-settings-flyout')

// ── the harness page: a fake nav (◐ button) + stubbed __tok/supabase ──
const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>
  <nav id="site-nav"><button class="nav-theme-btn" aria-expanded="false">◐</button></nav>
</body></html>`, {
  url: 'https://tok.test/journal.html',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
})
const { window } = dom
const { document } = window

// supabase stub: records the RPC payloads, serves a canned appearance row
const rpcCalls = []
const serverAppearance = { accent: '#c96f6f', background: 'bg-keep-me', ink: 'sepia', paper: 'straw' }
window.__tok = {
  sb: {
    from() {
      return { select() { return { eq() { return { maybeSingle: async () => ({ data: { appearance: serverAppearance }, error: null }) } } } } }
    },
    rpc: async (name, args) => { rpcCalls.push({ name, args }); return { data: null, error: null } },
  },
  session: { user: { id: 'uid-test' } },
  ready: Promise.resolve({ role: 'player' }),
}

// capture tok:look announcements
const looks = []
document.addEventListener('tok:look', e => looks.push(e.detail))

// load the flyout as a REAL script (lesson 4) — deliberately WITHOUT
// look-derive.js: this first harness proves the degrade path (no TokLook →
// the Finish section stays hidden, everything else behaves as the previous
// deploy; never a hole). A second harness below loads BOTH.
const s = document.createElement('script')
s.textContent = flyoutSrc
document.body.appendChild(s)
await new Promise(r => setTimeout(r, 50))

const $ = sel => document.querySelector(sel)
const $$ = sel => [...document.querySelectorAll(sel)]

// ── boot ──
t('the flyout builds eagerly, closed', !!$('#tok-settings') && !$('#tok-settings').classList.contains('is-open'))
t('TokSettings rides window', typeof window.TokSettings?.toggle === 'function')
t('boot announced tok:look (cache first, profile after)', looks.length >= 2)
const last = looks[looks.length - 1]
t('the profile look wins: effective is Sepia on Straw for this page',
  last.effective.ink === 'sepia' && last.effective.paper === 'straw' && last.page === 'journal')

// ── the July 3 hardening, pinned ──
const sheet = document.getElementById('tokset-styles').textContent
t('no color-mix anywhere in the stylesheet (a fragile expression inside a',
  !sheet.includes('color-mix'))
t('every rule is armored with the #tok-settings ID',
  sheet.split('}').filter(r => r.trim() && r.includes('{')).every(r => {
    const sel = r.slice(0, r.indexOf('{')).trim()
    return sel.startsWith('#tok-settings') || sel.startsWith('.ts-toast')
  }))
const fly = document.getElementById('tok-settings')
t('derived tones arrive as rgba()/rgb() literals computed in JS',
  /^rgba\(/.test(fly.style.getPropertyValue('--ts-hairline'))
  && /^rgb\(/.test(fly.style.getPropertyValue('--ts-faint'))
  && /^rgb\(/.test(fly.style.getPropertyValue('--ts-soft'))
  && /^rgba\(/.test(fly.style.getPropertyValue('--ts-wash')))

// ── open ──
window.TokSettings.open()
await new Promise(r => setTimeout(r, 10))
t('◐ opens the flyout, aria follows', $('#tok-settings').classList.contains('is-open')
  && $('.nav-theme-btn').getAttribute('aria-expanded') === 'true')

// ── THE SYNC GUARD: rendered dots must equal the module's catalog ──
const inkDots = $$('#ts-inks .ts-dot')
const paperDots = $$('#ts-papers .ts-dot')
t('ten ink dots, ten paper dots', inkDots.length === INKS.length && paperDots.length === PAPERS.length)
t('SYNC: every ink dot matches shelfTheme.js, in order',
  inkDots.every((d, i) => d.style.background.length > 0 && hexEq(d.style.background, INKS[i].ink)))
t('SYNC: every paper dot matches shelfTheme.js, in order',
  paperDots.every((d, i) => hexEq(d.style.background, PAPERS[i].paper)))
t('SYNC: dark papers are titled (dark), matching the module polarity',
  paperDots.every((d, i) => d.title.includes('(dark)') === (PAPERS[i].polarity === 'dark')))

function hexEq(rgb, hex) {
  // jsdom serializes style.background as rgb(r, g, b)
  const m = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (!m) return rgb.toLowerCase() === hex.toLowerCase()
  const n = parseInt(hex.slice(1), 16)
  return +m[1] === (n >> 16 & 255) && +m[2] === (n >> 8 & 255) && +m[3] === (n & 255)
}

// ── the floor, live (2.0 — matches the module) ──
const flooredNow = inkDots.filter(d => d.classList.contains('is-floored'))
const expectFloored = INKS.filter(i => isFloored(i.key, 'straw')).length
t('floored dots in the DOM match the module math on the current paper',
  flooredNow.length === expectFloored && flooredNow.every(d => d.disabled))
t('the module floor is 2.0 and Rose clears Bone', FLOOR === 2.0 && !isFloored('rose', 'bone'))

// ── an ink pick: persistence shape (the replace-not-merge idiom) ──
rpcCalls.length = 0
const indigoDot = inkDots.find(d => d.title === 'Ink: Indigo')
indigoDot.click()
await new Promise(r => setTimeout(r, 350))   // debounce is 250ms
t('an ink pick announces the new effective look',
  looks[looks.length - 1].effective.ink === 'indigo')
t('set_my_appearance received the WHOLE object (unknown keys survive)',
  rpcCalls.length === 1 && rpcCalls[0].name === 'set_my_appearance'
  && rpcCalls[0].args.p_appearance.background === 'bg-keep-me'
  && rpcCalls[0].args.p_appearance.ink === 'indigo'
  && rpcCalls[0].args.p_appearance.paper === 'straw'
  && rpcCalls[0].args.p_appearance.accent === '#c96f6f')
t('the localStorage mirror follows', JSON.parse(window.localStorage.getItem('tok-look-cache')).ink === 'indigo')

// ── the stranding nudge ──
const charcoalDot = $$('#ts-papers .ts-dot').find(d => d.title.includes('Charcoal'))
charcoalDot.click()
await new Promise(r => setTimeout(r, 10))
const eff = looks[looks.length - 1].effective
t('a dark paper that strands the ink nudges to the highest-contrast ink',
  eff.paper === 'charcoal' && eff.ink === nearestLegibleInk('charcoal').key)
t('the flyout itself flips polarity', $('#tok-settings').getAttribute('data-polarity') === 'dark')

// ── per-page scope ──
const pageBtn = $$('.ts-scope-btn').find(b => b.dataset.scope === 'page')
pageBtn.click()
await new Promise(r => setTimeout(r, 10))
const roseDot = $$('#ts-inks .ts-dot').find(d => d.title.includes('Rose'))
roseDot.click()
await new Promise(r => setTimeout(r, 350))
const merged = rpcCalls[rpcCalls.length - 1].args.p_appearance
// (the Charcoal click above ran in ALL scope and nudged the DEFAULT ink to
// bonewhite — that is now the cascading default this override sits over)
t('a page-scope pick writes pageLooks.journal, never the default',
  merged.pageLooks && merged.pageLooks.journal && merged.pageLooks.journal.ink === 'rose'
  && merged.ink === 'bonewhite')
t('resolveLookFor agrees: journal sees rose, other pages see the default',
  resolveLookFor(merged, 'journal').ink === 'rose'
  && resolveLookFor(merged, 'party').ink === 'bonewhite')
t('the override chip renders with a clear ×', $$('#ts-ochips .ts-ochip').length === 1)

// clearing the override falls back
$('#ts-ochips .ts-ochip button').click()
await new Promise(r => setTimeout(r, 10))
t('clearing the override falls back to the default look, scope to Everywhere',
  looks[looks.length - 1].effective.ink === 'bonewhite'
  && looks[looks.length - 1].effective.paper === 'charcoal'
  && $$('.ts-scope-btn').find(b => b.dataset.scope === 'all').classList.contains('is-on'))

// ── presets ──
t('three house chips, five archive chips (the old themes)',
  $$('#ts-house .ts-preset').length === 3 && $$('#ts-arch .ts-preset').length === 5)
const phantom = $$('#ts-arch .ts-preset').find(p => p.textContent.trim() === 'Phantom')
phantom.click()
await new Promise(r => setTimeout(r, 10))
t('the Phantom chip restores Sumi on Bone',
  looks[looks.length - 1].effective.ink === 'sumi' && looks[looks.length - 1].effective.paper === 'bone')

$('#ts-savename').value = 'My Look'
$('#ts-savebtn').click()
await new Promise(r => setTimeout(r, 350))
t('save-as appends to lookPresets and persists',
  rpcCalls[rpcCalls.length - 1].args.p_appearance.lookPresets.some(p => p.name === 'My Look'))
t('the personal chip renders with ×; house chips carry none',
  $$('#ts-mine .ts-preset .del').length === 1 && $$('#ts-house .ts-preset .del').length === 0)

// ── seat accent ──
$$('#ts-accents .ts-dot')[1].click()
await new Promise(r => setTimeout(r, 350))
t('an accent pick persists through the same full-merge',
  rpcCalls[rpcCalls.length - 1].args.p_appearance.accent === '#9d7bd8'
  && rpcCalls[rpcCalls.length - 1].args.p_appearance.background === 'bg-keep-me')

// ── the absorbed cog ──
// this harness page has no appearance wiring: the Sheet section shows an
// honest POINTER to the character sheet, never an empty hole (July 3, M)
t('unwired page: the Sheet pointer shows, the appearance row hides',
  !$('#ts-sheet-pointer').hidden && $('#ts-row-appearance').hidden
  && $('#ts-sheet-pointer').getAttribute('href') === 'sheet-v2.html')
let mounted = 0
window.AppearanceUI = { mount: () => { mounted++ } }
$('#ts-row-appearance').hidden = false   // as maybeShowSheet's retimer would
$('#ts-row-appearance').click()
await new Promise(r => setTimeout(r, 10))
t('the Sheet row mounts AppearanceUI into the hosted #appearance-drawer',
  mounted === 1 && !!$('#tok-settings #appearance-drawer')
  && $('#ts-sheet-drawer').classList.contains('open'))
t('the #tokset-extra slot exists for battle.js', !!$('#tokset-extra'))

// ── close ──
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
await new Promise(r => setTimeout(r, 10))
t('Esc closes; aria follows', !$('#tok-settings').classList.contains('is-open')
  && $('.nav-theme-btn').getAttribute('aria-expanded') === 'false')

t('degrade path: without TokLook the Finish section stays hidden, never a hole',
  $('#ts-fin-sec').hidden === true)

// ════════════════════════════════════════════════════════════════════
// SECOND HARNESS — look-derive.js + settings-flyout.js together:
// the finish gallery, the fine-tune drawer, style persistence, and the
// site-wide opt-in (apply + rollback), July 4.
// ════════════════════════════════════════════════════════════════════
console.log('\nsmoke-settings-flyout · with look-derive')
const dom2 = new JSDOM(`<!DOCTYPE html><html><head></head><body>
  <nav id="site-nav"><button class="nav-theme-btn" aria-expanded="false">◐</button></nav>
</body></html>`, { url: 'https://tok.test/factions.html', runScripts: 'dangerously', pretendToBeVisual: true })
const w2 = dom2.window, d2 = w2.document
const rpc2 = []
w2.__tok = {
  sb: {
    from() { return { select() { return { eq() { return { maybeSingle: async () => ({ data: { appearance: { background: 'bg-keep-me' } }, error: null }) } } } } } },
    rpc: async (name, args) => { rpc2.push({ name, args }); return { data: null, error: null } },
  },
  session: { user: { id: 'uid-test' } },
  ready: Promise.resolve({ role: 'player' }),
}
const looks2 = []
d2.addEventListener('tok:look', e => looks2.push(e.detail))
for (const code of [deriveSrc, flyoutSrc]) {
  const sc = d2.createElement('script'); sc.textContent = code; d2.body.appendChild(sc)
}
await new Promise(r => setTimeout(r, 60))
const q = sel => d2.querySelector(sel)
const qq = sel => [...d2.querySelectorAll(sel)]

w2.TokSettings.open()
await new Promise(r => setTimeout(r, 10))
t('with TokLook: the Finish section shows five live thumbnails',
  !q('#ts-fin-sec').hidden && qq('#ts-fins .ts-fin').length === 5
  && qq('#ts-fins .ts-fin .th').every(th => th.style.background.startsWith('rgb(')))
t('tok:look now carries the style axes (additive; journal unaffected)',
  looks2.length > 0 && looks2[looks2.length - 1].effective.mode === 'follow'
  && looks2[looks2.length - 1].effective.wells === 'inked'
  && looks2[looks2.length - 1].effective.trim === 'auto')
t('the flyout stylesheet is STILL color-mix-free and fully ID-armored',
  !d2.getElementById('tokset-styles').textContent.includes('color-mix')
  && d2.getElementById('tokset-styles').textContent.split('}').filter(r => r.trim() && r.includes('{')).every(r => {
    const sel = r.slice(0, r.indexOf('{')).trim()
    return sel.startsWith('#tok-settings') || sel.startsWith('.ts-toast')
  }))

// picking Print persists the axes through the same replace-not-merge
rpc2.length = 0
qq('#ts-fins .ts-fin').find(f => f.dataset.fin === 'print').click()
await new Promise(r => setTimeout(r, 350))
t('picking Print persists pageMode/wells/trim, unknown keys survive',
  rpc2.length === 1 && rpc2[0].args.p_appearance.pageMode === 'follow'
  && rpc2[0].args.p_appearance.wells === 'neutral' && rpc2[0].args.p_appearance.trim === 'gold'
  && rpc2[0].args.p_appearance.background === 'bg-keep-me')
t('Print re-lights as the selected finish',
  qq('#ts-fins .ts-fin').find(f => f.dataset.fin === 'print').classList.contains('is-on'))

// fine-tune: drawer opens; an axis edit away from Print goes Custom; back re-lights
q('#ts-tune-head').click()
t('the Fine-tune drawer opens', q('#ts-tune').classList.contains('open'))
qq('#ts-vtrim .ts-vchip').find(c => c.dataset.v === 'auto').click()
await new Promise(r => setTimeout(r, 10))
t('an axis edit away from a finish goes Custom (no finish lit)',
  qq('#ts-fins .ts-fin.is-on').length === 0)
qq('#ts-vtrim .ts-vchip').find(c => c.dataset.v === 'gold').click()
await new Promise(r => setTimeout(r, 10))
t('tuning back into Print re-lights its card',
  qq('#ts-fins .ts-fin.is-on').length === 1
  && q('#ts-fins .ts-fin.is-on').dataset.fin === 'print')
t('fine-tune chips carry mini previews of their own outcomes',
  qq('.ts-vchip .vm').length === 8)

// the site-wide look: ON BY DEFAULT (July 4, M) — a reader who never touches
// the switch gets the feature; only an explicit Off is off
t('site-wide defaults ON: theme tokens on <html> straight from boot',
  q('#ts-replumb').textContent === 'On'
  && d2.documentElement.style.getPropertyValue('--ink').startsWith('rgb(')
  && d2.documentElement.style.getPropertyValue('--gold').startsWith('rgb(')
  && d2.documentElement.getAttribute('data-look-polarity') === 'light')
t('fixed semantics never written', d2.documentElement.style.getPropertyValue('--hp-good') === '')
t('the switch sits at the TOP of Site look (before the ink row)',
  q('.ts-sec[data-sec="look"] .ts-sec-body').firstElementChild.classList.contains('ts-flagrow'))
t('presets live inside Site look now; the standalone section retired',
  !!q('.ts-sec[data-sec="look"] #ts-house') && !q('.ts-sec[data-sec="presets"]'))
q('#ts-replumb').click()
await new Promise(r => setTimeout(r, 10))
t('explicit Off: every token removed — clean rollback to the house theme',
  q('#ts-replumb').textContent === 'Off'
  && d2.documentElement.style.getPropertyValue('--ink') === ''
  && !d2.documentElement.hasAttribute('data-look-polarity'))
// in the OFF state, a pick explains itself — once
qq('#ts-inks .ts-dot').find(dd => dd.title === 'Ink: Forest').click()
await new Promise(r => setTimeout(r, 10))
t('a pick while OFF fires the explain-yourself hint',
  qq('.ts-toast')[0].textContent.includes('Previewing in ◐'))
q('#ts-replumb').click()
await new Promise(r => setTimeout(r, 350))
t('back On: tokens return, and the explicit choice persists (replumb: true)',
  d2.documentElement.style.getPropertyValue('--ink').startsWith('rgb(')
  && rpc2[rpc2.length - 1].args.p_appearance.replumb === true)

// the hint fires ONCE per session: later picks stay quiet
const toastEl2 = qq('.ts-toast')[0]
toastEl2.textContent = 'x'
qq('#ts-inks .ts-dot').find(dd => dd.title === 'Ink: Forest').click()
await new Promise(r => setTimeout(r, 10))
t('the hint fires once per session, not on every pick', toastEl2.textContent === 'x')

// collapsible sections (July 4): closed on open, header expands, remembered
t('all three sections (Site look / Seat accent / Sheet) ship closed',
  qq('.ts-sec[data-sec]').length === 3 && qq('.ts-sec[data-sec] .ts-sec-body.open').length === 0)
const lookSec = q('.ts-sec[data-sec="look"]')
lookSec.querySelector('.ts-sec-head').click()
t('a header click opens its section, caret follows',
  lookSec.querySelector('.ts-sec-body').classList.contains('open')
  && lookSec.querySelector('.ts-sec-head').classList.contains('is-open'))
t('the arrangement is remembered locally',
  JSON.parse(w2.localStorage.getItem('tok-flyout-open')).look === true)

// THE DETACH-CLOSE REGRESSION (July 4, M): a dot click re-renders the row,
// detaching the clicked dot mid-bubble — the flyout must stay open
t('flyout is open before the pick', q('#tok-settings').classList.contains('is-open'))
const pickDot = qq('#ts-inks .ts-dot').find(dd => dd.title === 'Ink: Sepia')
pickDot.dispatchEvent(new w2.MouseEvent('click', { bubbles: true }))
await new Promise(r => setTimeout(r, 10))
t('picking a dot NO LONGER closes the flyout (composedPath survives the re-render)',
  q('#tok-settings').classList.contains('is-open'))
qq('#ts-fins .ts-fin').find(f => f.dataset.fin === 'stage').dispatchEvent(new w2.MouseEvent('click', { bubbles: true }))
await new Promise(r => setTimeout(r, 10))
t('picking a finish keeps it open too — rapid click-through works',
  q('#tok-settings').classList.contains('is-open'))
// a genuine outside click still closes
d2.body.dispatchEvent(new w2.MouseEvent('click', { bubbles: true }))
await new Promise(r => setTimeout(r, 10))
t('a genuine outside click still closes', !q('#tok-settings').classList.contains('is-open'))
w2.TokSettings.open()
await new Promise(r => setTimeout(r, 10))
t('reopened: the Look section stayed open from the remembered arrangement',
  lookSec.querySelector('.ts-sec-body').classList.contains('open'))
// restore Print for the save-as assertions below (the block above moved to Stage)
qq('#ts-fins .ts-fin').find(f => f.dataset.fin === 'print').click()
await new Promise(r => setTimeout(r, 10))

// save-as captures the style; the personal chip restores it
q('#ts-savename').value = 'Gilded Sumi'
q('#ts-savebtn').click()
await new Promise(r => setTimeout(r, 350))
const savedP = rpc2[rpc2.length - 1].args.p_appearance.lookPresets.find(p => p.name === 'Gilded Sumi')
t('save-as captures the finish axes with the look',
  savedP && savedP.pageMode === 'follow' && savedP.wells === 'neutral' && savedP.trim === 'gold')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
