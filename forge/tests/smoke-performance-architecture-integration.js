const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) pass++; else { fail++; console.log('FAIL: ' + name); } }

ok('render-power authority is cache stamped', html.includes('forge-render-power.js?v=frp1'));
ok('architecture authority is cache stamped', html.includes('forge-architecture.js?v=fa4'));
ok('Balanced and High Fidelity are visible local choices', html.includes('data-render-quality="balanced"') && html.includes('data-render-quality="high"'));
ok('Balanced is the initial selected profile', /data-render-quality="balanced" class="active"/.test(html));
ok('hidden tabs pause the frame scheduler', html.includes("FORGE_RENDER_SCHEDULER.setPaused(document.hidden)"));
ok('old unconditional animation loop is gone', !html.includes('function loop(){requestAnimationFrame(loop)'));
ok('runtime scheduler owns the real THREE render step', html.includes('step:forgeRenderFrame') && html.includes('renderer.render(scene,camera)'));
ok('every Temple activates architecture without a query flag', html.includes("function architectureActive(){return !!(F&&F.intent&&F.intent.archetype==='temple-terraces');}") && !html.includes('ARCHITECTURE_QUERY'));
ok('authored architecture is saved beside the exact map snapshot', html.includes('envelope.architecture=ARCHITECTURE_API.normalizeRecord(ARCHITECTURE_RECORD)'));
ok('saved architecture restores from the envelope or map metadata', html.includes('envelope.architecture||(map.meta&&map.meta.architecture)'));
const boot = html.slice(html.indexOf('async function bootSession'), html.indexOf('/* Task 12: publish the claim-screen handshake'));
ok('session repaint restores authored blocks before rendering the field', boot.includes('ARCHITECTURE_RECORD=F&&F.architecture?') && boot.indexOf('ARCHITECTURE_RECORD=F&&F.architecture?') < boot.indexOf('renderField()'));
ok('combat map applies the same pure authored block record', html.includes('ARCHITECTURE_API.apply(map,ARCHITECTURE_RECORD)'));
ok('route failures block local and shared combat doors', html.includes('if(architecturePending())') && html.includes('Repair the required ascent before opening or saving'));
ok('geometry fog keeps every instance matrix instead of hiding terrain', html.includes('mesh.setMatrixAt(i,geometryMode?base:'));
ok('geometry fog does not build the old void veil', html.includes('if(player&&!geometryMode)buildFogVeil()'));
ok('visible geometry returns to full authored colour', html.includes('recognition=geometryMode?1:'));
ok('Temple presentation reads the real per-cell discovery state', html.includes('return discoveryStateAt(c,r);') && !html.includes('ARCHITECTURE_API.regionStateAt'));
ok('creature disclosure uses direct canonical combat sight', html.includes('function discoveryCellTargetable(c,r)') && html.includes('return discoveryCellTargetable(u.c,u.r)'));
ok('production builder exposes wall, parapet, gate, and erase blocks', ['wall', 'parapet', 'gate', 'erase'].every(k => html.includes(`data-architecture-tool="${k}"`)));
ok('seeded retaining walls accept both blocking extension tools', html.includes('if(seededWall&&def&&def.blocks)edit.heightFt=') && html.includes("kind==='parapet'?'5-ft parapet'"));
ok('Workshop preview uses canonical cell sight rather than authored regions', html.includes('D.visibleFrom(map,source,TG') && html.includes('Preview sight fog') && !html.includes('Preview region fog'));
ok('optional bypass sealing is a first-class authored action', html.includes('function sealOptionalBypass()'));

console.log(`smoke-performance-architecture-integration: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
