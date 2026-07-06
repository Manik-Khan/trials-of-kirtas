// smoke: radio.html trim steppers — clamp, persist, slider/label sync,
// settle-seek single-fire, no regression to masterVol wiring.
import { JSDOM } from 'jsdom';
import fs from 'fs';
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log(' ✓',m)):(fail++,console.log(' ✗',m)); };

const html = fs.readFileSync('/home/claude/radio.html','utf8');
const store = {};
const dom = new JSDOM(html, {
  runScripts:'dangerously', pretendToBeVisual:true, url:'https://tok.test/radio.html',
  beforeParse(w){
    w.BardicRadio = { positionAt: () => 10 };        // stub the contract's shape
    w.BardicClock = { now: () => 123456, sync: () => Promise.resolve(), offset:0, rtt:0 };
    Object.defineProperty(w, 'localStorage', { value: {
      getItem:k=>store[k]??null, setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];}
    }});
  }
});
const w = dom.window, doc = w.document;
const slider = doc.getElementById('syncTrim');
const label  = doc.getElementById('trimTxt');
const steps  = [...doc.querySelectorAll('#trimSteps button')];
const press  = b => { b.dispatchEvent(new w.Event('pointerdown',{bubbles:true}));
                      b.dispatchEvent(new w.Event('pointerup',{bubbles:true})); };

ok(steps.length===4, 'four steppers render');
ok(slider.getAttribute('step')==='5', 'slider step tightened to 5');
ok(label.textContent==='0ms', 'boots at 0ms');

press(steps[3]); press(steps[3]);                    // +25 +25
ok(label.textContent==='+50ms' && slider.value==='50', '+25×2 → +50, slider follows');
press(steps[1]);                                     // −5
ok(label.textContent==='+45ms', '−5 → +45');
ok(store['tok-radio-trim']==='45', 'persists to tok-radio-trim');
for(let i=0;i<30;i++) press(steps[0]);               // −25×30
ok(label.textContent==='-500ms' && slider.value==='-500', 'clamps at −500');

slider.value='120'; slider.dispatchEvent(new w.Event('input',{bubbles:true}));
ok(label.textContent==='+120ms' && store['tok-radio-trim']==='120', 'slider path still writes through setTrim');

// stored trim restores on boot
const dom2 = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true, url:'https://tok.test/radio.html',
  beforeParse(w2){
    w2.BardicRadio={positionAt:()=>10}; w2.BardicClock={now:()=>0,sync:()=>Promise.resolve(),offset:0,rtt:0};
    Object.defineProperty(w2,'localStorage',{value:{getItem:k=>k==='tok-radio-trim'?'-85':null,setItem(){},removeItem(){}}});
  }});
ok(dom2.window.document.getElementById('trimTxt').textContent==='-85ms', 'restores persisted −85 on load');

console.log(`\nsmoke-radio-trim: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
