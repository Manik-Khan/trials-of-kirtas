// smoke: engine-side B8.2 — JSX parses, anchors carry roomLatencyMs,
// the chip exists and persists, build bumped, contract documented.
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log(' ✓',m)):(fail++,console.log(' ✗',m)); };

const app = fs.readFileSync('/home/claude/b82/bardic-app.jsx','utf8');
const bus = fs.readFileSync('/home/claude/b82/bardic-bus.js','utf8');
const page = fs.readFileSync('/home/claude/b82/bardic-console.html','utf8');

// JSX: @babel/parser IS the node --check
const parser = require('/home/claude/trim/node_modules/@babel/parser');
let parsed = true;
try { parser.parse(app, {sourceType:'module', plugins:['jsx']}); } catch(e){ parsed = e.message; }
ok(parsed===true, 'bardic-app.jsx parses (JSX): ' + (parsed===true?'clean':parsed));

ok(/return \{ at, engineId: engineIdRef\.current, channels, roomLatencyMs: roomLatRef\.current \};/.test(app),
   'buildAnchors payload carries roomLatencyMs');
ok(/const roomLatRef = useRef\(roomLat\);/.test(app) && /roomLatRef\.current = roomLat/.test(app),
   'ref mirror keeps buildAnchors identity-stable (the busSnapshot lesson)');
ok(/\[chStates, radioMask, onAir, roomLat, buildAnchors\]/.test(app),
   'fresh calibration re-anchors immediately');
ok(/function RoomLatencyChip/.test(app) && /<RoomLatencyChip value=\{roomLat\} onMeasured=\{setRoomLat\}\/>/.test(app),
   'chip defined and mounted');
ok(/tok-bardic-roomlat/.test(app), 'console persists its number');
ok(/BardicEcho\.selfTest/.test(app), 'chip runs the same selfTest the phones run');
ok(/BARDIC_BUILD = 'B8'/.test(app), 'BARDIC_BUILD bumped to B8');
ok(/setBusy\(false\);\s*\n\s*setErr\(\(e && e\.message\)/.test(app), 'chip failures narrate raw');

ok(/RADIO ANCHORS SIDE-CONTRACT/.test(bus) && /roomLatencyMs : number\|null/.test(bus),
   'contract lives in bardic-bus.js header (THE contract)');
ok(/tab teardown race — drop \*\/ \}/.test(bus), 'the mangled inline comment was restored');
ok(/bardic-echo\.js\?v=E5/.test(page), 'console page loads the echo module, cache-stamped');

console.log(`\nsmoke-bardic-app-b82: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
