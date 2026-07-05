// smoke-bardic-tab.mjs — increment 2: the rail's Bardic tab + chip.
// The seam's contract is parsed from rail.js ITSELF; the platform
// (BroadcastChannel) is stubbed; bardic-bus.js runs REAL, so the
// remote loop below is the actual protocol end to end.
//
//   npm i jsdom   (dev-only)
//   node _edits/smoke-bardic-tab.mjs      (from repo root)
//
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

const tabSrc = readFileSync('bardic-tab.js', 'utf8')
const busSrc = readFileSync('bardic-bus.js', 'utf8')
const railSrc = readFileSync('rail.js', 'utf8')

let pass = 0, fail = 0
const t = (n, c) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n)) }
console.log('smoke-bardic-tab')

// ── the seam's contract, parsed from rail.js itself ──
const specDoc = railSrc.match(/\/\/\s*\{ id, label, icon\(svgString\), order=50, onMount\(paneEl\), onShow\?\(\), onHide\?\(\) \}/)
t('rail.js registerTab spec parsed (id/label/icon/order/onMount/onShow/onHide)', !!specDoc)
t('rail.js show(tab) exists for the chip click', railSrc.includes("show: function (tab) { if (tab) setTab(tab); setOpen(true); }"))
t('rail.js loads bardic-tab.js in the rider slot (characters-tab pattern, guarded)',
  railSrc.includes('window.__tokBardicTab') && railSrc.includes("bt.src = 'bardic-tab.js';"))

// ── DOM world with stubbed platform + stubbed seam ──
class StubBC {
  static registry = {}
  constructor(name) { this.name = name; (StubBC.registry[name] ||= []).push(this) }
  postMessage(data) { for (const p of StubBC.registry[this.name]) if (p !== this && p.onmessage) p.onmessage({ data }) }
  close() { const a = StubBC.registry[this.name]; const i = a.indexOf(this); if (i >= 0) a.splice(i, 1) }
}
const dom = new JSDOM(
  `<!DOCTYPE html><html><head></head><body>
     <div id="tok-rail"><div class="tr-tabs"></div><div class="tr-panes"></div></div>
     <div class="tr-handle"></div>
   </body></html>`,
  { url: 'https://tok.manikkhan.com/party.html', runScripts: 'outside-only' })
const w = dom.window
w.BroadcastChannel = StubBC

// TokRail stub implementing exactly the parsed contract
let registeredSpec = null, shownTab = null
const paneEl = w.document.createElement('section')
w.document.querySelector('.tr-panes').appendChild(paneEl)
w.TokRail = {
  ready: true,
  show: (tab) => { shownTab = tab },
  registerTab: (spec) => {
    registeredSpec = spec
    const btn = w.document.createElement('button')
    btn.setAttribute('data-rail-tab', spec.id)
    w.document.querySelector('.tr-tabs').appendChild(btn)
    spec.onMount(paneEl)
    return { pane: paneEl, button: btn }
  },
}

// run the REAL bus, then the tab
w.eval(busSrc)
w.eval(tabSrc)

// ── a fake engine on the real bus ──
const engine = w.BardicBus.connect('engine')
const engineHeard = []
engine.onMessage(m => {
  engineHeard.push(m)
  if (m.t === 'hello') engine.send(SNAP())
})
const SNAP = () => ({
  t: 'state', engineId: 'eng-test', ts: Date.now(), onAir: false,
  moods: [
    { id: 'm-tavern', name: 'Tavern', color: '#6a4a1a', sigil: 'ti-beer' },
    { id: 'm-battle', name: 'Battle', color: '#8a2a2a', sigil: 'ti-sword' },
    { id: 'm-court',  name: 'Court',  color: '#5a1a2a', sigil: 'ti-crown' },
  ],
  channels: {
    music:    { label: 'Music', accent: '#c9a84c', moodId: 'm-court', moodName: 'Court', trackTitle: 'Strings of the Old Hall', paused: false, volume: 0.7, sourceType: 'mood' },
    ambience: { label: 'Ambience', accent: '#6a8a4a', moodId: null, moodName: null, trackTitle: null, paused: false, volume: 0.5, sourceType: null },
  },
})
// registration + the hello ping happen in a microtask (ensureBus().then) —
// settle before asserting, with the engine already listening.
await new Promise(r => setTimeout(r, 30))

t('tab registered: id bardic, order 30, onMount + onShow present',
  registeredSpec?.id === 'bardic' && registeredSpec.order === 30 &&
  typeof registeredSpec.onMount === 'function' && typeof registeredSpec.onShow === 'function')
t('scoped CSS injected once, ID-prefixed', !!w.document.getElementById('tok-bardic-tab-css') &&
  w.document.getElementById('tok-bardic-tab-css').textContent.startsWith('#tok-rail '))
t('no color-mix / modern color syntax in injected chrome',
  !/color-mix|oklch|lab\(|lch\(/.test(w.document.getElementById('tok-bardic-tab-css').textContent))

t('remote sent hello on connect', engineHeard.some(m => m.t === 'hello'))

t('engine section reads live', paneEl.querySelector('.tok-bd-head').classList.contains('live'))
const rows = paneEl.querySelectorAll('.tok-bd-row')
t('one row per snapshot channel', rows.length === 2)
const musicSel = rows[0].querySelector('.tok-bd-sel')
t('dropdown: silence + all moods, alphabetical, current mood selected',
  [...musicSel.options].map(o => o.textContent).join('|') === '— silence —|Battle|Court|Tavern' && musicSel.value === 'm-court')
t('now-playing renders the track', rows[0].querySelector('.tok-bd-now').textContent === 'Strings of the Old Hall')
t('idle channel reads idle, dropdown on silence',
  rows[1].querySelector('.tok-bd-now').classList.contains('idle') && rows[1].querySelector('.tok-bd-sel').value === '')

// ── verbs out ──
const fire = (el2, type) => el2.dispatchEvent(new w.Event(type, { bubbles: true }))
engineHeard.length = 0
musicSel.value = 'm-battle'; fire(musicSel, 'change')
t('dropdown change → cast{moodId,chId}', engineHeard.some(m => m.t === 'cast' && m.moodId === 'm-battle' && m.chId === 'music'))
musicSel.value = ''; fire(musicSel, 'change')
t('silence → stop{chId}', engineHeard.some(m => m.t === 'stop' && m.chId === 'music'))
engineHeard.length = 0
fire(rows[0].querySelector('.tok-bd-ctl button'), 'click')
t('pause button → toggle{moodId,chId}', engineHeard.some(m => m.t === 'toggle' && m.moodId === 'm-court' && m.chId === 'music'))
fire(rows[0].querySelectorAll('.tok-bd-ctl button')[1], 'click')
t('next button → next{chId}', engineHeard.some(m => m.t === 'next' && m.chId === 'music'))
const vol = rows[0].querySelector('input[type=range]')
vol.value = '0.33'; fire(vol, 'input')
await new Promise(r => setTimeout(r, 150))
t('volume drag → vol{chId,val} (throttled)', engineHeard.some(m => m.t === 'vol' && m.chId === 'music' && Math.abs(m.val - 0.33) < 1e-9))

// ── chip + dots ──
const chip = w.document.getElementById('tok-bardic-chip')
t('chip exists, visible while playing, EQ tinted by channel accent',
  !!chip && !chip.classList.contains('tok-bd-off') && chip.querySelector('.eq i').style.background !== '')
t('chip click → TokRail.show(bardic)', (chip.dispatchEvent(new w.Event('click')), shownTab === 'bardic'))
t('tab live-dot on while playing', w.document.querySelector('[data-rail-tab="bardic"] .tok-bd-dot').classList.contains('on'))

// chip toggle: hide → persists + chip off; ember lights when rail also shut
const tog = paneEl.querySelector('.tok-bd-chiptog')
fire(tog, 'click')
t('chip toggle hides chip + persists tok-bardic-chip',
  chip.classList.contains('tok-bd-off') && w.localStorage.getItem('tok-bardic-chip') === 'hidden')
w.document.getElementById('tok-rail').classList.add('tr-collapsed')
registeredSpec.onShow()   // repaint path
t('handle ember on for playing + hidden + collapsed',
  w.document.querySelector('.tr-handle .tok-bd-ember').classList.contains('on'))
fire(tog, 'click')
t('toggle restores chip', !chip.classList.contains('tok-bd-off') && w.localStorage.getItem('tok-bardic-chip') === 'shown')

// ── engine death paths ──
engine.send({ t: 'engine-bye', engineId: 'eng-test' })
t('engine-bye → offline state, Light the engine visible, channels hidden',
  !paneEl.querySelector('.tok-bd-head').classList.contains('live') &&
  paneEl.querySelector('.tok-bd-light').style.display === 'block' &&
  chip.classList.contains('tok-bd-off'))
// crashed engine: hello ping goes unanswered → offline after the window
engine.close()   // nobody home
registeredSpec.onShow()  // triggers pingEngine
await new Promise(r => setTimeout(r, 1700))
t('unanswered ping (crashed tab) → stays offline', !paneEl.querySelector('.tok-bd-head').classList.contains('live'))

console.log(`\n${pass}/${pass + fail} passed`)
process.exit(fail ? 1 : 0)
