const A = require('../forge-architecture.js');
const Engine = require('../forge-engine.js');
const Foundation = require('../forge-generator-foundation.js');

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

ok('architecture version is pinned', A.VERSION === 2 && A.SCHEMA === 'forge-architecture');
ok('version-1 records migrate without losing blocks', A.normalizeRecord({ schema: A.SCHEMA, version: 1, blocks: [{ c: 1, r: 1, kind: 'wall' }] }).blocks.length === 1);
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
const raisedRecord = A.record([{ c: 2, r: 0, kind: 'wall', heightFt: 20.5 }]);
const raisedMap = A.apply(map, raisedRecord);
ok('seeded retaining walls accept an absolute raised height', raisedMap.wall[2] && raisedMap.occ[2] === 20.5 && raisedMap.coverShape[2].heightFt === 20.5);
ok('raised wall application is idempotent across saved snapshots', A.apply(raisedMap, raisedRecord).occ[2] === 20.5);

const regions = A.regionIndex(intent);
ok('region index identifies authored platform cells', regions.at(1, 2) === 'lower-court');
ok('retaining band inherits its nearest whole region', regions.at(0, 1) === 'approach');
const states = A.regionStates(regions, [{ c: 1, r: 2 }], [{ c: 0, r: 0 }]);
ok('current region becomes fully visible', A.regionStateAt(regions, states, 1, 2) === 2);
ok('prior region becomes grey memory', A.regionStateAt(regions, states, 0, 0) === 1);
ok('unentered regions default to grey unknown', A.regionStateAt(regions, {}, 0, 2) === 0);

const temple = Engine.generateDetailed({ seed: 7, themeKey: 'temple', generatorProfile: 'intentional-archetype', archetype: 'temple-terraces', roomCount: 8 }).map;
const seededWallIndex = temple.wall.findIndex((blocked, i) => blocked && Number.isFinite(Number(temple.occ[i])) && Number(temple.occ[i]) > 0);
const seededWallEdit = { c: seededWallIndex % temple.cols, r: Math.floor(seededWallIndex / temple.cols), kind: 'wall', heightFt: temple.occ[seededWallIndex] + 10 };
const raisedTemple = A.apply(temple, A.record([seededWallEdit]));
const restoredRaisedTemple = Foundation.restoreMap(Foundation.snapshotMap(raisedTemple));
ok('real seeded Temple wall gains ten feet of sight authority', raisedTemple.occ[seededWallIndex] === temple.occ[seededWallIndex] + 10);
ok('raised seeded-wall height survives the exact snapshot', restoredRaisedTemple.meta.architecture.blocks[0].heightFt === seededWallEdit.heightFt && restoredRaisedTemple.occ[seededWallIndex] === seededWallEdit.heightFt);
ok('restoring and reapplying a raised wall cannot double its height', A.apply(restoredRaisedTemple, restoredRaisedTemple.meta.architecture).occ[seededWallIndex] === seededWallEdit.heightFt);
const seededParapetEdit = { c: seededWallIndex % temple.cols, r: Math.floor(seededWallIndex / temple.cols), kind: 'parapet', heightFt: temple.occ[seededWallIndex] + 5 };
const parapetedTemple = A.apply(temple, A.record([seededParapetEdit]));
const restoredParapetedTemple = Foundation.restoreMap(Foundation.snapshotMap(parapetedTemple));
ok('real seeded Temple wall accepts a five-foot parapet extension', parapetedTemple.occ[seededWallIndex] === temple.occ[seededWallIndex] + 5 && parapetedTemple.coverShape[seededWallIndex].source === 'authored-parapet');
ok('seeded parapet height survives the exact snapshot without doubling', restoredParapetedTemple.occ[seededWallIndex] === seededParapetEdit.heightFt && A.apply(restoredParapetedTemple, restoredParapetedTemple.meta.architecture).occ[seededWallIndex] === seededParapetEdit.heightFt);
const optionalRoute = temple.meta.intent.routes.find(route => !route.required);
const optionalConnector = temple.connectors.find(connector => connector.id === optionalRoute.connectorIds[0]);
const optionalMiddle = optionalConnector.path[1];
const authoredTemple = A.apply(temple, A.record([{ c: optionalMiddle.c, r: optionalMiddle.r, kind: 'wall' }]));
ok('authored cover authority spans the full battlefield', authoredTemple.coverShape.length === authoredTemple.cols * authoredTemple.rows);
ok('real Temple optional connector closes under an authored wall', authoredTemple.connectors.find(c => c.id === optionalConnector.id).state === 'closed');
ok('real vertical contract accepts the explicit optional closure', Engine._internals.validateVerticalRecords(authoredTemple));
const restoredTemple = Foundation.restoreMap(Foundation.snapshotMap(authoredTemple));
ok('authored block record survives the exact map snapshot', restoredTemple.meta.architecture.blocks.some(b => b.c === optionalMiddle.c && b.r === optionalMiddle.r && b.kind === 'wall'));
ok('authored wall movement and sight authority survive restore', restoredTemple.wall[optionalMiddle.r * restoredTemple.cols + optionalMiddle.c] && restoredTemple.occ[optionalMiddle.r * restoredTemple.cols + optionalMiddle.c] === 10);
ok('optional connector closure survives restore', restoredTemple.connectors.find(c => c.id === optionalConnector.id).state === 'closed' && restoredTemple.connectors.find(c => c.id === optionalConnector.id).architectureClosed === true);

console.log(`smoke-architecture: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
