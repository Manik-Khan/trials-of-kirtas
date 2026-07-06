// smoke: relockGate — extracted FROM radio.html source (the function is
// the contract; test the shipped code, not a re-implementation).
import fs from 'fs';
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log(' ✓',m)):(fail++,console.log(' ✗',m)); };

const html = fs.readFileSync('/home/claude/radio.html','utf8');
const m = html.match(/function relockGate\(p, err, nowMs\) \{[\s\S]*?\n  \}/);
ok(!!m, 'relockGate found in page source');
const relockGate = new Function('p','err','nowMs', m[0].replace(/^function relockGate\([^)]*\) \{/,'').replace(/\}$/,'') + ';');
// simpler: eval the whole declaration
const relock = eval('(' + m[0] + ')');

const T = 100000;
const fresh = () => ({ relockUntil: T+12000, relockSeeks: 0, lastSeekAt: T-3000 });

// 1) during re-lock: 300ms error (old deadband would ignore) → seeks
let p = fresh();
let g = relock(p, 0.30, T);
ok(g.seek===true && g.relocking===true, 're-lock: 300ms err seeks (was invisible before)');
ok(p.relockSeeks===1, 'seek counted against the burst budget');

// 2) spacing: 1s after a seek, still off → holds fire
p = fresh(); p.lastSeekAt = T-1000;
g = relock(p, 0.30, T);
ok(g.seek===false && g.relocking===true, 're-lock: respects 2.5s spacing');

// 3) budget: after 3 seeks the burst is spent → normal gate applies
p = fresh(); p.relockSeeks = 3;
g = relock(p, 0.30, T);
ok(g.seek===false && g.relocking===false, 'burst spent: 300ms no longer seeks');
g = relock(p, 0.60, T);
ok(g.seek===false, 'burst spent: 600ms err still waits out 15s spacing');
p.lastSeekAt = T-16000;
g = relock(p, 0.60, T);
ok(g.seek===true, 'normal gate: 600ms seeks after 15s');

// 4) early exit: landing under 80ms ends the window
p = fresh();
g = relock(p, 0.05, T);
ok(p.relockUntil===0 && g.relocking===false, 'err ≤80ms clears the window (locked early)');
g = relock(p, 0.30, T+1);
ok(g.seek===false, 'after early lock, 300ms is back inside the normal deadband');

// 5) window expiry: 13s after track change → normal regime
p = fresh();
g = relock(p, 0.30, T+13000);
ok(g.seek===false && g.relocking===false, 'window expired: normal deadband rules');

// 6) track-change scale error bypasses spacing even in normal regime
p = { relockUntil: 0, relockSeeks: 0, lastSeekAt: T-1000 };
g = relock(p, 6.0, T);
ok(g.seek===true, '>5s error seeks immediately (unchanged behavior)');

// 7) integration points present in source
ok(/p\.relockUntil = Date\.now\(\) \+ 12000/.test(html), 'track-change branch arms the window');
ok(/relockGate\(p, err, Date\.now\(\)\)/.test(html), 'driftLoop routes seeks through relockGate');
ok(/relocking \? ' \\u00b7 locking'/.test(html), "telemetry narrates 'locking' during the burst");
ok(/relockUntil: 0, relockSeeks: 0/.test(html), 'player shape carries the re-lock fields');

console.log(`\nsmoke-radio-relock: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
