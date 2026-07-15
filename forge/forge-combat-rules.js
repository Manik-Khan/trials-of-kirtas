/* forge-combat-rules.js — Battle Forge Phase 1.5g
   Pure combat-flow helpers: source-aware advantage/disadvantage, flanking
   variants, Prone, Monk action composition, Toll the Dead, feed channels,
   and fail-closed damage validation. Browser: ForgeCombatRules. Node: exports. */
(function(root,factory){
  var api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.ForgeCombatRules=api;
})(typeof self!=="undefined"?self:this,function(){
  "use strict";
  var VERSION="1.2.0";
  var FLANKING_MODES=Object.freeze(["advantage","plus2","plus5","off"]);
  function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
  function norm(s){return String(s||"").toLowerCase().replace(/[’]/g,"'").trim();}
  function uniq(list){var seen=Object.create(null),out=[];(list||[]).forEach(function(x){x=String(x||"").trim();if(x&&!seen[x]){seen[x]=1;out.push(x);}});return out;}
  function reduceRollSources(adv,dis){
    adv=uniq(adv);dis=uniq(dis);
    return {advantageSources:adv,disadvantageSources:dis,
      advantage:adv.length>0&&dis.length===0,
      disadvantage:dis.length>0&&adv.length===0,
      normal:(adv.length===0&&dis.length===0)||(adv.length>0&&dis.length>0),
      cancelled:adv.length>0&&dis.length>0};
  }
  function assertFlankingMode(mode){mode=mode||"advantage";if(FLANKING_MODES.indexOf(mode)<0)throw new Error("forge-combat-rules: unknown flanking mode "+mode);return mode;}
  function conditionKinds(unit){var list=[];(unit&&unit.conditions||[]).forEach(function(c){list.push(norm(typeof c==="string"?c:c&&c.kind));});(unit&&unit.effects||[]).forEach(function(c){list.push(norm(c&&c.kind));});return list;}
  function hasCondition(unit,kind,effectLookup){kind=norm(kind);if(typeof effectLookup==="function"&&effectLookup(unit,kind))return true;return conditionKinds(unit).indexOf(kind)>=0;}
  function incapacitated(unit,effectLookup){if(!unit||unit.alive===false)return true;var ks=["incapacitated","unconscious","paralyzed","stunned","petrified"];
    for(var i=0;i<ks.length;i++)if(hasCondition(unit,ks[i],effectLookup))return true;return false;}
  function cheb(a,b){return Math.max(Math.abs(a.c-b.c),Math.abs(a.r-b.r));}
  function isFlanked(attacker,target,units,effectLookup,canReach){
    if(!attacker||!target||incapacitated(attacker,effectLookup)||incapacitated(target,effectLookup))return false;
    if(cheb(attacker,target)>1)return false;
    if(typeof canReach==="function"&&!canReach(attacker,target))return false;
    var oc=2*target.c-attacker.c,orr=2*target.r-attacker.r;
    return (units||[]).some(function(x){return x!==attacker&&x.side===attacker.side&&!incapacitated(x,effectLookup)&&x.c===oc&&x.r===orr&&(!canReach||canReach(x,target));});
  }
  function flankingContribution(mode,flanked){mode=assertFlankingMode(mode);if(!flanked||mode==="off")return {attackBonus:0,advantageSources:[]};if(mode==="advantage")return {attackBonus:0,advantageSources:["flanking"]};return {attackBonus:mode==="plus5"?5:2,advantageSources:[]};}
  function attackRollSources(opts){
    opts=opts||{};var adv=(opts.advantageSources||[]).slice(),dis=(opts.disadvantageSources||[]).slice();
    var attacker=opts.attacker||{},target=opts.target||{},action=opts.action||{},distanceFt=Number(opts.distanceFt);
    var ranged=(action.rng||1)>1;
    if(opts.hostileAdjacent&&ranged)dis.push("ranged attack in melee");
    if(hasCondition(attacker,"prone",opts.effectLookup))dis.push("attacker prone");
    if(hasCondition(target,"prone",opts.effectLookup)){
      if(Number.isFinite(distanceFt)&&distanceFt<=5)adv.push("target prone");else dis.push("target prone beyond 5 ft");
    }
    if(opts.targetDodging||opts.attackerDodging)dis.push("target dodging");
    var flank=flankingContribution(opts.flankingMode||"advantage",!!opts.flanked);adv=adv.concat(flank.advantageSources);
    var reduced=reduceRollSources(adv,dis);reduced.attackBonus=flank.attackBonus;return reduced;
  }
  function spellCastShape(action){
    action=action||{};return {spell:!!action.spell,slot:action.bonus?"bonus":(action.reaction?"reaction":(action.free?"free":"action")),level:Math.max(0,Number(action.castLevel!=null?action.castLevel:action.level)||0),label:action.label||"Spell"};
  }
  function canCastSpell(economy,action){
    var next=spellCastShape(action);if(!next.spell)return {ok:true};
    var prior=(economy&&economy.spellCasts||[]).slice(),hasBonus=prior.some(function(c){return c&&c.slot==="bonus";});
    function actionCantrip(c){return c&&c.slot==="action"&&Number(c.level)===0;}
    if(hasBonus&&!actionCantrip(next))return {ok:false,why:"after a bonus-action spell, only an action cantrip may be cast this turn"};
    if(next.slot==="bonus"&&prior.some(function(c){return !actionCantrip(c);}))return {ok:false,why:"a bonus-action spell cannot follow another spell this turn except an action cantrip"};
    return {ok:true};
  }
  function validDamageExpression(expr){
    if(typeof expr==="number")return Number.isFinite(expr)&&expr>=0;
    if(typeof expr!=="string"||!expr.trim())return false;
    return /^\s*(?:\d+d\d+|\d+)(?:\s*[+-]\s*(?:\d+d\d+|\d+))*\s*$/i.test(expr);
  }
  function requireDamage(action){if(!action||!["attack","save","damage"].includes(action.kind))return {ok:true};if(validDamageExpression(action.dmg))return {ok:true};return {ok:false,why:(action.label||"Damaging action")+" has no valid damage expression"};}
  function scaleDie(expr,die){var m=String(expr||"").match(/(\d+)d\d+/i);return m?(m[1]+"d"+die):("1d"+die);}
  function tollDamage(action,target){var wounded=!!(target&&Number(target.hp)<Number(target.hpMax));var base=action&&action.dmg||"1d8";return {dmg:scaleDie(base,wounded?12:8),wounded:wounded,die:wounded?12:8};}
  function findByLabel(actions,re){return (actions||[]).find(function(a){return re.test(norm(a&&a.label));})||null;}
  function copyAttackShape(dst,src,strikes){if(!dst||!src)return dst;["rng","long","hit","dmg","dmgStack","critDice"].forEach(function(k){if(src[k]!=null)dst[k]=clone(src[k]);});dst.kind="attack";dst.strikes=strikes||1;dst.composedFrom=src.id||src.label;return dst;}
  function allActions(kit){var out=[],seen=[];function add(a){if(!a||seen.indexOf(a)>=0)return;seen.push(a);out.push(a);} (kit.actions||[]).forEach(add);Object.keys(kit.tabs||{}).forEach(function(k){(kit.tabs[k]||[]).forEach(add);});return out;}
  function auditKit(kit,charData){
    if(!kit||typeof kit!=="object")return kit;
    if(!Array.isArray(kit.actions))kit.actions=[];
    if(!kit.tabs||typeof kit.tabs!=="object")kit.tabs={};
    if(!Array.isArray(kit.tabs.bonus))kit.tabs.bonus=[];
    var actions=allActions(kit),key=norm(kit.key||(charData&&charData.key));
    if(key!=="caim"&&!/\bmonk\b/.test(norm(charData&&charData.structural&&charData.structural.classLabel)))return kit;
    var unarmed=findByLabel(actions,/^unarmed strike$/)||findByLabel(actions,/unarmed/);
    var flurry=findByLabel(actions,/flurry of blows/);if(flurry&&unarmed){copyAttackShape(flurry,unarmed,2);flurry.bonus=true;flurry.free=false;flurry.needsAttack=true;flurry.cost={ki:1};flurry.slot="bonus";}
    var martial=findByLabel(actions,/^martial arts$/);if(!martial&&unarmed){martial=copyAttackShape({id:"cf_martial_arts",label:"Martial Arts",tab:"bonus",bonus:true,free:false,needsAttack:true,cost:null,classFeature:true,desc:"After the Attack action: one unarmed strike as a bonus action."},unarmed,1);kit.actions.push(martial);if(kit.tabs&&kit.tabs.bonus)kit.tabs.bonus.push(martial);}
    var step=findByLabel(actions,/step of the wind/);if(step){step.kind="monk-step";step.bonus=true;step.free=false;step.cost={ki:1};step.slot="bonus";step.choices=["dash","disengage"];delete step.dmg;delete step.hit;}
    var patient=findByLabel(actions,/patient defense/);if(patient){patient.kind="monk-dodge";patient.bonus=true;patient.free=false;patient.cost={ki:1};patient.slot="bonus";delete patient.dmg;delete patient.hit;}
    var heal=findByLabel(actions,/hands? of healing/);if(heal){heal.kind="heal";heal.rng=1;heal.dmg=heal.dmg&&validDamageExpression(heal.dmg)?heal.dmg:"1d4+3";heal.cost={ki:1};}
    /* Hand of Harm is a post-hit rider, not a standalone attack. Until the
       post-hit target/rider prompt is wired, keep it explicit and fail-closed
       instead of allowing a malformed zero-damage attack. */
    var harm=findByLabel(actions,/hand of harm/);if(harm){harm.kind="monk-rider";harm.cost={ki:1};harm.free=true;harm.bonus=false;harm.greyed=true;harm.greyReason="Post-hit rider — not yet wired";delete harm.hit;delete harm.rng;}
    kit._classAudit="monk-v1";return kit;
  }
  function categoryForHtml(html){var s=String(html||"").replace(/<[^>]+>/g," ").toLowerCase();if(/geometry details|occluder at|corners? blocked|transport|reconnect|resync|sheet catching up|protocol|discovery:|party vision|grid ray/.test(s))return "system";return "table";}
  function proneStandCostSquares(speedFt){return Math.ceil((Number(speedFt)||0)/10);}
  function crawlCostSquares(pathSquares){return Math.max(0,Number(pathSquares)||0)*2;}
  function effectOp(opts){opts=opts||{};var target=String(opts.target||"");var kind=String(opts.kind||"");return {unit:target,add_effect:{id:opts.id||("effect:"+kind+":"+target+":"+(opts.nonce==null?Date.now():opts.nonce)),kind:kind,label:opts.label||kind,source:String(opts.source||target||"__overseer"),target:target,icon:opts.icon||kind,condition:!!opts.condition,duration:opts.duration||null}};}
  function addCondition(opts){opts=Object.assign({kind:"prone",label:"Prone",icon:"prone",condition:true},opts||{});return effectOp(opts);}
  /* Phase 1.5g movement facts may carry move_cost_ft. Old clients still use
     path.length*5; this wrapper corrects only the active-turn economy and leaves
     positions/verbs untouched. It patches both incremental ingest and cold replay. */
  function installReplayMovementCosts(root){
    root=root||((typeof window!=="undefined")?window:null);var FR=root&&root.ForgeReplay;if(!FR||FR.__phase15gMoveCosts)return false;
    var rawApply=FR.applyEvent,rawReplay=FR.replayLog;
    function payload(row,corrections){var p=row&&row.payload||{};if(corrections&&corrections[row.seq])p=Object.assign({},p,corrections[row.seq]);return p;}
    function delta(row,corrections){if(!row||row.kind!=="move_resolved")return 0;var p=payload(row,corrections);if(p.undo_of!=null||p.move_cost_ft==null)return 0;var path=p.path||[],standard=path.length*5;return (Number(p.move_cost_ft)||0)-standard;}
    FR.applyEvent=function(state,row,corrections){var out=rawApply(state,row,corrections);var d=delta(row,corrections);if(d&&out&&out.economy&&row.unit===out.economy.unit)out.economy.movedFt=Math.max(0,out.economy.movedFt+d);return out;};
    FR.replayLog=function(roster,rows){var state=rawReplay(roster,rows),active=FR.activeUnit(state);if(!active||!state.economy)return state;var list=(rows||[]).slice().sort(function(a,b){return Number(a.seq||0)-Number(b.seq||0);}),start=0,corrections={};list.forEach(function(r){if(r.kind==="override"&&r.payload)corrections[r.payload.corrects_seq]=r.payload.correction||{};});for(var i=list.length-1;i>=0;i--){if(list[i].kind==="turn_ended"||list[i].kind==="initiative_set"||list[i].kind==="session_started"||list[i].kind==="restore"){start=i+1;break;}}var add=0;for(var j=start;j<list.length;j++)if(list[j].unit===active)add+=delta(list[j],corrections);state.economy.movedFt=Math.max(0,state.economy.movedFt+add);return state;};
    FR.__phase15gMoveCosts=true;return true;
  }
  var API=Object.freeze({VERSION:VERSION,FLANKING_MODES:FLANKING_MODES,assertFlankingMode:assertFlankingMode,reduceRollSources:reduceRollSources,hasCondition:hasCondition,incapacitated:incapacitated,isFlanked:isFlanked,flankingContribution:flankingContribution,attackRollSources:attackRollSources,spellCastShape:spellCastShape,canCastSpell:canCastSpell,validDamageExpression:validDamageExpression,requireDamage:requireDamage,tollDamage:tollDamage,auditKit:auditKit,categoryForHtml:categoryForHtml,proneStandCostSquares:proneStandCostSquares,crawlCostSquares:crawlCostSquares,effectOp:effectOp,addCondition:addCondition,installReplayMovementCosts:installReplayMovementCosts,_internals:{allActions:allActions,copyAttackShape:copyAttackShape,scaleDie:scaleDie}});
  if(typeof window!=="undefined")installReplayMovementCosts(window);
  return API;
});
