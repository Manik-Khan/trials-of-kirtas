// UI wiring for the cantrip bind: menu data source, renderer input, the NEW config-chip HTML,
// and the round-trip. The cantrip weapon switch now lives in the unified .ac-cfg chip's menu
// (openChipMenu), which derives the cantrip name from the action label rather than a data attr.
import { assembleActions, meleeWeaponOptions, buildCantripAttacks } from '../../weapon-actions.js';
let pass=0,fail=0; const ok=(n,c,d)=>{c?pass++:(fail++,console.log('  FAIL:',n,d!==undefined?JSON.stringify(d):''));};
const sc={spellcasting:{groups:[{level:0,heading:'Cantrips',spells:[{name:'Booming Blade'}]}]}};
const base=(inv,extra)=>Object.assign({proficiencyBonus:2,level:5,combat:{spellAttackBonus:5},abilities:{str:{mod:3},dex:{mod:2},cha:{mod:0},int:{mod:0}},proficiencies:{weapons:['simple weapons','martial weapons']}},sc,extra||{});
const bb=a=>a.find(x=>/booming/i.test(x.label));

// 1) menu data source: melee only, de-duped, item name preserved
let opts=meleeWeaponOptions([{name:'Longsword'},{name:'Dagger'},{name:'Shortbow'},{name:'Longsword'}]);
ok('meleeWeaponOptions: melee only, deduped', opts.length===2 && opts.map(o=>o.key).join(',')==='longsword,dagger', opts);
ok('meleeWeaponOptions: keeps display name', meleeWeaponOptions([{name:'Flame Tongue Longsword'}])[0].name==='Flame Tongue Longsword');

// 2) renderer input: cantrip action carries the stable id + bound-weapon label + a to-hit ability
let inv=[{name:'Longsword'},{name:'Dagger'}];
let a=bb(assembleActions(inv, base(inv,{cantripBinds:{'booming blade':'dagger'}}),{includeHidden:true}));
ok('cantrip action id stable', a&&a.id==='cant-boomingblade', a&&a.id);
ok('cantrip label shows bound weapon', a&&/Booming Blade \u00B7 Dagger/.test(a.label), a&&a.label);
ok('cantrip action carries an ability (drives the chip)', a&&typeof a.ability==='string'&&a.ability.length===3, a&&a.ability);

// 3) the NEW config-chip logic from actionRowHTML — blue .ac-cfg on every ATTACK row, shows ability
function esc(x){return String(x==null?'':x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function actionGroup(t){return (t==='attack'||t==='attack-cantrip')?'attack':(t==='damage-only'?'damage':'utility');}
function cfgChipFor(x){
  var g=actionGroup(x.type); if(g!=='attack'||!x.ability) return '';
  var id=esc(x.id||x.label||''), isCant=String(x.id||'').indexOf('cant-')===0;
  return ' <span class="ac-cfg" data-act-cfg="'+id+'" role="button" tabindex="0" title="'+(isCant?'Switch modifier or weapon':'Switch modifier')+'">'+esc(String(x.ability).toUpperCase())+'<span class="ac-cfg-car">\u25BE</span></span>';
}
let chip=cfgChipFor(a);
ok('chip: has ac-cfg span on the cantrip attack', /class="ac-cfg"/.test(chip), chip);
ok('chip: data-act-cfg = action id', /data-act-cfg="cant-boomingblade"/.test(chip), chip);
ok('chip: shows current ability + caret', new RegExp(esc(a.ability.toUpperCase())+'<span class="ac-cfg-car">').test(chip), chip);
ok('chip: cantrip title offers weapon + modifier', /Switch modifier or weapon/.test(chip), chip);
// a weapon attack also gets the chip, but with the modifier-only title
let wchip=cfgChipFor({id:'wpn-longsword',type:'attack',ability:'str',label:'Longsword'});
ok('weapon attack: chip present, modifier-only title', /class="ac-cfg"/.test(wchip)&&/title="Switch modifier"/.test(wchip), wchip);
// spell-attack cantrips (no ability) and damage-only rows get NO chip
ok('spell-attack cantrip (no ability): no chip', cfgChipFor({id:'sp-firebolt',type:'attack-cantrip',label:'Fire Bolt'})==='');
ok('damage-only row: no chip', cfgChipFor({id:'sp-x',type:'damage-only',ability:'cha',label:'Eldritch Blast'})==='');

// 4) the chip menu derives the cantrip name from the label (as openChipMenu does), and that
//    name, used as the cantripBinds key, actually rebinds the cantrip
let cantripKey=String((a.label||'').split(' \u00B7 ')[0]||'').trim().toLowerCase();
ok('cantrip name parsed from label', cantripKey==='booming blade', cantripKey);
let reb=bb(buildCantripAttacks(inv, base(inv,{cantripBinds:{[cantripKey]:'longsword'}})));
ok('round-trip: parsed key drives buildCantripAttacks', reb&&/Longsword/.test(reb.label), reb&&reb.label);
// clearing the bind ('' / Auto) falls back to first melee
let auto=bb(buildCantripAttacks(inv, base(inv,{cantripBinds:{}})));
ok('Auto (no bind) → first melee (Longsword)', auto&&/Longsword/.test(auto.label), auto&&auto.label);

console.log('\nsmoke-cantrip-bind-ui: '+pass+' passed, '+fail+' failed'); if(fail)process.exit(1);
