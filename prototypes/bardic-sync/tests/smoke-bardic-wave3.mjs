import fs from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
import { webcrypto } from 'node:crypto';

const htmlPath = new URL('./bardic-track-switch-wave3.html', import.meta.url);
const html = fs.readFileSync(htmlPath, 'utf8');
const inlineScript = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .find((source) => source.trim());

if (!inlineScript) throw new Error('Wave 3 inline script was not found.');

const values = new Map();
for (const match of html.matchAll(/\bid="([^"]+)"([^>]*)>/g)) {
  const value = match[2].match(/\bvalue="([^"]*)"/)?.[1] || '';
  values.set(match[1], value);
}

function fakeElement(id) {
  return {
    id,
    value: values.get(id) || '',
    checked: id === 'latencyComp',
    disabled: false,
    textContent: '',
    innerHTML: '',
    className: '',
    style: {},
    scrollTop: 0,
    scrollHeight: 0,
    classList: { toggle() {} },
    addEventListener() {},
  };
}

const elements = new Map([...values.keys()].map((id) => [id, fakeElement(id)]));
const storage = () => {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
};

const timerCallbacks = [];
const context = {
  console,
  performance,
  crypto: webcrypto,
  Date,
  Map,
  Set,
  URL,
  navigator: { userAgent: 'Wave3 smoke', onLine: true },
  localStorage: storage(),
  sessionStorage: storage(),
  document: {
    visibilityState: 'visible',
    getElementById(id) { return elements.get(id) || null; },
    addEventListener() {},
  },
  setTimeout(callback) {
    timerCallbacks.push(callback);
    return timerCallbacks.length;
  },
  clearTimeout() {},
  setInterval() { return 1; },
  clearInterval() {},
  alert() {},
  fetch: async () => ({ ok: false, status: 404 }),
};
context.window = {
  addEventListener() {},
  AudioContext: null,
  webkitAudioContext: null,
};

const exposed = inlineScript.replace(
  '\n  loadSettings();',
  `\n  window.__Wave3Test = {
    state,
    ui,
    monoEpochMs,
    roomGate,
    rememberId,
    scheduleSourceFadeOut,
    scheduleTransition,
    scheduleTrackStop,
    loadTrack,
  };\n  loadSettings();`
);

vm.runInNewContext(exposed, context, { filename: 'bardic-track-switch-wave3.inline.js' });
const api = context.window.__Wave3Test;
if (!api) throw new Error('Wave 3 test API injection failed.');

let passes = 0;
function assert(condition, label) {
  if (!condition) throw new Error(`FAIL: ${label}`);
  passes += 1;
}

function readySlot(trackId, hash) {
  return { state: 'ready', trackId, hash, url: 'https://example.test/track.mp3' };
}

const now = Date.now();
api.state.devices = new Map([
  ['host', {
    clientId: 'host', name: 'Host', role: 'host', audioVerified: true,
    slots: { a: readySlot('a-1', 'hash-a'), b: readySlot('b-1', 'hash-b') },
    lastReceivedAt: now,
  }],
  ['listener', {
    clientId: 'listener', name: 'Listener', role: 'listener', audioVerified: true,
    slots: { a: readySlot('a-1', 'hash-a'), b: readySlot('b-1', 'hash-b') },
    lastReceivedAt: now,
  }],
]);

assert(api.roomGate('a').trackReady === true, 'matching Track A IDs and hashes open the gate');
api.state.devices.get('listener').slots.a.hash = 'different';
assert(api.roomGate('a').trackReady === false, 'a hash mismatch closes the Track A gate');
api.state.devices.get('listener').slots.a.hash = 'hash-a';
api.state.devices.get('listener').slots.a.trackId = 'different-id';
assert(api.roomGate('a').trackReady === false, 'a track ID mismatch closes the Track A gate');
api.state.devices.get('listener').slots.a.trackId = 'a-1';
const listenerDevice = api.state.devices.get('listener');
listenerDevice.lastReceivedAt = now - 36000;
assert(api.roomGate('a').trackReady === false, 'a stale listener ages out and closes the room gate');
listenerDevice.lastReceivedAt = now;
api.state.devices.set('listener', listenerDevice);

class FakeParam {
  constructor(value = 1) { this.value = value; this.events = []; }
  cancelScheduledValues(time) { this.events.push(['cancel', time]); }
  setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); }
  linearRampToValueAtTime(value, time) { this.value = value; this.events.push(['ramp', value, time]); }
}

class FakeGain {
  constructor(value = 1) { this.gain = new FakeParam(value); }
  connect(target) { return target; }
}

class FakeSource {
  constructor() { this.started = null; this.stopped = null; this.onended = null; }
  connect(target) { this.connected = target; return target; }
  start(time, position) { this.started = { time, position }; }
  stop(time) { this.stopped = time; }
}

const createdSources = [];
const audioContext = {
  state: 'running',
  currentTime: 10,
  outputLatency: 0,
  destination: {},
  createBufferSource() {
    const source = new FakeSource();
    createdSources.push(source);
    return source;
  },
  createGain() { return new FakeGain(); },
};

api.ui.role.value = 'host';
api.ui.latencyComp.checked = false;
api.state.audioCtx = audioContext;
api.state.audioVerifiedAt = now;
api.state.slots.a = {
  key: 'a', title: 'Track A', trackId: 'a-1', url: 'https://example.test/a.mp3',
  state: 'ready', buffer: { id: 'buffer-a' }, hash: 'hash-a', bytes: 10,
  duration: 120, error: null, loadGeneration: 1,
};
api.state.slots.b = {
  key: 'b', title: 'Track B', trackId: 'b-1', url: 'https://example.test/b.mp3',
  state: 'ready', buffer: { id: 'buffer-b' }, hash: 'hash-b', bytes: 20,
  duration: 90, error: null, loadGeneration: 1,
};

const oldSource = new FakeSource();
const oldGain = new FakeGain(1);
api.state.currentSource = oldSource;
api.state.currentGain = oldGain;
api.state.currentPlayId = 'old-play';
api.state.currentStartAudioTime = 5;
api.state.currentStartPosition = 0;
api.state.activeSlot = 'a';
api.state.playbackState = 'playing';
api.state.liveSources.add(oldSource);

const transition = {
  transitionId: 'transition-1',
  toSlot: 'b',
  trackId: 'b-1',
  trackHash: 'hash-b',
  positionSeconds: 12,
  startHostMs: api.monoEpochMs() + 1000,
  mode: 'crossfade',
  fadeMs: 300,
};

await api.scheduleTransition(transition, 'smoke');
assert(api.state.playbackState === 'transitioning', 'crossfade enters the transitioning state');
assert(createdSources.length === 1 && createdSources[0].started.position === 12, 'target source is scheduled at the selected position');
assert(createdSources[0].started.time > audioContext.currentTime, 'target source is scheduled in the future');
assert(createdSources[0].buffer === api.state.slots.b.buffer, 'target source uses Track B decoded bytes');
assert(createdSources[0].connected instanceof FakeGain, 'target source connects through its own gain node');
assert(oldSource.stopped > createdSources[0].started.time, 'old source stays alive through the crossfade window');
assert(createdSources[0] !== oldSource, 'crossfade uses a separate source node');
assert(api.state.armedTransition?.slot === 'b', 'Track B remains armed until the shared target time');

const sourceCount = createdSources.length;
await api.scheduleTransition(transition, 'duplicate-smoke');
assert(createdSources.length === sourceCount, 'a duplicate transition ID cannot schedule another source');

const transitionTimer = timerCallbacks.shift();
assert(typeof transitionTimer === 'function', 'transition activation timer was created');
transitionTimer();
assert(api.state.activeSlot === 'b', 'Track B becomes active at the transition time');
assert(api.state.playbackState === 'playing', 'playback returns to playing after transition activation');
assert(api.state.currentSource === createdSources[0], 'the new source becomes current after activation');

const cutTransition = {
  transitionId: 'transition-2',
  toSlot: 'a',
  trackId: 'a-1',
  trackHash: 'hash-a',
  positionSeconds: 0,
  startHostMs: api.monoEpochMs() + 800,
  mode: 'cut',
  fadeMs: 500,
};
await api.scheduleTransition(cutTransition, 'cut-smoke');
assert(createdSources.length === 2, 'hard cut schedules one new target source');
assert(
  createdSources[1].started.time < createdSources[0].stopped,
  'hard cut overlaps by the anti-click window instead of creating silence'
);
const cutTimer = timerCallbacks.shift();
cutTimer();
assert(api.state.activeSlot === 'a', 'hard cut activates Track A at the shared target time');

const stillPlaying = api.state.currentSource;
api.state.playbackState = 'playing';
api.state.currentSource = stillPlaying;
let failed = false;
try {
  await api.loadTrack('b', 'https://example.test/missing.mp3', 'missing-b', 'Missing B', 'smoke');
} catch (_) {
  failed = true;
}
assert(failed, 'a failed pending download rejects');
assert(api.state.slots.b.state === 'error', 'the failed pending slot narrates an error');
assert(api.state.currentSource === stillPlaying, 'a failed pending load leaves the current source untouched');
assert(api.state.playbackState === 'playing', 'a failed pending load leaves playback running');

const stopCommand = { stopId: 'stop-1', stopHostMs: api.monoEpochMs() + 500 };
const timersBeforeStop = timerCallbacks.length;
await api.scheduleTrackStop(stopCommand, 'smoke');
assert(api.state.playbackState === 'stopping', 'a synchronized stop enters the stopping state');
const timersAfterStop = timerCallbacks.length;
await api.scheduleTrackStop(stopCommand, 'duplicate-smoke');
assert(
  timersAfterStop === timersBeforeStop + 1 && timerCallbacks.length === timersAfterStop,
  'a duplicate stop ID cannot schedule another stop timer'
);

console.log(`Wave 3 smoke: ${passes}/${passes} checks passed`);
