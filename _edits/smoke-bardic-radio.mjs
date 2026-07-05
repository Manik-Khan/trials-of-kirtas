// smoke-bardic-radio.mjs — wave B: the broadcast. The pure sync math
// (bestOffset / positionAt / driftNudge) runs REAL from bardic-radio.js —
// the same functions radio.html schedules against. Supabase Realtime is
// stubbed at the sb.channel surface (the platform); the anchor message
// shape is asserted against what the engine actually builds.
//
//   npm i @babel/parser   (dev-only)
//   node _edits/smoke-bardic-radio.mjs      (from repo root)
//
import { readFileSync } from 'node:fs'
import { parse } from '@babel/parser'

const radioSrc = readFileSync('bardic-radio.js', 'utf8')
const appSrc = readFileSync('bardic-app.jsx', 'utf8')
const busSrc = readFileSync('bardic-bus.js', 'utf8')
const tabSrc = readFileSync('bardic-tab.js', 'utf8')
const pageSrc = readFileSync('radio.html', 'utf8')
const timeSrc = readFileSync('netlify/functions/time.js', 'utf8')
const consoleSrc = readFileSync('bardic-console.html', 'utf8')

let pass = 0, fail = 0
const t = (n, c) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n)) }
console.log('smoke-bardic-radio')

// ── load the real module over a stub window ──
const win = { addEventListener() {}, location: {} }
win.window = win
new Function('window', 'fetch', radioSrc)(win, () => Promise.reject(new Error('no net in harness')))
const R = win.BardicRadio, C = win.BardicClock
t('module exposes clock + radio + pure helpers',
  !!R && !!C && ['bestOffset', 'positionAt', 'driftNudge', 'broadcast', 'listen'].every(k => typeof R[k] === 'function'))
t('channel name + unique-engine prefix', R.CHANNEL === 'bardic-radio' && R.ENGINE_PREFIX === 'engine-' && typeof R.watch === 'function')

// ── the clock math: min-RTT filter (NTP's trick) ──
// three samples: slow+skewed, FAST+clean, slow+skewed — must pick the fast one
const samples = [
  { server: 1000_500, t0: 1000_000, t1: 1000_400 },   // rtt 400
  { server: 1000_110, t0: 1000_000, t1: 1000_060 },   // rtt 60  ← best
  { server: 1000_800, t0: 1000_000, t1: 1000_900 },   // rtt 900
]
const best = R.bestOffset(samples)
t('min-RTT filter picks the fastest sample', best.rtt === 60)
t('offset math: server + rtt/2 − t1', best.offset === 1000_110 + 30 - 1000_060)
t('no samples → null (never throws)', R.bestOffset([]) === null)

// ── position math ──
const anchor = { pos: 100, at: 50_000, paused: false }
t('positionAt advances with shared time', R.positionAt(anchor, 62_000) === 112)
t('positionAt frozen while paused', R.positionAt({ ...anchor, paused: true }, 99_000) === 100)
t('positionAt never rewinds on clock jitter', R.positionAt(anchor, 49_000) === 100)

// ── drift math ──
t('inside deadband → locked at rate 1', R.driftNudge(0.02).rate === 1 && !R.driftNudge(0.02).seek)
t('small drift → gentle nudge, capped ±2%',
  R.driftNudge(0.3).rate > 1 && R.driftNudge(0.3).rate <= 1.02 &&
  R.driftNudge(-0.3).rate < 1 && R.driftNudge(-0.3).rate >= 0.98)
t('FIELD PIN: 1136ms seeks immediately (hard limit 0.35s, no more crawling)',
  R.driftNudge(1.136).seek && R.driftNudge(0.5).seek && R.driftNudge(-0.5).seek && !R.driftNudge(0.3).seek)

// ── transport over a stubbed sb ──
function stubSb() {
  const channels = []
  return {
    channels,
    channel(name, cfg) {
      const handlers = {}
      const ch = {
        name, cfg, tracked: null, sent: [],
        on(type, filter, fn) { handlers[type + ':' + (filter.event || '')] = fn; return ch },
        subscribe(fn) { ch._sub = fn; return ch },   // tests fire _sub after arranging presence
        track(meta) { ch.tracked = meta },
        send(msg) { ch.sent.push(msg) },
        presenceState: () => ch._presence || {},
        _handlers: handlers,
      }
      channels.push(ch)
      return ch
    },
    removeChannel(ch) { ch.removed = true },
  }
}

// engine side
const sbE = stubSb()
let roster = null
const eng = R.broadcast(sbE, { onListeners: l => { roster = l } })
const chE = sbE.channels[0]
chE._presence = {}
chE._sub('SUBSCRIBED')   // empty room → this engine takes the air
t('engine joins with a UNIQUE key and engine-flagged meta',
  chE.name === 'bardic-radio' && chE.cfg.config.presence.key.startsWith('engine-') && chE.tracked?.engine === true)
eng.sendAnchors({ at: 123, channels: { music: { url: 'u', pos: 1 } } })
t('sendAnchors → broadcast event anchors',
  chE.sent.length === 1 && chE.sent[0].type === 'broadcast' && chE.sent[0].event === 'anchors' && chE.sent[0].payload.at === 123)
// engine answers sync-requests (convergence)
let askedFor = 0
const sbE3 = stubSb()
const eng3 = R.broadcast(sbE3, { onSyncRequest: () => { askedFor++ } })
const chE3 = sbE3.channels[0]
chE3._presence = {}; chE3._sub('SUBSCRIBED')
chE3._handlers['broadcast:sync-request']({})
t('engine answers sync-request when active', askedFor === 1)
// pre-join sends buffer and flush on SUBSCRIBED — never dropped
const sbE4 = stubSb()
const eng4 = R.broadcast(sbE4, {})
const chE4 = sbE4.channels[0]
eng4.sendAnchors({ at: 77, channels: {} })   // before SUBSCRIBED
t('pre-join anchors buffered, not dropped', chE4.sent.length === 0)
chE4._presence = {}; chE4._sub('SUBSCRIBED')
t('buffered anchors flush on join', chE4.sent.length === 1 && chE4.sent[0].payload.at === 77)
chE._presence = { [chE.cfg.config.presence.key]: [{ engine: true, name: 'the console' }], 'l-abc': [{ name: 'Cosmere', syncMs: 18 }] }
chE._handlers['presence:sync']()
t('roster excludes engine metas, carries name + syncMs',
  roster.length === 1 && roster[0].name === 'Cosmere' && roster[0].syncMs === 18)
eng.offAir()
t('offAir removes the channel', chE.removed === true)

// TWO-CONSOLES REGRESSION (July 5): a second engine finds the incumbent
// and yields — onConflict fires, no track, anchors go nowhere
const sbE2 = stubSb()
let conflictName = null
const eng2 = R.broadcast(sbE2, { onConflict: n => { conflictName = n } })
const chE2 = sbE2.channels[0]
chE2._presence = { 'engine-incumbent': [{ engine: true, name: 'the console' }] }
chE2._sub('SUBSCRIBED')
eng2.sendAnchors({ at: 1, channels: {} })
t('second engine yields: onConflict(name), never tracks',
  conflictName === 'the console' && chE2.tracked === null && !eng2.isActive())
t('yielded engine sends no anchors', chE2.sent.length === 0)

// the WATCHER: passive cross-device on-air peek (the phone's rail)
const sbW = stubSb()
let watched = null
R.watch(sbW, { onAir: (on, name, count) => { watched = { on, name, count } } })
const chW = sbW.channels[0]
chW._presence = { 'engine-xyz': [{ engine: true, name: 'the console' }], 'l-1': [{ name: 'Caim' }], 'l-2': [{ name: 'Cosmere' }] }
chW._handlers['presence:sync']()
t('watcher reports on-air + engine name + listener count (engines excluded)',
  watched?.on === true && watched.name === 'the console' && watched.count === 2)
t('watcher never tracks presence (purely passive)', chW.tracked === null)
t('watcher carries a presence key (presenceState stays live) — the blind-phone fix',
  chW.cfg.config.presence && chW.cfg.config.presence.key.startsWith('w-'))
chW._presence = { 'l-1': [{ name: 'Caim' }] }
chW._handlers['presence:sync']()
t('watcher reports off-air when the engine leaves', watched.on === false)
// anchors count as proof of broadcast even when presence is coy
chW._handlers['broadcast:anchors']({})
t('watcher: flowing anchors → on-air, even with empty presence', watched.on === true)

// listener side
const sbL = stubSb()
let gotAnchors = null, engineOn = null
const lis = R.listen(sbL, { key: 'l-x', name: 'Caim' }, {
  onAnchors: a => { gotAnchors = a }, onEngine: on => { engineOn = on },
})
const chL = sbL.channels[0]
chL._presence = {}
chL._sub('SUBSCRIBED')
chL._handlers['broadcast:anchors']({ payload: { at: 9, channels: {} } })
t('listener receives anchors', gotAnchors?.at === 9)
chL._presence = { 'engine-abc': [{ engine: true, name: 'the console' }] }; chL._handlers['presence:sync']()
t('listener sees the engine via presence (flagged meta, any key)', engineOn === true)
lis.updateSync(21)
t('updateSync re-tracks presence meta', chL.tracked.syncMs === 21 && chL.tracked.name === 'Caim')
lis.requestSync()
t('listener can request anchors', chL.sent.some(m => m.event === 'sync-request'))

// ── the engine relay in bardic-app.jsx ──
try { parse(appSrc, { sourceType: 'script', plugins: ['jsx'] }); t('bardic-app.jsx parses clean', true) }
catch (e) { t('bardic-app.jsx parses: ' + e.message, false) }
t('anchors omit sonus/YT channels (cannot hold clock lock)',
  /buildAnchors[\s\S]*?if \(!s \|\| !s\.track \|\| s\.sourceType === 'sonus'\) return;/.test(appSrc))
t('anchors stamped with the SHARED clock, not the wall clock',
  appSrc.includes('window.BardicClock ? window.BardicClock.now() : Date.now()'))
t('re-anchor on every state change while on air',
  appSrc.includes('if (onAir) radioRef.current?.sendAnchors(buildAnchors());'))
t('periodic re-anchor (10s) against engine-side drift',
  appSrc.includes('setInterval(() => radioRef.current?.sendAnchors(buildAnchors()), 10000)'))
t("air verb wired: header, adapter case, setOnAir",
  busSrc.includes("{ t:'air', on }") && appSrc.includes("case 'air':    verbs.air(!!msg.on); break;"))
t('anchors stamped with engineId (listener latch)', appSrc.includes('return { at, engineId: engineIdRef.current, channels };'))
t('on-air conflict → blocked state, never two engines',
  appSrc.includes('onConflict: (name) => {') && appSrc.includes('setAirBlockedBy(name); setOnAir(false);')
  && appSrc.includes('airBlockedBy: radioStateRef.current.blockedBy,'))
t('snapshot carries real onAir + listeners (via the stable ref)',
  appSrc.includes('onAir: radioStateRef.current.onAir,') && appSrc.includes('listeners: radioStateRef.current.listeners,'))
t('console loads bardic-radio.js after the bus',
  consoleSrc.indexOf('bardic-radio.js') > consoleSrc.indexOf('bardic-bus.js'))

// ── the rail's broadcast section ──
t('rail: On Air button sends the air verb with the inverse state',
  tabSrc.includes("S.bus.send({ t: 'air', on: !on });"))
t('rail: listener roster renders name + \u00b1ms',
  tabSrc.includes("'\\u00b1' + Math.round(ls[li].syncMs) + 'ms'"))
t('rail: chip announces ON AIR', tabSrc.includes("S.snap.onAir ? 'ON AIR \\u00b7 '"))
t('rail: cross-device watcher wired, guarded off console/radio pages',
  tabSrc.includes('function startWatcher()') && tabSrc.includes('if (ON_CONSOLE || ON_RADIO) return;')
  && tabSrc.includes('window.BardicRadio.watch(sb, {'))
t('rail: remote broadcast → Tune In leads, Light demoted to secondary',
  tabSrc.includes("location.href = 'radio.html';")
  && tabSrc.includes("R.tunein.style.display = (!S.engineLive && S.remote.on && !ON_RADIO) ? 'block' : 'none';"))
t('rail: blocked state surfaces the incumbent by name',
  tabSrc.includes("'blocked \\u00b7 ' + S.snap.airBlockedBy + ' is on air'"))

// ── the radio page ──
t('radio.html rides the pure helpers, no local sync math',
  pageSrc.includes('R.positionAt(') && pageSrc.includes('R.driftNudge(') && !/function positionAt|function driftNudge/.test(pageSrc))
t('tune-in is the gesture: clock sync + sb ready ride the tap',
  pageSrc.includes('Promise.all([C.sync(), sbReady()])'))
t('seek waits for metadata (iOS ignores pre-metadata currentTime)',
  pageSrc.includes("p.audio.addEventListener('loadedmetadata', seekWhenReady, { once: true })")
  && pageSrc.includes("p.audio.addEventListener('playing', seekWhenReady, { once: true })"))
t('drift loop skips elements without metadata', pageSrc.includes('if (p.audio.readyState < 1) continue;'))
t('listener requests anchors on join and on staleness (self-healing)',
  pageSrc.includes('S.listener.requestSync();   // never wait')
  && pageSrc.includes('age > 12000 && age < 35000) S.listener.requestSync();'))
t('anchor-age readout for field diagnosis', pageSrc.includes("'last anchor ' + Math.round(age / 1000) + 's ago'"))
t('hard resync only past the threshold; playbackRate carries the nudge',
  pageSrc.includes('if (n.seek) p.audio.currentTime = expected;') && pageSrc.includes('p.audio.playbackRate = n.rate;'))
t('engine answers sync-requests through the app relay',
  appSrc.includes('onSyncRequest: () => radioRef.current?.sendAnchors(buildAnchors()),'))
t('busSnapshot identity-stable (radio state via ref — no bus teardown flap)',
  appSrc.includes('radioStateRef.current = { onAir, listeners: radioListeners, blockedBy: airBlockedBy };')
  && appSrc.includes('}, []);   // identity-stable: radio state rides radioStateRef'))
t('off-air watchdog on stale anchors + latch release',
  pageSrc.includes("> 35000) { setOnAirUi(false); S.engineLock = null; }"))
t('listener latches to ONE engine clock',
  pageSrc.includes('payload.engineId !== S.engineLock) return;'))
t('wake lock requested and re-grabbed on visibility',
  pageSrc.includes("navigator.wakeLock.request('screen')"))
t('page loads bardic-radio.js and nav.js', pageSrc.includes('src="bardic-radio.js"') && pageSrc.includes('src="nav.js"'))

// ── the time function ──
t('time function: GET-only, no-store, pure Date.now()',
  timeSrc.includes("'Cache-Control': 'no-store'") && timeSrc.includes('now: Date.now()') && timeSrc.includes("'GET only'"))

console.log(`\n${pass}/${pass + fail} passed`)
process.exit(fail ? 1 : 0)
