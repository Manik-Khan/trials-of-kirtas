// smoke: bardic-echo.js core — load the SHIPPED module, then run the full
// synthetic pipeline (fake track + fake room lateness + fake device
// latency → capture → the same correlations measure() runs → trimFrom)
// and assert the sign matrix. A sign error dies here, not at the table.
import fs from 'fs';
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log(' ✓',m)):(fail++,console.log(' ✗',m)); };

global.window = {};
eval(fs.readFileSync('/home/claude/bardic-echo.js','utf8'));
const E = global.window.BardicEcho;
ok(!!E && E.BUILD==='E4', 'module loads, BUILD E4');
const { makeChirp, envelope, xcorr, trimFrom, PAD_S, CAP_S } = E;

const gaps = E.BURSTS_MS.slice(1).map((v,i)=>v-E.BURSTS_MS[i]);
ok(new Set(gaps).size===gaps.length, 'chirp gaps all distinct: '+gaps.join(','));

const sr = 48000;
let seed = 424242;
const rnd = () => (seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff;

// fake rhythmic track: 25s of irregular percussive transients
function makeTrack(){
  const n = 25*sr, t = new Float32Array(n);
  let pos = 0.2*sr;
  while (pos < n - sr*0.1){
    const len = Math.round(0.025*sr), amp = 0.4 + rnd()*0.6, f = 400+rnd()*2400;
    for (let i=0;i<len;i++) t[pos+i] += amp*Math.exp(-i/sr*120)*Math.sin(2*Math.PI*f*i/sr);
    pos += Math.round((0.18 + rnd()*0.45)*sr);
  }
  return t;
}
const track = makeTrack();
const chirp = makeChirp(sr);
const chirpEnv = envelope(chirp, sr);
const p0 = 10.0, schedMs = 350;

function synthesize(Lms, Ems, roomGain, noise){
  const cap = new Float32Array(Math.round(CAP_S*sr));
  const roomStart = Math.round((p0 - Ems/1000)*sr);
  for (let k=0;k<cap.length;k++) cap[k] = track[roomStart+k]*roomGain;
  const cAt = Math.round((schedMs+Lms)/1000*sr);
  for (let i=0;i<chirp.length && cAt+i<cap.length;i++) cap[cAt+i]+=chirp[i]*0.6;
  for (let k=0;k<cap.length;k++) cap[k]+=(rnd()-0.5)*noise;
  return cap;
}

function pipeline(cap, useMask=true){
  const capEnv = envelope(cap, sr);
  const cSelf = xcorr(chirpEnv, capEnv, Math.max(0,schedMs-200), schedMs+900);
  const mask = useMask ? { lo: Math.max(0,cSelf.lag-40), hi: cSelf.lag+1450+80 } : null;
  const seg = track.subarray(Math.round((p0-PAD_S)*sr), Math.round((p0+CAP_S+PAD_S)*sr));
  const segEnv = envelope(seg, sr);
  const cRoom = xcorr(capEnv, segEnv, Math.round((PAD_S-1.2)*1000), Math.round((PAD_S+1.2)*1000), mask);
  return { cSelf, cRoom, t: trimFrom({chirpLagMs:cSelf.lag, chirpSchedMs:schedMs, roomLagMs:cRoom.lag}) };
}

// the sign matrix
for (const [L, Eroom, want] of [[200,120,80],[60,140,-80],[180,-90,270],[650,20,500]]){
  const r = pipeline(synthesize(L, Eroom, 0.5, 0.05));
  const tol = 12;
  ok(Math.abs(r.t.selfMs - L) <= tol, `self: injected ${L}ms, measured ${r.t.selfMs}ms (conf ×${r.cSelf.confidence.toFixed(1)})`);
  ok(Math.abs(r.t.roomMs - Eroom) <= tol, `room: injected ${Eroom}ms, measured ${r.t.roomMs}ms (conf ×${r.cRoom.confidence.toFixed(1)})`);
  ok(r.t.trimMs === Math.max(-500, Math.min(500, Math.round(r.t.selfMs - r.t.roomMs))) &&
     Math.abs(r.t.trimMs - want) <= (want===500 ? 0 : tol),
     `trim: L−E → ${want>0?'+':''}${want} (got ${r.t.trimMs>0?'+':''}${r.t.trimMs})`);
  ok(r.cSelf.confidence >= 1.6 && r.cRoom.confidence >= 1.5, `  …both gates pass`);
}

// smooth track (pure pad) → room gate must REJECT, not false-lock
{
  const pad = new Float32Array(25*sr);
  for (let i=0;i<pad.length;i++) pad[i] = 0.3*Math.sin(2*Math.PI*220*i/sr)*(0.8+0.2*Math.sin(2*Math.PI*0.1*i/sr));
  const cap = new Float32Array(Math.round(CAP_S*sr));
  const rs = Math.round((p0-0.12)*sr);
  for (let k=0;k<cap.length;k++) cap[k]=pad[rs+k]*0.5 + (rnd()-0.5)*0.05;
  const capEnv = envelope(cap, sr);
  const seg = pad.subarray(Math.round((p0-PAD_S)*sr), Math.round((p0+CAP_S+PAD_S)*sr));
  const cRoom = xcorr(capEnv, envelope(seg, sr), Math.round((PAD_S-1.2)*1000), Math.round((PAD_S+1.2)*1000));
  ok(cRoom.confidence < 1.5, `smooth pad rejected by room gate (conf ×${cRoom.confidence.toFixed(1)})`);
}

// integration points in radio.html
const html = fs.readFileSync('/home/claude/radio.html','utf8');
ok(/<script src="bardic-echo\.js\?v=E4"><\/script>/.test(html), 'radio.html loads bardic-echo.js, cache-stamped E4');
ok(/if \(!S\.echoDucked\) p\.audio\.volume/.test(html), 'anchor-tick volume write respects the duck');
ok(/S\.echoDucked = !!on/.test(html), 'duck sets the guard flag');
ok(/setTrim\(echoProposed\)/.test(html), 'apply funnels through setTrim');
ok(/echoShowFail\(\(e && e\.message\)/.test(html), 'hard errors narrate raw text');



// E3: the July 6 field failure, reproduced and cured — room 22dB below
// the phone's own chirp (0.05 vs 0.6). Unmasked = the failure we saw;
// masked = the fix.
{
  const cap = synthesize(180, 120, 0.05, 0.02);
  const un = pipeline(cap, false);
  ok(un.cRoom.confidence < 1.5 || un.cRoom.peak < 0.2,
     `UNMASKED room fails at 22dB imbalance (peak ${un.cRoom.peak.toFixed(2)}, conf ×${un.cRoom.confidence.toFixed(1)}) — the field failure`);
  const ma = pipeline(cap, true);
  ok(ma.cRoom.confidence >= 1.5 && ma.cRoom.peak >= 0.2,
     `MASKED room passes (peak ${ma.cRoom.peak.toFixed(2)}, conf ×${ma.cRoom.confidence.toFixed(1)})`);
  ok(Math.abs(ma.t.roomMs - 120) <= 12 && Math.abs(ma.t.trimMs - 60) <= 12,
     `…and recovers room 120ms / trim +60 (got ${ma.t.roomMs}ms / ${ma.t.trimMs>0?'+':''}${ma.t.trimMs}ms)`);
}

// B8.1.2 additions: summarize taxonomy
{
  const S = E.summarize;
  ok(E.BUILD==='E4' && typeof E.selfTest==='function', 'BUILD E4 with selfTest exported');
  ok(S([{kind:'fetch',msg:'Tavern: Failed to fetch'}]).reason==='pcm', 'all-fetch → pcm');
  ok(S([{kind:'fetch',msg:'a'},{kind:'weak',msg:'b'}]).reason==='pcm', 'fetch present → pcm (most actionable)');
  ok(S([{kind:'weak',msg:'a'},{kind:'edge',msg:'b'}]).reason==='weak', 'weak beats edge');
  ok(S([{kind:'edge',msg:'a'}]).reason==='edge', 'all-edge → edge');
  ok(S([]).reason==='room', 'empty tries → generic room');
  ok(S([{kind:'weak',msg:'Tavern: peak 0.11, conf ×1.2'}]).detail.includes('×1.2'), 'detail carries raw numbers');
}
console.log(`echo-core+taxonomy: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
