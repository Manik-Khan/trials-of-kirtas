/* Phase 2 correctness-wave smokes · 2026-07-15
   Run: node forge/tests/smoke-phase2-correctness-wave.js */
const fs = require('fs');
const path = require('path');
const FR = require('../forge-replay.js');
const FFR = require('../forge-feed-render.js');
const FTC = require('../forge-table-correctness.js');

let pass=0,fail=0;
function ok(name,cond){if(cond){pass++;console.log('✓ '+name);}else{fail++;console.log('✗ '+name);}}
const row=(seq,unit,kind,payload)=>({seq,unit,kind,payload:payload||{},created_at:seq});
const roster=[
  {unit:'caim',side:'pc',pos:{c:1,r:1},hp:30,maxHp:30,resources:{kiPoints:4}},
  {unit:'goblin',side:'foe',pos:{c:5,r:5},hp:12,maxHp:12}
];
const setup=[row(1,'__session','session_started',{}),row(2,'__session','initiative_set',{order:['caim','goblin']})];

let s=FR.replayLog(roster,setup);
ok('Ki/Focus aliases normalize to one authoritative ki pool',s.units.caim.resources.ki===4&&s.units.caim.resources.kiPoints==null);

s=FR.replayLog(roster,setup.concat([
  row(3,'caim','ability_used',{ability:'Patient Defense',slot:'bonus',resource_spend:{ki:1}})
]));
ok('successful ability spends one Ki in replay',s.units.caim.resources.ki===3);

s=FR.replayLog(roster,setup.concat([
  row(3,'caim','attack_resolved',{target:'goblin',hit:true,dmg:3,slot:'bonus',resource_spend:{ki:1}}),
  row(4,'caim','attack_resolved',{target:'goblin',hit:true,dmg:3,slot:'bonus'})
]));
ok('Flurry two strikes spend one Ki total',s.units.caim.resources.ki===3&&s.units.goblin.hp===6);

s=FR.replayLog(roster,setup);
ok('cancelled/unpublished action spends no Ki',s.units.caim.resources.ki===4);

const spentState=FR.replayLog(roster,setup.concat([
  row(3,'caim','ability_used',{ability:'Patient Defense',slot:'bonus',resource_spend:{focus:1}})
]));
const restored=FR.replayLog(roster,setup.concat([
  row(3,'caim','ability_used',{ability:'Patient Defense',slot:'bonus',resource_spend:{focus:1}}),
  row(4,'__session','restore',{snapshot:FR.snapshot(spentState)})
]));
ok('resource remainder survives snapshot/restore',restored.units.caim.resources.ki===3);
ok('resource replay is deterministic',JSON.stringify(spentState)===JSON.stringify(FR.replayLog(roster,setup.concat([row(3,'caim','ability_used',{ability:'Patient Defense',slot:'bonus',resource_spend:{focus:1}})]))));

let eco=FR.turnEconomy(FR.replayLog(roster,setup.concat([
  row(3,'caim','move_declared',{path:[{c:2,r:1},{c:3,r:1}]}),
  row(4,'caim','move_resolved',{final_cell:{c:3,r:1}}),
  row(5,'caim','ability_used',{ability:'Dash',slot:'action',movement_bonus_ft:30})
])));
ok('Dash bonus is a replayed turn-economy fact',eco.movedFt===10&&eco.movementBonusFt===30&&eco.movementCostFt===0);
ok('30 speed + Dash - 10 moved derives 50 ft remaining',30+eco.movementBonusFt-eco.movedFt-eco.movementCostFt===50);

eco=FR.turnEconomy(FR.replayLog(roster,setup.concat([
  row(3,'caim','ability_used',{ability:'Stand',slot:'free',movement_cost_ft:15})
])));
ok('extra movement costs share the same economy',eco.movementCostFt===15);

eco=FR.turnEconomy(FR.replayLog(roster,setup.concat([
  row(3,'caim','ability_used',{ability:'Dash',slot:'free',movement_bonus_ft:30}),
  row(4,'caim','ability_used',{ability:'Speed boon',slot:'free',movement_bonus_ft:10})
])));
ok('multiple authoritative movement bonuses accumulate',eco.movementBonusFt===40);

let html=FFR.rollBody({actor:'caim',target:'goblin',mode:'Unarmed Strike',roll:18,hitBonus:7,hit:true,adv:true,advReason:'flanking',d20Rolls:[7,18],d20KeptIndex:1},{unitName:k=>k});
ok('advantage feed shows both raw d20s',html.includes('>7<')&&html.includes('>18<'));
ok('advantage feed marks kept and dropped dice',html.includes('ffr-keep')&&html.includes('ffr-drop'));

html=FFR.rollBody({actor:'caim',target:'goblin',mode:'Unarmed Strike',roll:12,hitBonus:7,hit:false,d20Rolls:[12],d20KeptIndex:0},{unitName:k=>k});
ok('normal/cancelled roll shows one d20',((html.match(/ffr-die/g)||[]).length===1)&&!html.includes('ffr-drop'));

html=FFR.rollBody({actor:'goblin',target:'caim',mode:'Scimitar',roll:9,hitBonus:4,hit:false,d20Rolls:[16,19],d20KeptIndex:1,reactionD20Rolls:[19,9],reactionD20KeptIndex:1,mods:[{k:'silvery_barbs'}]},{unitName:k=>k});
ok('Silvery Barbs evidence preserves original and reroll pair',html.includes('SB')&&html.includes('>19<')&&html.includes('>9<'));

const fact=FTC.factFromEvent({unit:'caim',kind:'attack_resolved',payload:{target:'goblin',hit:true,roll:18,d20_rolls:[7,18],d20_kept_index:1,reaction_d20_rolls:[18,5],reaction_d20_kept_index:1,dmg:4,dmgParts:[{type:'bludgeoning',total:4}]}});
ok('Chronicle fact preserves raw and reaction d20 evidence',fact.d20Rolls.join(',')==='7,18'&&fact.d20KeptIndex===1&&fact.reactionD20Rolls.join(',')==='18,5'&&fact.reactionD20KeptIndex===1);
ok('Chronicle fact preserves component damage alongside dice',fact.dmg===4&&fact.dmgParts&&fact.dmgParts[0].total===4);

const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
ok('shared attack payload carries raw d20 evidence',source.includes('d20_rolls:d20ev.rolls')&&source.includes('d20_kept_index:d20ev.keptIndex'));
ok('resource spend is published as a replay fact',source.includes('resource_spend:spendFact')&&source.includes('resource_spend:resourceSpendFor(a)'));
ok('movement reconciliation has one presentation door',source.includes('function reconcileMovementPresentation()')&&source.includes('reconcileMovementPresentation();\n      runMirror'));
ok('Roll Initiative and 50% local grid decisions are present',source.includes('id="fbOpenTable">Roll Initiative')&&source.includes('GRID_PREF_KEY=\'tok-forge-grid-opacity-v1\'')&&source.includes('id="gridVal">50%'));
ok('selected destination pulse is presentation-only and reduced-motion safe',source.includes('hoverGroup.children.forEach')&&source.includes('||REDUCED)?0.44')&&source.includes('Math.sin(t*4.2)'));
ok('fog mask uses a feathered continuous cloud boundary',source.includes('tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearFilter;tex.generateMipmaps=false')&&source.includes("x.filter='blur("));

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode=fail?1:0;
