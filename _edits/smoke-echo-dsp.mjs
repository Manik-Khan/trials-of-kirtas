// smoke: echo-lock DSP — extract makeReference/envelope/xcorr FROM the
// mock's source and verify they recover known delays through a simulated
// "room" (attenuation + noise + a bit of reverb smear).
import fs from 'fs';
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log(' ✓',m)):(fail++,console.log(' ✗',m)); };

const html = fs.readFileSync('mock-echo-lock.html','utf8');
const grab = name => {
  const m = html.match(new RegExp('function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n  \\}'));
  ok(!!m, name + ' found in mock source');
  return eval('(' + m[0] + ')');
};
// BURSTS_MS is module-scope in the mock; re-bind it for makeReference
const bm = html.match(/var BURSTS_MS = (\[[^\]]*\]);/);
ok(!!bm, 'BURSTS_MS pattern found');
globalThis.BURSTS_MS = eval(bm[1]);
const makeReference = grab('makeReference');
const envelope = grab('envelope');
const xcorr = grab('xcorr');

// irregular spacing sanity: no two burst gaps equal (the anti-picket-fence property)
const gaps = BURSTS_MS.slice(1).map((v,i)=>v-BURSTS_MS[i]);
ok(new Set(gaps).size === gaps.length, 'burst gaps are all distinct: ' + gaps.join(','));

const sr = 48000;
const ref = makeReference(sr);
ok(ref.length === Math.round(1.45*sr), 'reference is 1.45s of samples');

function simulateRoom(ref, sr, delayMs, snr){
  const delay = Math.round(delayMs/1000*sr);
  const out = new Float32Array(ref.length + delay + sr);
  for (let i=0;i<ref.length;i++){
    out[delay+i] += ref[i]*0.5;
    // crude early reflection 23ms later at -12dB
    const r = delay + i + Math.round(0.023*sr);
    if (r < out.length) out[r] += ref[i]*0.12;
  }
  let seed = 12345;
  const rnd = () => (seed = (seed*1103515245+12345) & 0x7fffffff) / 0x7fffffff - 0.5;
  for (let i=0;i<out.length;i++) out[i] += rnd()*snr;
  return out;
}

const eRef = envelope(ref, sr);
for (const delay of [63, 147, 288, 512]){
  const rec = simulateRoom(ref, sr, delay, 0.06);
  const res = xcorr(eRef, envelope(rec, sr), 900);
  ok(Math.abs(res.lag - delay) <= 6, `recovers ${delay}ms through the room (got ${res.lag}ms, conf ×${res.confidence.toFixed(1)})`);
  ok(res.confidence >= 1.6, `  …with confident peak at ${delay}ms (×${res.confidence.toFixed(1)})`);
}

// degenerate: pure noise (echo-cancellation-ate-it scenario) → low confidence, not a false lock
{
  let seed = 999; const rnd=()=> (seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff-0.5;
  const noise = new Float32Array(3*sr); for(let i=0;i<noise.length;i++) noise[i]=rnd()*0.2;
  const res = xcorr(eRef, envelope(noise, sr), 900);
  ok(res.peak < 0.25 || res.confidence < 1.6, `pure noise rejected (peak ${res.peak.toFixed(2)}, conf ×${res.confidence.toFixed(1)})`);
}

console.log(`\nsmoke-echo-dsp: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
