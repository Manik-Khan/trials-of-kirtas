const A = require('../forge-architecture.js');
const Engine = require('../forge-engine.js');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) pass++; else { fail++; console.log('FAIL: ' + name); } }

const intent = {
  archetype: 'temple-terraces',
  regions: [
    { id: 'approach', cells: [{ c: 0, r: 0 }, { c: 1, r: 0 }] },
    { id: 'lower-court', cells: [{ c: 0, r: 2 }, { c: 1, r: 2 }] }
  ],
  routes: [{ id: 'primary', required: true, connectorIds: ['stairs'] }, { id: 'optional', required: false, connectorIds: ['side'] }]
};
const map = {
  cols: 3, rows: 3, h: Array(9).fill(0), wall: [false, false, true, false, false, true, false, false, true],
  occ: Array(9).fill(0), coverShape: Array(9).fill(null),
  connectors: [
    { id: 'stairs', path: [{ c: 0, r: 0 }, { c: 0, r: 1 }, { c: 0, r: 2 }] },
    { id: 'side', path: [{ c: 1, r: 0 }, { c: 1, r: 1 }, { c: 1, r: 2 }] }
  ], meta: { intent }
};

ok('architecture version is pinned', A.VERSION === 1 && A.SCHEMA === 'forge-architecture');
ok('invalid blocks are discarded', A.record([{ c: 1, r: 1, kind: 'dragon' }]).blocks.length === 0);
ok('last edit owns a cell', A.record([{ c: 1, r: 1, kind: 'wall' }, { c: 1, r: 1, kind: 'gate' }]).blocks[0].kind === 'gate');
const wallRecord = A.record([{ c: 1, r: 1, kind: 'wall' }]);
const wallMap = A.apply(map, wallRecord);
ok('10-foot wall blocks movement', wallMap.wall[4] === true);
ok('10-foot wall owns 10 feet of occlusion', wallMap.occ[4] === 10);
ok('wall cover shape is explicit', wallMap.coverShape[4].source === 'authored-wall');
const parapetMap = A.apply(map, A.record([{ c: 1, r: 1, kind: 'parapet' }]));
ok('parapet blocks its cell', parapetMap.wall[4] === true);
ok('parapet owns 5 feet of occlusion', parapetMap.occ[4] === 5);
const gateMap = A.apply(wallMap, A.record([{ c: 1, r: 1, kind: 'gate' }]));
ok('gate is passable', gateMap.wall[4] === false);
ok('gate does not occlude sight', gateMap.occ[4] === 0 && gateMap.coverShape[4] === null);
ok('optional bypass may be sealed', A.audit(map, wallRecord).ok);
ok('sealed bypass closes its optional connector explicitly', wallMap.connectors.find(c => c.id === 'side').state === 'closed' && wallMap.connectors.find(c => c.id === 'side').architectureClosed === true);
const blockedPrimary = A.record([{ c: 0, r: 1, kind: 'wall' }]);
ok('required stair block is rejected by audit', !A.audit(map, blockedPrimary).ok);
ok('required stair error narrates the exact cell', A.audit(map, blockedPrimary).errors.some(e => e.includes('0,1')));
ok('gate repairs a required stair block', A.audit(map, A.editRecord(blockedPrimary, { c: 0, r: 1, kind: 'gate' })).ok);
ok('erase restores the seed-owned cell', A.eraseRecord(wallRecord, 1, 1).blocks.length === 0);

const regions = A.regionIndex(intent);
ok('region index identifies authored platform cells', regions.at(1, 2) === 'lower-court');
ok('retaining band inherits its nearest whole region', regions.at(0, 1) === 'approach');
const states = A.regionStates(regions, [{ c: 1, r: 2 }], [{ c: 0, r: 0 }]);
ok('current region becomes fully visible', A.regionStateAt(regions, states, 1, 2) === 2);
ok('prior region becomes grey memory', A.regionStateAt(regions, states, 0, 0) === 1);
ok('unentered regions default to grey unknown', A.regionStateAt(regions, {}, 0, 2) === 0);

const temple = Engine.generateDetailed({ seed: 7, themeKey: 'temple', generatorProfile: 'intentional-archetype', archetype: 'temple-terraces', roomCount: 8 }).map;
const optionalRoute = temple.meta.intent.routes.find(route => !route.required);
const optionalConnector = temple.connectors.find(connector => connector.id === optionalRoute.connectorIds[0]);
const optionalMiddle = optionalConnector.path[1];
const authoredTemple = A.apply(temple, A.record([{ c: optionalMiddle.c, r: optionalMiddle.r, kind: 'wall' }]));
ok('real Temple optional connector closes under an authored wall', authoredTemple.connectors.find(c => c.id === optionalConnector.id).state === 'closed');
ok('real vertical contract accepts the explicit optional closure', Engine._internals.validateVerticalRecords(authoredTemple));

console.log(`smoke-architecture: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
