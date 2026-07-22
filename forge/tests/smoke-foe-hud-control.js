const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..','..'),html=fs.readFileSync(path.join(root,'forge','index.html'),'utf8'),hud=fs.readFileSync(path.join(root,'forge','forge-hud.js'),'utf8');
const AI=require('../forge-foe-ai.js'),MonsterActor=require('../../monster-actor.js');
let n=0,fail=0;function ok(cond,label){n++;if(cond)console.log('ok '+n+' - '+label);else{fail++;console.error('not ok '+n+' - '+label);}}
function fnSource(name){const mark='function '+name+'(',start=html.indexOf(mark);if(start<0)throw new Error('missing '+name);let brace=html.indexOf('{',start),depth=0,quote=null,esc=false;for(let i=brace;i<html.length;i++){const c=html[i];if(quote){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===quote)quote=null;continue;}if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==='{')depth++;if(c==='}'&&--depth===0)return html.slice(start,i+1);}throw new Error('unterminated '+name);}
const ctx={window:{MonsterActor},clog(){},escapeHtml:String,console};vm.createContext(ctx);
['rangeFromNote','foeActionFromMonster','foeReferenceTile','foeHudFrom','foeKitFromStatblock'].forEach(name=>vm.runInContext(fnSource(name),ctx));
const row={unit:'archer-1',name:'Archer 1',statblock:{name:'Archer',dex:18,ac:[16],hp:{average:16},speed:{walk:30},type:'humanoid',action:[
 {name:'Shortsword',entries:['{@atk mw} {@hit 6} to hit, reach 5 ft., one target. {@h} 7 ({@damage 1d6 + 4}) piercing damage.']},
 {name:'Longbow',entries:['{@atk rw} {@hit 6} to hit, range 150/600 ft., one target. {@h} 8 ({@damage 1d8 + 4}) piercing damage.']},
 {name:'Multiattack',entries:['The archer makes two attacks.']}],trait:[{name:'Keen Sight',entries:['The archer has advantage on sight checks.']}],spellcasting:[{name:'Spellcasting',will:['{@spell guidance}']}],reaction:[{name:'Parry',entries:['The archer adds 2 to AC.']}]}};
const kit=ctx.foeKitFromStatblock(row),short=kit.actions.find(a=>a.label==='Shortsword'),long=kit.actions.find(a=>a.label==='Longbow');
ok(kit.actions.length===2,'production adapter exposes all mechanically parsed attacks');
ok(short.rng===1&&long.rng===30&&long.long===120,'production adapter converts reach and both bow ranges to grid squares');
ok(kit.foeHud.tabs.attacks.length===2&&kit.foeHud.tabs.feats.some(x=>x.label==='Keen Sight'),'enemy HUD combines executable attacks and readable traits');
ok(kit.foeHud.tabs.spells.some(x=>x.label==='guidance'&&x.reference),'enemy spell list is a readable reference tab');
ok(kit.foeHud.tabs.actions.some(x=>x.label==='Multiattack')&&kit.foeHud.tabs.actions.some(x=>x.label==='Parry'),'prose actions and reactions remain visible without fake automation');
const archer={unit:'archer-1',name:'Archer 1',c:0,r:0},caim={unit:'caim',name:'Caim',c:11,r:0,hp:24,hpMax:24,alive:true};
const plan=AI.planTurn({actions:kit.actions,targets:[caim],origins:[{c:0,r:0,cost:0}],evaluate(_o,a,t){const ft=Math.max(Math.abs(t.c),Math.abs(t.r))*5;return {ok:ft<=((a.long||a.rng)*5),dis:ft>a.rng*5,distanceFt:ft,coverName:'none'};}});
ok(plan.action.label==='Longbow','real Archer row reaches the planner and selects Longbow at 55 ft');
ok(html.includes('id="sceneEnemyTurns"')&&html.includes("setFoeAutomation(!FOE_AUTOMATION)"),'real Forge exposes the approved Automatic / Manual table control');
ok(html.includes("u.side===\"foe\"&&!FOE_AUTOMATION")&&html.includes('scheduleAutomatedFoeTurn(u)'),'Manual foe control and automatic turn-start scheduling are wired');
ok(html.includes("x.side==='pc'&&TG.losVerdict")&&html.includes('{ignoreCreatures:true}).canTarget'),'automatic planning receives only opponents the foe can presently perceive');
ok(html.includes("holds position — no opponent is presently visible to it")&&html.includes("var executable=(u.actions||[]).filter"),'a perception hold is narrated separately from a missing parsed attack');
ok(html.includes('id:"generic-shortbow"')&&html.includes('label:"Shortbow"')&&html.includes('rng:16,long:64'),'fallback Goblins expose a manually usable shortbow');
ok(html.includes('forge-manual-foe')&&html.includes('actions=FOE.actions.map'),'manual Player View reveals the controlled foe HUD and repairs incomplete seeded Goblin attacks');
ok(!html.includes('focusPair(active(),o)')&&html.includes('frameCameraPair(active(),o)'),'initiative-strip targeting uses the real camera-pair helper');
ok(hud.includes('tile && tile.reference')&&hud.includes('FOE_LABELS'),'enemy reference tiles open through the real HUD drawer and use foe labels');
ok(hud.includes('var tileId=t._tileId||t.id||""')&&hud.includes('data-tile-id="\' + esc(tileId)'),'enemy tiles dispatch the runtime action identity used by Manual mode');
ok(html.includes('forge-foe-ai.js?v=fai2')&&html.includes('forge-hud.js?v=b6')&&html.includes('monster-actor.js?v=ma2'),'changed modules have fresh production cache stamps');

if(fail){console.error('\n'+fail+' foe-HUD checks failed');process.exit(1);}
console.log('\n'+n+' foe-HUD checks green');
