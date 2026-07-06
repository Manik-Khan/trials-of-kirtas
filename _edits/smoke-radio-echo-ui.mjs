// smoke: echo-lock UI wiring in radio.html — stubbed BardicEcho drives
// the full flow: listen pane → result card → apply writes trim; failure
// path narrates; dismiss clears.
import { JSDOM } from 'jsdom';
import fs from 'fs';
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log(' ✓',m)):(fail++,console.log(' ✗',m)); };
const sleep = ms => new Promise(r=>setTimeout(r,ms));

const html = fs.readFileSync('/home/claude/radio.html','utf8');
let measureArgs = null, nextResult = null;
const dom = new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://tok.test/radio.html',
  beforeParse(w){
    w.BardicRadio = { positionAt: () => 10 };
    w.BardicClock = { now: () => 123456, sync: () => Promise.resolve(), offset:0, rtt:0 };
    w.BardicEcho = { BUILD:'stub', measure(o){ measureArgs = o; return Promise.resolve(nextResult); } };
    Object.defineProperty(w,'localStorage',{value:{getItem:()=>null,setItem(){},removeItem(){}}});
  }});
const w = dom.window, doc = w.document;
const click = id => doc.getElementById(id).dispatchEvent(new w.Event('click',{bubbles:true}));
const on = id => doc.getElementById(id).classList.contains('on');

ok(!!doc.getElementById('echoBtn'), 'echo button renders under the steppers');
ok(!on('echoListen') && !on('echoResult'), 'panes hidden at boot');

// happy path
nextResult = { ok:true, trimMs:76, selfMs:198, roomMs:122, selfConf:3.1, roomConf:2.7, channelTitle:'Tavern' };
click('echoBtn');
ok(on('echoListen'), 'run → listening pane');
ok(doc.getElementById('echoBtn').disabled === true, 'button disabled during capture');
ok(measureArgs && Array.isArray(measureArgs.channels) && typeof measureArgs.duck==='function'
   && typeof measureArgs.positionAt==='function' && typeof measureArgs.clockNow==='function',
   'measure() receives the full contract shape');
await sleep(30);
ok(!on('echoListen') && on('echoResult'), 'resolve → result card');
ok(doc.getElementById('echoRoom').textContent==='+122ms' && doc.getElementById('echoSelf').textContent==='+198ms',
   'both measurements shown raw');
ok(doc.getElementById('echoProp').textContent==='+76ms', 'proposal rendered');
ok(doc.getElementById('echoWhy').textContent.includes('Tavern'), 'names the channel it locked against');
click('echoApply');
ok(doc.getElementById('trimTxt').textContent==='+76ms', 'apply writes trim through setTrim: '+doc.getElementById('trimTxt').textContent);
ok(!on('echoResult'), 'card dismisses on apply');

// failure path
nextResult = { ok:false, reason:'room', detail:'Tavern: no clean peak (×1.2)' };
click('echoBtn');
await sleep(30);
ok(on('echoResult') && on('echoFail'), 'room failure → failure pane');
ok(doc.getElementById('echoFailWhy').textContent.includes('no clean peak'), 'failure narrates the detail');
ok(doc.getElementById('echoFailWhy').textContent.includes('rhythmic'), 'failure suggests the fallback');
click('echoFailDismiss');
ok(!on('echoResult'), 'failure dismisses');

console.log(`\nsmoke-radio-echo-ui: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
