// smoke-character-badge.mjs — the character badge under jsdom.
// Loads look-derive.js + settings-flyout.js + character-badge.js as REAL
// scripts (lesson 4) against a stubbed nav + __tok whose characters query
// serves Vesperian's row (real field shapes: structural.portrait /
// .classLabel / .combat.hpMax, vitals.hp / .hpBonus / .concentration).
// Asserts the ownership contract end to end: the badge DISPATCHES
// tok:accent, the flyout PERSISTS it (replace-not-merge), tok:look
// re-announces with the accent, and the badge repaints from that.
import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'

const read = f => readFileSync(new URL(f, import.meta.url), 'utf8')
const deriveSrc = read('./look-derive.js')
const flyoutSrc = read('./settings-flyout.js')
const badgeSrc = read('./character-badge.js')

let pass = 0, fail = 0
const t = (n, c) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n)) }
console.log('smoke-character-badge')

function harness(role, characterKey) {
  const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>
    <nav id="site-nav"><a href="index.html" class="nav-brand">Kirtas</a>
    <button class="nav-theme-btn" aria-expanded="false">◐</button></nav>
  </body></html>`, { url: 'https://tok.test/party.html', runScripts: 'dangerously', pretendToBeVisual: true })
  const w = dom.window
  const vesperian = {
    key: 'vesperian',
    structural: {
      portrait: 'https://img.test/vesperian.png',
      classLabel: 'ROGUE 5', race: 'Half-Elf', background: 'Charlatan',
      combat: { hpMax: 34 },
    },
    vitals: { hp: 31, hpBonus: 2, hpTemp: 3, concentration: null },
  }
  const rpcCalls = []
  w.__tok = {
    sb: {
      from(table) {
        if (table === 'characters') {
          return { select() { return { eq() { return { maybeSingle: async () => ({ data: vesperian, error: null }) } } } } }
        }
        return { select() { return { eq() { return { maybeSingle: async () => ({ data: { appearance: { background: 'bg-keep-me', accent: '#c96f6f' } }, error: null }) } } } } }
      },
      rpc: async (name, args) => { rpcCalls.push({ name, args }); return { data: null, error: null } },
      auth: { signOut: async () => { w.__signedOut = true } },
    },
    session: { user: { id: 'uid-test' } },
    ready: Promise.resolve(characterKey === undefined ? null : { role, characterKey, displayName: 'M' }),
  }
  // nav.js's static catalog, stubbed at global scope like the real page
  w.CHARACTERS_NAV = [{ key: 'vesperian', label: 'Vesperian', full: 'Vesperian Vale' }]
  for (const code of [deriveSrc, flyoutSrc, badgeSrc]) {
    const s = w.document.createElement('script'); s.textContent = code; w.document.body.appendChild(s)
  }
  return { dom, w, d: w.document, rpcCalls }
}

const wait = ms => new Promise(r => setTimeout(r, ms))
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }))

// ── harness A: a player with Vesperian ──
const A = harness('player', 'vesperian')
await wait(60)
const { w, d, rpcCalls } = A
const q = s => d.querySelector(s), qq = s => [...d.querySelectorAll(s)]

t('brand + badge share ONE flex group (space-between cannot center-drift the badge)',
  q('#tok-brand-wrap') && q('#tok-brand-wrap').parentNode.id === 'site-nav'
  && q('#tok-brand-wrap').children[0] === q('.nav-brand')
  && q('#tok-brand-wrap').children[1] === q('#tok-badge'))
t('medallions crop top-center (faces live in the top of portrait art)',
  d.getElementById('tok-badge-styles').textContent.split('top center/cover').length === 4)
t('the menu starts closed', !q('#tok-badge-menu').classList.contains('is-open'))
t('TokBadge rides window', typeof w.TokBadge?.toggle === 'function')
t('badge styles are ID-armored', d.getElementById('tok-badge-styles').textContent
  .split('}').filter(r => r.trim() && r.includes('{'))
  .every(r => r.slice(0, r.indexOf('{')).trim().startsWith('#tok-badge')))

click(w, q('#tok-badge'))
await wait(30)
t('opening shows the identity: name, epithet line, class', q('#tok-badge-menu').classList.contains('is-open')
  && q('.tb-name').textContent === 'Vesperian Vale'
  && q('.tb-epi').textContent === 'Charlatan' && q('.tb-cls').textContent === 'ROGUE 5')
t('the portrait lands on the SIZED badge button (not the zero-size span) and the header',
  q('#tok-badge').style.backgroundImage.includes('vesperian.png')
  && !q('#tok-badge .tb-init').style.backgroundImage
  && q('#tok-badge .tb-init').textContent === ''
  && q('.tb-port').style.backgroundImage.includes('vesperian.png'))
t('the presence dot survives the portrait paint', !!q('#tok-badge .tb-dot'))
t('vitals glance: 31 / 36 (hpMax 34 + bonus 2), temp chip shows',
  q('.tb-hp-nums').textContent === '31 / 36'
  && q('.tb-conds').textContent.includes('+3 temp'))
t('the sheet link carries the character key',
  q('#tb-sheet').getAttribute('href') === 'sheet-v2.html?character=vesperian')
t('player seat: DM tools hidden, chip reads PLAYER',
  q('.tb-dm').hidden && q('.tb-seatchip').textContent === 'PLAYER')
t('one character: the pinned row, no switcher',
  q('#tb-charlist').textContent.includes('Vesperian Vale')
  && q('#tb-charlist').textContent.includes('YOUR CHARACTER'))

// the accent ownership loop, end to end
t('badge accent booted from the profile via tok:look (flyout announced #c96f6f)',
  qq('.tb-acc.sel').length === 1 && qq('.tb-acc.sel')[0].dataset.hex === '#c96f6f')
rpcCalls.length = 0
click(w, qq('.tb-acc').find(a => a.dataset.hex === '#b8952a'))
await wait(350)
t('a color pick keeps the menu open (composedPath through the re-render)',
  q('#tok-badge-menu').classList.contains('is-open'))
t('the FLYOUT persisted it — one writer, unknown keys survive',
  rpcCalls.length === 1 && rpcCalls[0].name === 'set_my_appearance'
  && rpcCalls[0].args.p_appearance.accent === '#b8952a'
  && rpcCalls[0].args.p_appearance.background === 'bg-keep-me')
t('the badge repainted from the re-announce: ring var + selection follow',
  q('#tok-badge').style.getPropertyValue('--tb-seat') === '#b8952a'
  && qq('.tb-acc.sel')[0].dataset.hex === '#b8952a')

// outside click closes; sign-out signs out
click(w, d.body)
t('a genuine outside click closes', !q('#tok-badge-menu').classList.contains('is-open'))
click(w, q('#tok-badge'))
click(w, q('#tb-out'))
await wait(20)
t('sign out calls auth.signOut and redirects to login', w.__signedOut === true)

// ── harness B: the DM seat ──
const B = harness('dm', 'vesperian')
await wait(60)
click(B.w, B.d.querySelector('#tok-badge'))
await wait(30)
t('DM seat: the DM tools row shows Combat table + Members & access',
  !B.d.querySelector('.tb-dm').hidden
  && [...B.d.querySelectorAll('.tb-dm .tb-item')].length === 2
  && B.d.querySelector('.tb-seatchip').textContent === 'DM')

// ── harness C: a seat with no character bound (overseer without a PC) ──
const C = harness('overseer', null)
await wait(60)
click(C.w, C.d.querySelector('#tok-badge'))
await wait(30)
t('no character: header falls back to displayName, vitals + sheet hidden, honest empty line',
  C.d.querySelector('.tb-name').textContent === 'M'
  && C.d.querySelector('.tb-vitals').style.display === 'none'
  && C.d.querySelector('#tb-sheet').style.display === 'none'
  && C.d.querySelector('#tb-charlist').textContent.includes('No character bound'))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
