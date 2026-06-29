// far-right swap: candidate filtering, the hidden-flag exchange, reversibility, edit preservation
import { assembleActions } from './weapon-actions.js';
let pass=0,fail=0; const ok=(n,c,d)=>{c?pass++:(fail++,console.log('  FAIL:',n,d!==undefined?JSON.stringify(d):''));};
const struct=(ov)=>({proficiencyBonus:2,level:5,abilities:{str:{mod:3},dex:{mod:2}},proficiencies:{weapons:['simple weapons','martial weapons']},actionOverrides:ov});
const inv=[{name:'Longsword'},{name:'Dagger'},{name:'Mace'}];
const swapGroupOf=t=>(t==='attack'||t==='attack-cantrip')?'attack':(t==='damage-only'?'damage':'utility');
const applySwap=(ov,curId,inId)=>{ov=JSON.parse(JSON.stringify(ov||{}));(ov[curId]||(ov[curId]={})).hidden=true;var b=ov[inId];if(b){delete b.hidden;if(!Object.keys(b).length)delete ov[inId];}return ov;};

let base=assembleActions(inv, struct(), {includeHidden:true}).filter(a=>swapGroupOf(a.type)==='attack');
ok('≥2 distinct weapon attacks to work with', base.length>=2 && base[0].id!==base[1].id, base.map(a=>a.id));
let A=base[0].id, B=base[1].id;

// B hidden (swapped out)
let ov1={}; ov1[B]={hidden:true};
let shown1=assembleActions(inv, struct(ov1)).map(a=>a.id);
ok('B hidden → not in rendered list', shown1.indexOf(B)===-1, shown1);
ok('A still rendered', shown1.indexOf(A)!==-1);

// swap A -> B: hide A, bring B back
let ov2=applySwap(ov1, A, B);
let shown2=assembleActions(inv, struct(ov2)).map(a=>a.id);
ok('after swap: A hidden (gone)', shown2.indexOf(A)===-1, shown2);
ok('after swap: B shown again', shown2.indexOf(B)!==-1, shown2);
ok('after swap: B override cleaned to nothing', !ov2[B], ov2[B]);
ok('after swap: A override = {hidden:true} only', ov2[A]&&ov2[A].hidden===true&&Object.keys(ov2[A]).length===1, ov2[A]);

// reversible
let ov3=applySwap(ov2, B, A);
let shown3=assembleActions(inv, struct(ov3)).map(a=>a.id);
ok('reversible: A back, B hidden', shown3.indexOf(A)!==-1 && shown3.indexOf(B)===-1, shown3);

// candidate list = hidden, same group, excluding current
let all=assembleActions(inv, struct(ov1), {includeHidden:true});
let cur=all.find(a=>(a.id||a.label)===A), curG=swapGroupOf(cur.type);
let cands=all.filter(a=>a._hidden && swapGroupOf(a.type)===curG && (a.id||a.label)!==A);
ok('candidates = hidden same-group attacks (B)', cands.length===1 && cands[0].id===B, cands.map(c=>c.id));

// swapping in an EDITED+hidden attack keeps its edits, just un-hides
let ovE={}; ovE[B]={hidden:true,label:'Custom Blade',dmgBonus:2};
let ovE2=applySwap(ovE, A, B);
ok('swap-in preserves edits (label+bonus kept, hidden cleared)', ovE2[B]&&ovE2[B].label==='Custom Blade'&&ovE2[B].dmgBonus===2&&!ovE2[B].hidden, ovE2[B]);

// swap button gating (mirrors actionRowHTML)
const swapBtn=a=>swapGroupOf(a.type)==='utility'?'':'<button type="button" class="ac-swap" data-act-swap="'+(a.id||a.label)+'">';
ok('attack row → swap button present', /data-act-swap/.test(swapBtn({id:'atk-x',type:'attack'})));
ok('bonus-damage row → swap button present', /data-act-swap/.test(swapBtn({id:'d-x',type:'damage-only'})));
ok('utility row → no swap button', swapBtn({id:'u-x',type:'utility'})==='');

console.log('\nsmoke-attack-swap: '+pass+' passed, '+fail+' failed'); if(fail)process.exit(1);
