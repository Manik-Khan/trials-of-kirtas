// far-right swap: candidate filtering, the hidden-flag exchange, reversibility, edit preservation.
// Updated for the effective-aware swap: showing an action sets hidden to the value that beats its
// DEFAULT (a versatile two-handed mode ships defaultHidden, so it needs an explicit hidden:false).
import { assembleActions } from './weapon-actions.js';
let pass=0,fail=0; const ok=(n,c,d)=>{c?pass++:(fail++,console.log('  FAIL:',n,d!==undefined?JSON.stringify(d):''));};
const struct=(ov)=>({proficiencyBonus:2,level:5,abilities:{str:{mod:3},dex:{mod:2}},proficiencies:{weapons:['simple weapons','martial weapons']},actionOverrides:ov});
// non-versatile weapons → both attacks are default-SHOWN, so the override-shape assertions hold
const inv=[{name:'Scimitar'},{name:'Dagger'},{name:'Mace'}];
const swapGroupOf=t=>(t==='attack'||t==='attack-cantrip')?'attack':(t==='damage-only'?'damage':'utility');
// mirrors doSwap in sheet-actions: collapse to the action's default when want===def, else set explicitly
const defHiddenOf=(inventory,ov,id)=>{const a=assembleActions(inventory,struct(ov),{includeHidden:true}).find(x=>(x.id||x.label)===id);return !!(a&&a.defaultHidden);};
const setHidden=(ov,id,want,def)=>{const o=ov[id]||(ov[id]={});if(want===def){delete o.hidden;if(!Object.keys(o).length)delete ov[id];}else o.hidden=want;};
const applySwap=(inventory,ov,curId,inId)=>{ov=JSON.parse(JSON.stringify(ov||{}));setHidden(ov,curId,true,defHiddenOf(inventory,ov,curId));setHidden(ov,inId,false,defHiddenOf(inventory,ov,inId));return ov;};

let base=assembleActions(inv, struct(), {includeHidden:true}).filter(a=>swapGroupOf(a.type)==='attack');
ok('≥2 distinct weapon attacks to work with', base.length>=2 && base[0].id!==base[1].id, base.map(a=>a.id));
let A=base[0].id, B=base[1].id;

// B hidden (swapped out)
let ov1={}; ov1[B]={hidden:true};
let shown1=assembleActions(inv, struct(ov1)).map(a=>a.id);
ok('B hidden → not in rendered list', shown1.indexOf(B)===-1, shown1);
ok('A still rendered', shown1.indexOf(A)!==-1);

// swap A -> B: hide A, bring B back
let ov2=applySwap(inv, ov1, A, B);
let shown2=assembleActions(inv, struct(ov2)).map(a=>a.id);
ok('after swap: A hidden (gone)', shown2.indexOf(A)===-1, shown2);
ok('after swap: B shown again', shown2.indexOf(B)!==-1, shown2);
ok('after swap: B override cleaned to nothing', !ov2[B], ov2[B]);
ok('after swap: A override = {hidden:true} only', ov2[A]&&ov2[A].hidden===true&&Object.keys(ov2[A]).length===1, ov2[A]);

// reversible
let ov3=applySwap(inv, ov2, B, A);
let shown3=assembleActions(inv, struct(ov3)).map(a=>a.id);
ok('reversible: A back, B hidden', shown3.indexOf(A)!==-1 && shown3.indexOf(B)===-1, shown3);

// candidate list = hidden, same group, excluding current
let all=assembleActions(inv, struct(ov1), {includeHidden:true});
let cur=all.find(a=>(a.id||a.label)===A), curG=swapGroupOf(cur.type);
let cands=all.filter(a=>a._hidden && swapGroupOf(a.type)===curG && (a.id||a.label)!==A);
ok('candidates = hidden same-group attacks (B)', cands.length===1 && cands[0].id===B, cands.map(c=>c.id));

// swapping in an EDITED+hidden attack keeps its edits, just un-hides
let ovE={}; ovE[B]={hidden:true,label:'Custom Blade',dmgBonus:2};
let ovE2=applySwap(inv, ovE, A, B);
ok('swap-in preserves edits (label+bonus kept, hidden cleared)', ovE2[B]&&ovE2[B].label==='Custom Blade'&&ovE2[B].dmgBonus===2&&!ovE2[B].hidden, ovE2[B]);

// ── versatile weapon: two-handed mode ships HIDDEN (swap pile), swaps in via hidden:false ──
const vinv=[{name:'Longsword'}];
const vAll=assembleActions(vinv, struct(), {includeHidden:true});
const oneH=vAll.find(a=>a.id==='wpn-longsword'), twoH=vAll.find(a=>a.id==='wpn-longsword-2h');
ok('versatile: emits 1H + 2H, 2H defaultHidden', oneH && twoH && twoH.defaultHidden===true, {oneH:!!oneH,twoH:!!twoH});
ok('versatile: 1H shown, 2H hidden by default', oneH && !oneH._hidden && twoH && twoH._hidden===true, {oneH_hidden:oneH&&oneH._hidden,twoH_hidden:twoH&&twoH._hidden});
ok('versatile: 2H absent from normal render', assembleActions(vinv,struct()).every(a=>a.id!=='wpn-longsword-2h'));
ok('versatile: 2H is a swap candidate for the 1H', vAll.filter(a=>a._hidden&&swapGroupOf(a.type)==='attack'&&a.id!=='wpn-longsword').some(a=>a.id==='wpn-longsword-2h'));
// swap to 2H
const vov=applySwap(vinv, {}, 'wpn-longsword', 'wpn-longsword-2h');
const vShown=assembleActions(vinv, struct(vov)).map(a=>a.id);
ok('versatile swap: 2H shown, 1H hidden', vShown.indexOf('wpn-longsword-2h')!==-1 && vShown.indexOf('wpn-longsword')===-1, vShown);
ok('versatile swap: 2H override = {hidden:false} (explicit show)', vov['wpn-longsword-2h']&&vov['wpn-longsword-2h'].hidden===false, vov['wpn-longsword-2h']);
ok('versatile swap: 1H override = {hidden:true}', vov['wpn-longsword']&&vov['wpn-longsword'].hidden===true, vov['wpn-longsword']);
// swap back → both collapse to defaults (no overrides needed)
const vov2=applySwap(vinv, vov, 'wpn-longsword-2h', 'wpn-longsword');
const vShown2=assembleActions(vinv, struct(vov2)).map(a=>a.id);
ok('versatile swap back: 1H shown, 2H hidden', vShown2.indexOf('wpn-longsword')!==-1 && vShown2.indexOf('wpn-longsword-2h')===-1, vShown2);
ok('versatile swap back: both overrides collapse to default (empty)', !vov2['wpn-longsword'] && !vov2['wpn-longsword-2h'], {a:vov2['wpn-longsword'],b:vov2['wpn-longsword-2h']});

// swap button gating (mirrors actionRowHTML)
const swapBtn=a=>swapGroupOf(a.type)==='utility'?'':'<button type="button" class="ac-swap" data-act-swap="'+(a.id||a.label)+'">';
ok('attack row → swap button present', /data-act-swap/.test(swapBtn({id:'atk-x',type:'attack'})));
ok('bonus-damage row → swap button present', /data-act-swap/.test(swapBtn({id:'d-x',type:'damage-only'})));
ok('utility row → no swap button', swapBtn({id:'u-x',type:'utility'})==='');

console.log('\nsmoke-attack-swap: '+pass+' passed, '+fail+' failed'); if(fail)process.exit(1);
