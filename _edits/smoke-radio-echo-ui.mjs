// smoke: echo-lock UI wiring (B8.1.1) — the census/idle path runs
// end-to-end in jsdom (a fresh page has no anchors); the happy-path
// rendering was runtime-proven in B8.1's suite and is unchanged, so it
// is held here by source assertions.
import { JSDOM } from 'jsdom';
import fs from 'fs';
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log(' ✓',m)):(fail++,console.log(' ✗',m)); };

const html = fs.readFileSync('/home/claude/radio.html','utf8');
let measureCalled = false;
const dom = new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://tok.test/radio.html',
  beforeParse(w){
    w.BardicRadio = { positionAt: () => 10 };
    w.BardicClock = { now: () => 123456, sync: () => Promise.resolve(), offset:0, rtt:0 };
    w.BardicEcho = { BUILD:'stub', measure(){ measureCalled = true; return Promise.resolve({ok:false,reason:'x',detail:'x'}); } };
    Object.defineProperty(w,'localStorage',{value:{getItem:()=>null,setItem(){},removeItem(){}}});
  }});
const w = dom.window, doc = w.document;
const click = id => doc.getElementById(id).dispatchEvent(new w.Event('click',{bubbles:true}));
const on = id => doc.getElementById(id).classList.contains('on');

ok(!!doc.getElementById('echoBtn'), 'echo button renders');

// census path: no anchors yet → narrated, measure NOT called, button NOT stuck
click('echoBtn');
ok(on('echoResult') && on('echoFail'), 'pre-broadcast run → failure pane');
ok(doc.getElementById('echoFailWhy').textContent.includes('is the engine on air'),
   'idle narration names the actual state: '+JSON.stringify(doc.getElementById('echoFailWhy').textContent));
ok(measureCalled===false, 'measure() not called when the gate finds nothing');
ok(doc.getElementById('echoBtn').disabled===false, 'button not left disabled by the bail');
click('echoFailDismiss');
ok(!on('echoResult'), 'dismiss clears');

// source assertions: the gate + the title fix + census narration
ok((()=>{ const a=html.indexOf('census.total++'), b=html.indexOf('playing.push');
   return a>0 && b>a && !html.slice(a,b).includes('p.audio'); })(),
   'gate code (census→push) never consults the LOCAL element');
ok(/if \(!p\.anchor \|\| p\.anchor\.paused\) \{ census\.paused\+\+; continue; \}/.test(html),
   'gate = unpaused anchor…');
ok(/if \(!p\.url\) \{ census\.noUrl\+\+; continue; \}/.test(html), '…plus a track url — nothing else');
ok(/p\.ui && p\.ui\.lab && p\.ui\.lab\.textContent/.test(html),
   'channel title read from the rendered label (anchor carries only pos/at/paused — the scar)');
ok(/anchor-paused: ' \+ census\.paused/.test(html), 'census narrated with counts');
ok(/setTrim\(echoProposed\)/.test(html), 'apply still funnels through setTrim');


// B8.1.2: failure-reason rendering + the muted duck
ok(/couldn\\u2019t read the track\\u2019s audio data \(CORS or network/.test(html), 'pcm failures name CORS/network, never rhythm');
ok((()=>{ const i=html.indexOf("res.reason === 'pcm'"); const j=html.indexOf(':', html.indexOf('?', i));
   return i>0 && !html.slice(i,j).toLowerCase().includes('rhythmic'); })(), 'pcm branch carries no rhythmic advice');
ok(/res\.reason === 'weak'[^]{0,220}rhythmic/.test(html), 'weak branch keeps the rhythmic suggestion');
ok(/p\.audio\.muted = true/.test(html) && /_preMuted/.test(html), 'duck uses muted (iOS ignores volume), with restore');
ok(!/p\._preDuck = p\.audio\.volume/.test(html), 'volume-based duck removed');

console.log(`\nsmoke-radio-echo-ui: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
