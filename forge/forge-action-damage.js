/* ── forge-action-damage.js ───────────────────────────────────────────
   Battle Forge canonical action-damage seam.

   This module repairs the FINAL action tiles combat actually consumes and
   owns one real damage roll record used by combat, protocol, replay, and feed.
   Presentation deliberately follows the existing site Battle HUD:

     Dmg: [5] +6 = 11 Slashing
     Crit dmg: [4][5] +6 = 15 Slashing

   Supported feature modifiers in this first canonical pass:
   - Dueling: +2 to eligible one-handed melee weapon damage.
   - Agonizing Blast: CHA modifier to each Eldritch Blast damage roll.

   Browser: window.ForgeActionDamage. Node: module.exports.               */
(function(root,factory){
  var api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.ForgeActionDamage=api;
})(typeof self!=="undefined"?self:this,function(){
  "use strict";
  var VERSION="1.1.0";

  function n(v,f){var x=Number(v);return Number.isFinite(x)?x:(f==null?0:f);}
  function parseDice(expr){
    var raw=String(expr==null?"0":expr).replace(/\s+/g,"");
    var m=/^(?:(\d+)d(\d+))?([+-]\d+)?$/i.exec(raw);
    if(!m)return {count:0,sides:0,bonus:n(raw,0)};
    return {count:n(m[1],0),sides:n(m[2],0),bonus:n(m[3],0)};
  }
  function diceText(count,sides){return count>0&&sides>0?count+"d"+sides:"0";}
  function abilityMod(structural,key){
    var a=structural&&structural.abilities&&structural.abilities[String(key||"").toLowerCase()];
    return a&&a.mod!=null?n(a.mod,0):0;
  }
  function featureStrings(structural){
    var out=[],seen=[];
    function walk(v,key){
      if(v==null)return;
      if(typeof v==="string"||typeof v==="number"){out.push(String(v));return;}
      if(typeof v!=="object"||seen.indexOf(v)>=0)return;
      seen.push(v);
      if(Array.isArray(v)){v.forEach(function(x){walk(x,key);});return;}
      Object.keys(v).forEach(function(k){
        if(k==="name"||k==="desc"||/fighting.?style/i.test(k))walk(v[k],k);
        else if(k==="features"||k==="classFeatures"||k==="customFeatures")walk(v[k],k);
      });
    }
    walk(structural&&structural.features,"features");
    walk(structural&&structural.customFeatures,"customFeatures");
    walk(structural&&structural.classFeatures,"classFeatures");
    return out;
  }
  function hasFeature(structural,re){return featureStrings(structural).some(function(s){return re.test(s);});}
  function hasDueling(structural){return hasFeature(structural,/\bdueling\b/i);}
  function hasAgonizingBlast(structural){return hasFeature(structural,/\bagonizing blast\b/i);}
  function sourceOf(action){return action&&action._src&&typeof action._src==="object"?action._src:action||{};}
  function actionText(action){var src=sourceOf(action);return [action&&action.id,action&&action._tileId,action&&action._derivedId,action&&action.label,src.id,src.label].join(" ");}
  function isTwoHanded(action){
    var src=sourceOf(action),text=actionText(action);
    return /(?:-2h\b|_2h\b|two[- ]handed|greatsword|greataxe|greatclub|glaive|halberd|maul|pike)/i.test(text)
      || src.twoHanded===true;
  }
  function isRanged(action){
    var src=sourceOf(action);
    return !!(src.range||action&&action.range||src.ranged===true||action&&action.ranged===true||(action&&n(action.rng,1)>2));
  }
  function isWeaponShaped(action){
    var src=sourceOf(action),text=actionText(action);
    if(src.dmgAbility===true)return true;
    return /\b(?:booming blade|green[- ]flame blade|longsword|shortsword|rapier|scimitar|dagger|mace|spear|quarterstaff|warhammer|battleaxe|flail|whip|trident|handaxe|javelin)\b/i.test(text);
  }
  function isEldritchBlast(action){return /\beldritch[ _-]?blast\b/i.test(actionText(action));}
  function duelingEligible(action){return !!action&&isWeaponShaped(action)&&!isRanged(action)&&!isTwoHanded(action);}
  function primaryBonus(action){
    if(action&&Array.isArray(action.dmgStack)&&action.dmgStack.length)return n(action.dmgStack[0].bonus,0);
    return parseDice(action&&action.dmg).bonus;
  }
  function proficiencyBonus(structural){return n(structural&&structural.proficiencyBonus,0);}
  function inferredAttackAbility(action,structural){
    var src=sourceOf(action),abil=src.ability||action&&action.ability;
    if(abil)return abilityMod(structural,abil);
    /* Legacy saved attacks carry the complete hit modifier. Remove PB and an
       item attack bonus to recover the attack ability used by that weapon.
       This is what lets an old `bb_vesperian` tile recover DEX +4 rather than
       defaulting to STR when the live source metadata was folded away. */
    var full=src.hitMod!=null?n(src.hitMod,0):(action&&action.hit!=null?n(action.hit,0):null);
    if(full!=null)return full-proficiencyBonus(structural)-n(src.atkBonus,0);
    return null;
  }
  function expectedWeaponBaseBonus(action,structural){
    var src=sourceOf(action);
    if(src.dmgAbility===false)return n(src.dmgBonus,src.dmgMod||0);
    var abil=inferredAttackAbility(action,structural);
    if(abil!=null)return abil+n(src.dmgBonus,0);
    if(src.dmgMod!=null)return n(src.dmgMod,0);
    return primaryBonus(action);
  }
  function setPrimaryBonus(action,bonus){
    if(Array.isArray(action.dmgStack)&&action.dmgStack.length){
      action.dmgStack=action.dmgStack.map(function(p,i){return i?p:Object.assign({},p,{bonus:bonus});});
    }
    if(action.dmg!=null){
      var p=parseDice(action.dmg),dice=diceText(p.count,p.sides);
      action.dmg=dice+(bonus?(bonus>0?"+":"")+bonus:"");
    }
    action._forgeDamageBonus=bonus;
    return action;
  }
  function repairDueling(action,structural){
    if(!hasDueling(structural)||!duelingEligible(action))return false;
    var want=expectedWeaponBaseBonus(action,structural)+2;
    if(primaryBonus(action)!==want)setPrimaryBonus(action,want);
    action._forgeDuelingApplied=true;
    return true;
  }
  function repairAgonizingBlast(action,structural){
    if(!hasAgonizingBlast(structural)||!isEldritchBlast(action))return false;
    var want=abilityMod(structural,"cha");
    if(primaryBonus(action)!==want)setPrimaryBonus(action,want);
    action._forgeAgonizingBlastApplied=true;
    return true;
  }
  function repairAction(action,structural){
    if(!action)return action;
    repairDueling(action,structural||{});
    repairAgonizingBlast(action,structural||{});
    return action;
  }
  function repairKit(kit,structural){
    if(!kit||typeof kit!=="object")return kit;
    var seen=[];
    function visit(a){if(a&&seen.indexOf(a)<0){seen.push(a);repairAction(a,structural);}return a;}
    (kit.actions||[]).forEach(visit);
    var tabs=kit.tabs;
    if(Array.isArray(tabs))tabs.forEach(function(t){(t&&t.actions||[]).forEach(visit);(t&&t.items||[]).forEach(visit);});
    else if(tabs&&typeof tabs==="object")Object.keys(tabs).forEach(function(k){(tabs[k]||[]).forEach(visit);});
    return kit;
  }
  function rollDie(sides,rng){
    if(!(sides>0))return 0;
    if(typeof rng==="function"){
      var v=rng(sides);
      if(Number.isFinite(v)&&v>=1&&v<=sides)return Math.floor(v);
      if(Number.isFinite(v)&&v>=0&&v<1)return Math.floor(v*sides)+1;
    }
    return Math.floor(Math.random()*sides)+1;
  }
  function rollComponent(raw,crit,rng){
    raw=raw||{};
    var p=parseDice(raw.dice||"0"),count=p.count*(crit&&raw.critDice!==false?2:1),rolls=[];
    for(var i=0;i<count;i++)rolls.push(rollDie(p.sides,rng));
    var bonus=n(raw.bonus,0)+p.bonus,total=rolls.reduce(function(a,b){return a+b;},0)+bonus;
    return {dice:diceText(p.count,p.sides),rolledDice:diceText(count,p.sides),rolls:rolls,bonus:bonus,
      type:raw.type||"",label:raw.label||"",total:total,crit:!!crit};
  }
  function actionStack(action){
    if(action&&Array.isArray(action.dmgStack)&&action.dmgStack.length)return action.dmgStack;
    var p=parseDice(action&&action.dmg||"0");
    return [{dice:diceText(p.count,p.sides),bonus:p.bonus,type:action&&action.dmgType||""}];
  }
  function formulaPart(part){
    var s=part.rolledDice||part.dice||"0",b=n(part.bonus,0);
    if(b)s+=" "+(b>=0?"+":"−")+" "+Math.abs(b);
    if(part.type)s+=" "+part.type;
    return s;
  }
  function rollAction(action,crit,extras,rng){
    var parts=actionStack(action).map(function(p){return rollComponent(p,!!crit,rng);});
    (extras||[]).forEach(function(p){parts.push(rollComponent(p,!!(crit&&p.critDice!==false),rng));});
    var total=parts.reduce(function(sum,p){return sum+n(p.total,0);},0);
    return {total:total,parts:parts,formula:parts.map(formulaPart).join(" + "),crit:!!crit};
  }
  function signed(v){v=n(v,0);return v?(v>=0?"+":"−")+Math.abs(v):"";}
  function formatPart(part,crit){
    part=part||{};
    var rolls=(part.rolls||[]).map(function(r){return "["+r+"]";}).join("");
    var terms=rolls||part.rolledDice||part.dice||"0",b=signed(part.bonus);
    if(b)terms+=" "+b;
    return (crit?"Crit dmg: ":"Dmg: ")+terms+" = "+n(part.total,0)+(part.type?" "+part.type:"");
  }
  return {VERSION:VERSION,parseDice:parseDice,hasDueling:hasDueling,hasAgonizingBlast:hasAgonizingBlast,
    duelingEligible:duelingEligible,isEldritchBlast:isEldritchBlast,repairDueling:repairDueling,
    repairAgonizingBlast:repairAgonizingBlast,repairAction:repairAction,repairKit:repairKit,
    rollComponent:rollComponent,rollAction:rollAction,formulaPart:formulaPart,formatPart:formatPart};
});
