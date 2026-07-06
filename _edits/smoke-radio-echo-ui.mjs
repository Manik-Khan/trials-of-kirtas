// smoke: echo-lock B8.2 UI — selfTest-driven flow, console-absent path,
// failure narration, and source assertions for tune-in auto-run,
// anchor combine, and the trim arithmetic.
import { JSDOM } from 'jsdom';
import fs from 'fs';
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log(' ✓',m)):(fail++,console.log(' ✗',m)); };
const sleep = ms => new Promise(r=>setTimeout(r,ms));

const html = fs.readFileSync('/home/claude/radio.html','utf8');
let nextResult = null, selfTestCalls = 0;
const dom = new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://tok.test/radio.html',
  beforeParse(w){
    w.BardicRadio = { positionAt: () => 10 };
    w.BardicClock = { now: () => 123456, sync: () => Promise.resolve(), offset:0, rtt:0 };
    w.BardicEcho = { BUILD:'E4', selfTest(){ selfTestCalls++; return Promise.resolve(nextResult); }, measure(){} };
    Object.defineProperty(w,'localStorage',{value:{getItem:()=>null,setItem(){},removeItem(){}}});
  }});
const w = dom.window, doc = w.document;
const click = id => doc.getElementById(id).dispatchEvent(new w.Event('click',{bubbles:true}));
const on = id => doc.getElementById(id).classList.contains('on');

// manual run, console never calibrated
nextResult = { ok:true, selfMs:198, peak:0.99, conf:3.1 };
click('echoBtn');
ok(on('echoListen'), 'run → listening pane');
await sleep(30);
ok(on('echoResult'), 'resolve → result card');
ok(doc.getElementById('echoSelf').textContent==='+198ms', 'self measurement shown');
ok(doc.getElementById('echoRoom').textContent==='—', 'console value shows — when never calibrated');
ok(doc.getElementById('echoApply').disabled===true, 'apply disabled without a console number');
ok(doc.getElementById('echoWhy').textContent.includes('console'), 'why-text points at the console chip');
ok(doc.getElementById('echoBuild').textContent.includes('E4'), 'build tag visible (stale tabs must be visible)');
click('echoDismiss');
ok(!on('echoResult'), 'dismiss clears');

// failure path narrates
nextResult = { ok:false, reason:'chirp', detail:'own chirp not heard (peak 0.05, conf ×1.0) — volume down, or mic blocked/covered' };
click('echoBtn'); await sleep(30);
ok(on('echoFail') && doc.getElementById('echoFailWhy').textContent.includes('volume down'), 'selfTest failure narrated raw');
click('echoFailDismiss');

// missing module narrated with refresh hint
delete w.BardicEcho;
click('echoBtn'); await sleep(5);
ok(doc.getElementById('echoFailWhy').textContent.includes('hard-refresh'), 'missing/stale module → refresh instruction');

// source assertions — the wiring the DOM can't reach in jsdom
ok(/primePool\(\);\s*\n\s*echoRun\(true\);/.test(html), 'tune-in tap auto-runs the self-test');
ok(/applyAnchors\(\);\s*\n\s*echoCombine\(\);/.test(html), 'anchor arrival attempts the combine');
ok(/S\.selfMs - S\.anchors\.roomLatencyMs/.test(html), 'trim = self − console, from the anchors field');
ok(/S\.echoApplied = true;\s*\n\s*setTrim/.test(html), 'auto-apply fires once per fresh measurement');
ok(/bardic-echo\.js\?v=E4/.test(html), 'module include is cache-stamped');
ok(/tok-radio-selfms/.test(html), 'self measurement persisted');

console.log(`\nsmoke-radio-echo-ui: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
