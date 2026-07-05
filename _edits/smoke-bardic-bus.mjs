// smoke-bardic-bus.mjs — increment 1: the bus + the engine adapter.
// The platform (BroadcastChannel) is stubbed; the CONTRACT is parsed
// from bardic-bus.js's own header and source, never restated here.
//
//   npm i @babel/parser jsdom   (dev-only)
//   node _edits/smoke-bardic-bus.mjs      (from repo root)
//
import { readFileSync } from 'node:fs'
import { parse } from '@babel/parser'

const busSrc = readFileSync('bardic-bus.js', 'utf8')
const appSrc = readFileSync('bardic-app.jsx', 'utf8')
const consoleSrc = readFileSync('bardic-console.html', 'utf8')

let pass = 0, fail = 0
const t = (n, c) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n)) }
console.log('smoke-bardic-bus')

// ── syntax ──
try { parse(busSrc, { sourceType: 'script' }); t('bardic-bus.js parses clean', true) }
catch (e) { t('bardic-bus.js parses: ' + e.message, false) }
try { parse(appSrc, { sourceType: 'script', plugins: ['jsx'] }); t('bardic-app.jsx parses clean', true) }
catch (e) { t('bardic-app.jsx parses: ' + e.message, false) }

// ── the contract, parsed from the bus's own header ──
const verbLines = [...busSrc.matchAll(/\{ t:'([a-zA-Z-]+)'/g)].map(m => m[1])
const remoteVerbs = ['hello', 'cast', 'toggle', 'stop', 'next', 'prev', 'vol', 'globalPause']
t(`protocol header names all remote verbs (${remoteVerbs.join(', ')})`,
  remoteVerbs.every(v => verbLines.includes(v)))
t('protocol header names the state snapshot and engine-bye',
  verbLines.includes('state') && verbLines.includes('engine-bye'))

// ── the adapter maps every remote verb from the header ──
const adapterCase = v => new RegExp(`case '${v}':`).test(appSrc)
const unmapped = remoteVerbs.filter(v => !adapterCase(v))
t(`engine adapter handles every header verb (unmapped: ${unmapped.join(',') || 'none'})`, unmapped.length === 0)
t('every verb dispatches through busVerbsRef (fresh callbacks, no stale closures)',
  ['cast', 'toggle', 'stop', 'next', 'prev', 'vol', 'globalPause']
    .every(v => appSrc.includes(`${v}:`)) && appSrc.includes('busVerbsRef.current = {'))
t('hello answered with a full snapshot', appSrc.includes("case 'hello':  bus.send(busSnapshot()); break;"))
t('snapshot publishes on chStates AND library changes',
  /useEffect\(\(\) => \{\s*\n\s*busRef\.current\?\.send\(busSnapshot\(\)\);\s*\n\s*\}, \[chStates, library, busSnapshot\]\);/.test(appSrc))
t('engine-bye on unload, listener removed on teardown',
  appSrc.includes("bus.send({ t: 'engine-bye', engineId: engineIdRef.current })")
  && appSrc.includes("window.removeEventListener('beforeunload', bye)"))
t('snapshot reads through refs (chStatesRef + libraryRef), no stale state',
  appSrc.includes('const lib = libraryRef.current;') && appSrc.includes('const cs  = chStatesRef.current;'))

// ── load order: bus is a plain script, before the JSX ──
const busAt = consoleSrc.indexOf('bardic-bus.js')
t('console loads bardic-bus.js after data, before the JSX',
  busAt > consoleSrc.indexOf('bardic-data.js') && busAt < consoleSrc.indexOf('bardic-components.jsx'))

// ── functional: two riders over a stubbed platform ──
// (stub the PLATFORM, not the contract)
class StubBC {
  static registry = {}
  constructor(name) {
    this.name = name;
    (StubBC.registry[name] ||= []).push(this)
  }
  postMessage(data) {
    for (const peer of StubBC.registry[this.name]) {
      if (peer !== this && peer.onmessage) peer.onmessage({ data })
    }
  }
  close() {
    const arr = StubBC.registry[this.name]
    const i = arr.indexOf(this); if (i >= 0) arr.splice(i, 1)
  }
}
const sandbox = { window: { BroadcastChannel: StubBC } }
sandbox.window.window = sandbox.window
new Function('window', 'BroadcastChannel', busSrc)(sandbox.window, StubBC)
const Bus = sandbox.window.BardicBus

t('window.BardicBus exposed with connect/supported/VERSION',
  !!Bus && typeof Bus.connect === 'function' && Bus.VERSION === 1 && Bus.CHANNEL === 'tok-bardic-bus')

const engine = Bus.connect('engine')
const remote = Bus.connect('remote')
let engineGot = null, remoteGot = null
engine.onMessage(m => { engineGot = m })
remote.onMessage(m => { remoteGot = m })

remote.send({ t: 'hello' })
t('remote → engine: envelope carries v:1 + from:remote', engineGot?.t === 'hello' && engineGot.v === 1 && engineGot.from === 'remote')
engine.send({ t: 'state', engineId: 'eng-test', channels: {} })
t('engine → remote: state snapshot arrives', remoteGot?.t === 'state' && remoteGot.engineId === 'eng-test')

// same-role suppression: a second remote must NOT hear the first
const remote2 = Bus.connect('remote')
let r2got = null; remote2.onMessage(m => { r2got = m })
remote.send({ t: 'vol', chId: 'music', val: 0.4 })
t('same-role suppression: remote2 ignores remote1 traffic; engine hears it',
  r2got === null && engineGot?.t === 'vol' && engineGot.val === 0.4)

// bad envelopes dropped silently
engineGot = null
StubBC.registry['tok-bardic-bus'][0].postMessage({ v: 99, t: 'state' })
remote.send({ notAnEnvelope: true })
t('wrong-version and malformed messages dropped, never thrown', engineGot === null)

const offR = remote.onMessage(() => {})
offR()
engine.close(); remote.close(); remote2.close()
t('close() detaches from the stub registry', StubBC.registry['tok-bardic-bus'].length === 0)

console.log(`\n${pass}/${pass + fail} passed`)
process.exit(fail ? 1 : 0)
