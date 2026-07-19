const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) pass++; else { fail++; console.log('FAIL: ' + name); } }

ok('render-power authority is cache stamped', html.includes('forge-render-power.js?v=frp1'));
ok('architecture authority is cache stamped', html.includes('forge-architecture.js?v=fa3'));
ok('Balanced and High Fidelity are visible local choices', html.includes('data-render-quality="balanced"') && html.includes('data-render-quality="high"'));
ok('Balanced is the initial selected profile', /data-render-quality="balanced" class="active"/.test(html));
ok('hidden tabs pause the frame scheduler', html.includes("FORGE_RENDER_SCHEDULER.setPaused(document.hidden)"));
ok('old unconditional animation loop is gone', !html.includes('function loop(){requestAnimationFrame(loop)'));
ok('runtime scheduler owns the real THREE render step', html.includes('step:forgeRenderFrame') && html.includes('renderer.render(scene,camera)'));
ok('architecture stays behind the explicit regions1 flag', html.includes("get('architecture')==='regions1'"));
ok('authored architecture is saved beside the exact map snapshot', html.includes('envelope.architecture=ARCHITECTURE_API.normalizeRecord(ARCHITECTURE_RECORD)'));
ok('saved architecture restores from the envelope or map metadata', html.includes('envelope.architecture||(map.meta&&map.meta.architecture)'));
ok('combat map applies the same pure authored block record', html.includes('ARCHITECTURE_API.apply(map,ARCHITECTURE_RECORD)'));
ok('route failures block local and shared combat doors', html.includes('if(architecturePending())') && html.includes('Repair the required ascent before opening or saving'));
ok('region fog keeps instance matrices instead of hiding geometry', html.includes('mesh.setMatrixAt(i,regionMode?base:'));
ok('region fog does not build the old void veil', html.includes('if(player&&!regionMode)buildFogVeil()'));
ok('current region controls creature disclosure', html.includes('if(architectureRegionFog())return architectureDiscoveryStateAt(c,r)===2'));
ok('production builder exposes wall, parapet, gate, and erase blocks', ['wall', 'parapet', 'gate', 'erase'].every(k => html.includes(`data-architecture-tool="${k}"`)));
ok('optional bypass sealing is a first-class authored action', html.includes('function sealOptionalBypass()'));

console.log(`smoke-performance-architecture-integration: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
