// smoke: echo-lock flow mock — listen → result → apply writes trim;
// smooth-track mode routes to the failure pane; retry re-runs.
import { JSDOM } from 'jsdom';
import fs from 'fs';
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log(' ✓',m)):(fail++,console.log(' ✗',m)); };

const html = fs.readFileSync('mock-echo-trim-flow.html','utf8');
const dom = new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true});
const w = dom.window, doc = w.document;
const click = id => doc.getElementById(id).dispatchEvent(new w.Event('click',{bubbles:true}));
const on = id => doc.getElementById(id).classList.contains('on');
const sleep = ms => new Promise(r=>setTimeout(r,ms));

ok(doc.getElementById('trimVal').textContent.trim()==='0 ms','boots at 0ms');
ok(!on('listenRow') && !on('result'),'listening + result hidden at boot');

click('autoBtn');
ok(on('listenRow'),'auto-trim → listening state shows');
ok(doc.getElementById('autoBtn').disabled===true,'button disabled while listening');

await sleep(4200);   // simulated capture is 3.6s
ok(!on('listenRow') && on('result'),'capture ends → result card shows');
ok(doc.getElementById('ok').style.display==='block','good mode → measurement pane');
const prop = parseInt(doc.getElementById('mProp').textContent,10);
const room = parseInt(doc.getElementById('mRoom').textContent,10);
const self_ = parseInt(doc.getElementById('mSelf').textContent,10);
ok(prop === self_ - room, `proposed = device − room (${self_}−${room}=${prop})`);

click('applyBtn');
ok(doc.getElementById('trimVal').textContent.includes(String(prop)),'apply writes proposed trim: '+doc.getElementById('trimVal').textContent.trim());
ok(!on('result'),'result card dismisses on apply');

// failure path
click('simSmooth');
click('autoBtn');
await sleep(4200);
ok(on('result') && on('fail'),'smooth mode → failure pane with fallback guidance');
ok(doc.getElementById('ok').style.display==='none','measurement pane hidden on failure');
click('failDismiss');
ok(!on('result'),'failure dismisses');

console.log(`\nsmoke-echo-flow: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
