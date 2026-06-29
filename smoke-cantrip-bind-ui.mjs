// UI wiring for the cantrip-bind: menu data source, renderer input, chip HTML, and the round-trip
import { assembleActions, meleeWeaponOptions, buildCantripAttacks } from './weapon-actions.js';
let pass=0,fail=0; const ok=(n,c,d)=>{c?pass++:(fail++,console.log('  FAIL:',n,d!==undefined?JSON.stringify(d):''));};
const sc={spellcasting:{groups:[{level:0,heading:'Cantrips',spells:[{name:'Booming Blade'}]}]}};
const base=(inv,extra)=>Object.assign({proficiencyBonus:2,level:5,combat:{spellAttackBonus:5},abilities:{str:{mod:3},dex:{mod:2},cha:{mod:0},int:{mod:0}},proficiencies:{weapons:['simple weapons','martial weapons']}},sc,extra||{});
const bb=a=>a.find(x=>/booming/i.test(x.label));

// 1) menu data source: melee only, de-duped, item name preserved
let opts=meleeWeaponOptions([{name:'Longsword'},{name:'Dagger'},{name:'Shortbow'},{name:'Longsword'}]);
ok('meleeWeaponOptions: melee only, deduped', opts.length===2 && opts.map(o=>o.key).join(',')==='longsword,dagger', opts);
ok('meleeWeaponOptions: keeps display name', meleeWeaponOptions([{name:'Flame Tongue Longsword'}])[0].name==='Flame Tongue Longsword');

// 2) renderer input: cantrip action carries the stable id + bound-weapon label
let inv=[{name:'Longsword'},{name:'Dagger'}];
let a=bb(assembleActions(inv, base(inv,{cantripBinds:{'booming blade':'dagger'}}),{includeHidden:true}));
ok('cantrip action id stable', a&&a.id==='cant-boomingblade', a&&a.id);
ok('cantrip label shows bound weapon', a&&/Booming Blade \u00B7 Dagger/.test(a.label), a&&a.label);

// 3) the EXACT chip-building logic from actionRowHTML
function esc(x){return String(x==null?'':x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function nameHTMLfor(a){var nameHTML=esc(a.label||'');
  if(String(a.id||'').indexOf('cant-')===0){var bp=String(a.label||'').split(' \u00B7 ');
    if(bp.length===2) nameHTML=esc(bp[0])+' \u00B7 <span class="ac-bind" data-act-bind="'+esc(bp[0].trim().toLowerCase())+'" role="button" tabindex="0">'+esc(bp[1])+'<span class="ac-bind-caret">\u25BE</span></span>';}
  return nameHTML;}
let chip=nameHTMLfor(a);
ok('chip: has ac-bind span', /class="ac-bind"/.test(chip), chip);
ok('chip: data-act-bind = cantrip key', /data-act-bind="booming blade"/.test(chip), chip);
ok('chip: shows weapon name + caret', /Dagger<span class="ac-bind-caret">/.test(chip), chip);
// non-cantrip rows get a plain label, no chip
ok('weapon row: plain label, no chip', nameHTMLfor({id:'atk-longsword',label:'Longsword'})==='Longsword');
// a cantrip whose label somehow lacks the separator stays plain (guard)
ok('cantrip w/o separator: stays plain', nameHTMLfor({id:'cant-x',label:'Foo'})==='Foo');

// 4) round-trip: the data-act-bind value, used as the cantripBinds key, actually rebinds the cantrip
let key=(chip.match(/data-act-bind="([^"]+)"/)||[])[1];
let reb=bb(buildCantripAttacks(inv, base(inv,{cantripBinds:{[key]:'longsword'}})));
ok('round-trip: chip key drives buildCantripAttacks', reb&&/Longsword/.test(reb.label), reb&&reb.label);
// clearing the bind ('' / Auto) falls back to first melee
let auto=bb(buildCantripAttacks(inv, base(inv,{cantripBinds:{}})));
ok('Auto (no bind) → first melee (Longsword)', auto&&/Longsword/.test(auto.label), auto&&auto.label);

console.log('\nsmoke-cantrip-bind-ui: '+pass+' passed, '+fail+' failed'); if(fail)process.exit(1);
