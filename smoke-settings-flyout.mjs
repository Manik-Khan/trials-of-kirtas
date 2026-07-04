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

// load the flyout as a REAL script (lesson 4)
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

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
