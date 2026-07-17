// per-cantrip weapon binding + bound-weapon magic inheritance
import { buildCantripAttacks } from '../../weapon-actions.js';
let pass=0,fail=0; const ok=(n,c,d)=>{c?pass++:(fail++,console.log('  FAIL:',n,d!==undefined?JSON.stringify(d):''));};
const sc={spellcasting:{groups:[{level:0,heading:'Cantrips',spells:[{name:'Booming Blade'}]}]}};
const base=(inv,extra)=>Object.assign({proficiencyBonus:2,level:3,combat:{spellAttackBonus:5},abilities:{str:{mod:3},dex:{mod:2},cha:{mod:0},int:{mod:0}},proficiencies:{weapons:['simple weapons','martial weapons']}},sc,extra||{});
const bb=a=>a.find(x=>/booming/i.test(x.label));

let inv=[{name:'Longsword'},{name:'Dagger'}];
let a=bb(buildCantripAttacks(inv,base(inv)));
ok('default rides first melee (Longsword)', a&&/Longsword/.test(a.label), a&&a.label);
ok('stable id (no weapon suffix)', a&&a.id==='cant-boomingblade', a&&a.id);

a=bb(buildCantripAttacks(inv,base(inv,{cantripBinds:{'booming blade':'dagger'}})));
ok('bound to Dagger → label + die 1d4', a&&/Dagger/.test(a.label)&&a.dmgDice==='1d4', a&&{l:a.label,d:a.dmgDice});
ok('id stays stable across bind', a&&a.id==='cant-boomingblade', a&&a.id);

inv=[{name:'Longsword'},{name:'Rapier, +1',atkBonus:1,dmgBonus:1}];
a=bb(buildCantripAttacks(inv,base(inv,{cantripBinds:{'booming blade':'rapier'}})));
ok('bound +1 rapier → cantrip atkBonus 1', a&&a.atkBonus===1, a&&a.atkBonus);
ok('bound +1 rapier → cantrip dmgBonus 1', a&&a.dmgBonus===1, a&&a.dmgBonus);
ok('bound weapon label shows item name', a&&/Rapier/.test(a.label), a&&a.label);

inv=[{name:'Flame Tongue Longsword',extraDmg:{dice:'2d6',type:'Fire'}}];
a=bb(buildCantripAttacks(inv,base(inv,{cantripBinds:{'booming blade':'longsword'}})));
ok('bound flame weapon → cantrip extraDamage 2d6', a&&a.extraDamage&&a.extraDamage[0].dice==='2d6'&&/fire/i.test(a.extraDamage[0].type), a&&a.extraDamage);

inv=[{name:'Longsword'}];
a=bb(buildCantripAttacks(inv,base(inv,{cantripBinds:{'booming blade':'rapier'}})));
ok('bind to uncarried weapon → falls back to carried Longsword', a&&/Longsword/.test(a.label), a&&a.label);

a=bb(buildCantripAttacks([{name:'Longsword'}],base([{name:'Longsword'}],{features:[{name:'Hex Warrior'}],abilities:{str:{mod:0},dex:{mod:1},cha:{mod:4},int:{mod:0}}})));
ok('Hexblade cantrip ability → CHA (shared weaponProfile)', a&&a.ability==='cha', a&&a.ability);

ok('no melee weapon → no cantrip attacks', buildCantripAttacks([{name:'Shortbow'}],base([{name:'Shortbow'}])).length===0);

console.log('\nsmoke-cantrip-bind: '+pass+' passed, '+fail+' failed'); if(fail)process.exit(1);
