const RP = require('../forge-render-power.js');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) pass++; else { fail++; console.log('FAIL: ' + name); } }

ok('render-power version is pinned', RP.VERSION === 1);
ok('unknown profiles normalize to balanced', RP.normalizeProfile('battery-melter') === 'balanced');
ok('high profile is explicit', RP.normalizeProfile('HIGH') === 'high');
ok('balanced caps retina density at 1.25', RP.settings('balanced', 2).pixelRatio === 1.25);
ok('balanced uses a 1024 shadow map', RP.settings('balanced', 2).shadowMapSize === 1024);
ok('balanced stops ambient motion and continuous rendering', !RP.settings('balanced', 2).ambientMotion && !RP.settings('balanced', 2).continuous);
ok('high retains the approved 1.75 density ceiling', RP.settings('high', 2).pixelRatio === 1.75);
ok('high retains 2048 shadows and ambient motion', RP.settings('high', 2).shadowMapSize === 2048 && RP.settings('high', 2).ambientMotion);

let now = 0, nextId = 1, queue = new Map(), renders = 0, keep = false, continuous = false;
function raf(fn) { const id = nextId++; queue.set(id, fn); return id; }
function cancel(id) { queue.delete(id); }
function run(ms) { now = ms; const first = queue.entries().next().value; if (!first) return false; queue.delete(first[0]); first[1](ms); return true; }
const scheduler = RP.createScheduler({ raf, cancel, clock: () => now, step: () => { renders++; return keep; }, continuous: () => continuous });

scheduler.request(); scheduler.request();
ok('several invalidations coalesce into one frame', queue.size === 1);
run(16);
ok('balanced scheduler renders one requested frame', renders === 1);
ok('idle balanced scheduler stops', queue.size === 0);
keep = true; scheduler.request(); run(32);
ok('active animation schedules its next frame', queue.size === 1);
keep = false; run(48);
ok('animation settles back to idle', queue.size === 0);
continuous = true; scheduler.request(); run(64);
ok('high-fidelity continuous mode keeps drawing', queue.size === 1);
continuous = false; run(80);
scheduler.request(100); run(90);
ok('bounded effects keep frames alive', queue.size === 1);
now = 200; run(200);
ok('bounded effects stop after their deadline', queue.size === 0);
scheduler.request(); scheduler.setPaused(true);
ok('hidden-tab pause cancels the pending frame', queue.size === 0 && scheduler.state().paused);
scheduler.request();
ok('hidden-tab invalidation does not schedule work', queue.size === 0);
scheduler.setPaused(false);
ok('returning to the tab requests one fresh frame', queue.size === 1 && !scheduler.state().paused);

console.log(`smoke-render-power: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
