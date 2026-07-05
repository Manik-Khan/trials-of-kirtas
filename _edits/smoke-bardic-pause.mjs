// smoke-bardic-pause.mjs — the pause desync (July 5, from live testing).
// Runs the REAL bardic-audio.js over a stubbed platform (AudioContext +
// Audio) and reproduces the exact reported sequence: pause → cast →
// pause again. Before the fix, the second pause was silently ignored
// (stale _paused latch) while the app flipped its own state — UI said
// silent, audio kept flowing.
//
//   node _edits/smoke-bardic-pause.mjs      (from repo root)
//
import { readFileSync } from 'node:fs'

const src = readFileSync('bardic-audio.js', 'utf8')
const wait = ms => new Promise(r => setTimeout(r, ms))

let pass = 0, fail = 0
const t = (n, c) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n)) }
console.log('smoke-bardic-pause')

// ── platform stubs (the contract under test is bardic-audio.js itself) ──
const gainParam = () => ({
  value: 0,
  cancelScheduledValues() {}, setValueAtTime(v) { this.value = v }, linearRampToValueAtTime(v) { this.value = v },
})
class StubCtx {
  constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {} }
  createGain() { return { gain: gainParam(), connect() {}, disconnect() {} } }
  createDynamicsCompressor() {
    return { threshold: gainParam(), knee: gainParam(), ratio: gainParam(),
             attack: gainParam(), release: gainParam(), connect() {} }
  }
  createAnalyser() { return { fftSize: 512, smoothingTimeConstant: 0, frequencyBinCount: 256, connect() {}, getByteFrequencyData() {} } }
  createMediaElementSource() { throw new Error('no CORS in harness — fakeGain path') }
  resume() { this.state = 'running'; return Promise.resolve() }
}
class StubAudio {
  constructor(src) { this.src = src || ''; this.paused = true; this.volume = 1; this.loop = false; this.preload = ''; this.currentTime = 0; this.parentNode = null; this.dataset = {}; this.crossOrigin = null; this.style = {}; this.load = function () {} }
  play() { this.paused = false; return Promise.resolve() }
  pause() { this.paused = true }
  addEventListener() {} removeEventListener() {}
}
const win = {
  AudioContext: StubCtx,
  addEventListener() {}, removeEventListener() {},
  location: { origin: 'https://tok.manikkhan.com' },
}
win.window = win
const doc = { createElement: () => new StubAudio(), body: { appendChild() {} }, addEventListener() {}, removeEventListener() {} }

new Function('window', 'document', 'Audio', 'navigator', src)(win, doc, StubAudio, { userAgent: 'harness' })
const BA = win.BardicAudio
t('BardicAudio loads over the stubbed platform', !!BA && typeof BA.makeChannel === 'function')

const ch = BA.makeChannel('music', () => 1)
const A = { kind: 'url', url: 'https://res.cloudinary.com/x/a.mp3', title: 'Track A' }
const B = { kind: 'url', url: 'https://res.cloudinary.com/x/b.mp3', title: 'Track B' }

// ── plain pause / resume ──
ch.playTrack(A, 0.01, 'loop')
const a1 = ch._currentAudio()
t('playTrack: element playing', !!a1 && !a1.paused)
ch.pauseTrack()
t('pauseTrack: element paused', a1.paused)

// the watchdog must NOT resurrect a deliberate pause (retry window 100–600ms)
await wait(700)
t('watchdog canceled: still paused after the 600ms retry window', a1.paused)

ch.resumeTrack()
t('resumeTrack: element playing again', !a1.paused)

// ── THE reported desync: pause → cast → pause ──
ch.pauseTrack()
t('paused before the cast', a1.paused)
ch.playTrack(B, 0.01, 'loop')          // castMoodOnChannel lands here
await wait(50)
const a2 = ch._currentAudio()
t('cast while paused: fresh voice plays (latch reset, no inheritance)', !!a2 && a2 !== a1 && !a2.paused)
ch.pauseTrack()                         // before the fix: early-returned on the stale latch
t('REGRESSION PIN: pause after cast actually pauses (the July 5 desync)', a2.paused)
await wait(700)
t('and stays paused through the retry window', a2.paused)
ch.resumeTrack()
t('resume still symmetric after the sequence', !a2.paused)

// ── element-truth healing: even a forced desync self-corrects on press ──
a2.paused = false                       // simulate audio flowing while state said paused
ch.pauseTrack()
t('element-truth pause heals a live desync in one press', a2.paused)

// ── stop clears cleanly and pause on empty is a no-op ──
ch.stopTrack(0.01)
await wait(120)
ch.pauseTrack()
t('pause after stop: no throw, no element', ch._currentAudio() === null)

console.log(`\n${pass}/${pass + fail} passed`)
process.exit(fail ? 1 : 0)
