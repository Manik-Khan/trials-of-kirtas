/* ── forge-initiative.js ─────────────────────────────────────────────
   Canonical initiative evidence for Battle Forge.

   Initiative is a Dexterity ability check, but Forge should never publish only
   an opaque total. This module keeps the raw d20 evidence, static sources,
   advantage/disadvantage sources, rolled modifier dice, and entry mode together
   as one replayable fact.

   Browser: window.ForgeInitiative. Node: module.exports.
   ───────────────────────────────────────────────────────────────────── */
(function(root,factory){
  var api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.ForgeInitiative=api;
})(typeof self!=="undefined"?self:this,function(){
  "use strict";

  var VERSION="1.0.0";

  function num(v,d){v=Number(v);return Number.isFinite(v)?v:(d==null?0:d);}
  function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
  function label(v,fallback){return String(v||fallback||"").trim();}
  function dieSides(die){var m=String(die||"").match(/d(\d+)/i);return m?Math.max(1,num(m[1],1)):0;}
  function rollDie(die,rng){var sides=dieSides(die);if(!sides)return 0;var raw=typeof rng==="function"?num(rng(sides),1):Math.floor(Math.random()*sides)+1;return Math.max(1,Math.min(sides,Math.floor(raw)));}
  function addUnique(out,seen,src){
    if(!src)return;var key=String(src.key||src.label||src.kind||"").toLowerCase()+":"+String(src.source||"");
    if(!key||seen[key])return;seen[key]=1;out.push(clone(src));
  }
  function sumValues(list){return (list||[]).reduce(function(n,s){return n+num(s&&s.value,0);},0);}
  function normalizeStatic(unit){
    unit=unit||{};var meta=unit.initiativeProfile||{},metaTotal=Number(meta.modifier),unitTotal=Number(unit.initMod);
    /* The component profile is the canonical initiative authority. A live unit
       can still carry a stale cached `initMod` from an older roster/fallback;
       never manufacture a negative "Other sheet bonuses" term to force the
       newer component evidence back down to that stale number. */
    var total=Number.isFinite(metaTotal)?metaTotal:(Number.isFinite(unitTotal)?unitTotal:0);
    var src=clone(meta.staticSources||[]),sum=sumValues(src);
    if(sum!==total)src.push({key:"sheet-remainder",label:sum?"Other sheet bonuses":"Initiative modifier",value:total-sum,source:"character sheet"});
    return {total:total,sources:src.filter(function(s){return num(s.value,0)!==0||s.key==="dexterity";}),warnings:clone(meta.warnings||[])};
  }
  function auraSources(unit,units,distanceFt){
    var out=[],seen=Object.create(null);units=units||[];distanceFt=distanceFt||function(a,b){return Math.max(Math.abs(num(a.c)-num(b.c)),Math.abs(num(a.r)-num(b.r)))*5;};
    units.forEach(function(source){
      if(!source||source.alive===false||source.incapacitated||source.side!==unit.side)return;
      var auras=source.initiativeProfile&&source.initiativeProfile.auras||[];
      auras.forEach(function(a){
        var range=num(a.rangeFt,10);if(distanceFt(source,unit)>range+1e-6)return;
        var key=String(a.key||a.label||"initiative-aura");var value=num(a.value!=null?a.value:(source.initiativeProfile&&source.initiativeProfile.proficiencyBonus),0);
        if(!value)return;
        /* Identically named aura effects do not stack. Keep the strongest one. */
        var prev=seen[key];
        if(prev&&num(prev.value)>=value)return;
        if(prev){var at=out.indexOf(prev);if(at>=0)out.splice(at,1);}
        var row={key:key,label:label(a.label,"Aura of the Sentinel"),value:value,source:source.name||source.unit||source.key||"ally",rangeFt:range};
        seen[key]=row;out.push(row);
      });
    });
    return out;
  }
  function effectSources(effects){
    var dice=[],adv=[],dis=[],staticSources=[],consume=[];
    (effects||[]).forEach(function(e){
      if(!e)return;var kind=String(e.kind||"").toLowerCase().replace(/_/g,"-");
      if(kind==="gift-of-alacrity"||kind==="guidance"||kind==="bardic-inspiration"||kind==="initiative-die"){
        var die=e.die||(kind==="gift-of-alacrity"?"1d8":kind==="bardic-inspiration"?"1d6":"1d4");
        dice.push({key:kind,label:label(e.label,kind==="gift-of-alacrity"?"Gift of Alacrity":kind==="bardic-inspiration"?"Bardic Inspiration":"Guidance"),die:die,effectId:e.id||null,source:e.source||null,consume:!!(e.consumeOnUse||kind==="guidance"||kind==="bardic-inspiration")});
        if(e.consumeOnUse||kind==="guidance"||kind==="bardic-inspiration")consume.push({unit:e.target||null,remove_effect:e.id,reason:"used on initiative",effect_label:e.label||kind,effect_kind:e.kind||kind});
      }else if(kind==="initiative-advantage")adv.push({key:kind,label:label(e.label,"Initiative advantage"),source:e.source||null});
      else if(kind==="initiative-disadvantage")dis.push({key:kind,label:label(e.label,"Initiative disadvantage"),source:e.source||null});
      else if(kind==="initiative-bonus"&&e.value!=null)staticSources.push({key:kind,label:label(e.label,"Initiative bonus"),value:num(e.value),source:e.source||null});
    });
    return {dice:dice,advantage:adv,disadvantage:dis,staticSources:staticSources,consume:consume};
  }
  function profile(unit,context){
    context=context||{};unit=unit||{};
    var stat=normalizeStatic(unit),meta=unit.initiativeProfile||{},effects=effectSources(context.effects||[]),seenA=Object.create(null),seenD=Object.create(null),adv=[],dis=[];
    (meta.advantageSources||[]).concat(context.advantageSources||[],effects.advantage).forEach(function(s){addUnique(adv,seenA,s);});
    (meta.disadvantageSources||[]).concat(context.disadvantageSources||[],effects.disadvantage).forEach(function(s){addUnique(dis,seenD,s);});
    var auras=auraSources(unit,context.units||[],context.distanceFt),staticSources=stat.sources.concat(auras,effects.staticSources,clone(context.staticSources||[]));
    var dice=clone(meta.diceSources||[]).concat(effects.dice,clone(context.diceSources||[]));
    return {version:VERSION,unit:unit.unit||unit.key||unit.id||null,name:unit.name||null,staticSources:staticSources,staticTotal:sumValues(staticSources),advantageSources:adv,disadvantageSources:dis,diceSources:dice,warnings:stat.warnings.concat(clone(context.warnings||[])),consumeEffects:effects.consume};
  }
  function d20Evidence(profile,rng,physicalD20){
    var adv=profile.advantageSources.length>0,dis=profile.disadvantageSources.length>0,rolls=[],kept=0;
    if(physicalD20!=null){rolls=[Math.max(1,Math.min(20,Math.floor(num(physicalD20,1))))];}
    else if(adv&&!dis){rolls=[rollDie("1d20",rng),rollDie("1d20",rng)];kept=rolls[1]>rolls[0]?1:0;}
    else if(dis&&!adv){rolls=[rollDie("1d20",rng),rollDie("1d20",rng)];kept=rolls[1]<rolls[0]?1:0;}
    else rolls=[rollDie("1d20",rng)];
    return {rolls:rolls,keptIndex:kept,kept:rolls[kept],advantage:adv&&!dis,disadvantage:dis&&!adv,cancelled:adv&&dis};
  }
  function resolve(profile,opts){
    opts=opts||{};profile=clone(profile||{});var mode=opts.mode||"rolled";
    if(mode==="manual-total"){
      var total=num(opts.total,0);
      return {version:VERSION,kind:"initiative",mode:"manual-total",unit:profile.unit||null,name:profile.name||null,roll:total,total:total,opaque:true,staticSources:[],staticTotal:null,dice:[],d20Rolls:[],d20KeptIndex:null,advantageSources:[],disadvantageSources:[],warnings:["Manually entered total — component evidence unavailable."],effects:[]};
    }
    var d20=d20Evidence(profile,opts.rng,mode==="physical-d20"?opts.d20:null),dice=[];
    (profile.diceSources||[]).forEach(function(src){var row=clone(src);row.roll=rollDie(row.die,opts.rng);dice.push(row);});
    var total=d20.kept+num(profile.staticTotal,0)+dice.reduce(function(n,x){return n+num(x.roll,0);},0);
    var warnings=clone(profile.warnings||[]);
    if(mode==="physical-d20"&&(profile.advantageSources||[]).length+(profile.disadvantageSources||[]).length)
      warnings.push("Physical d20 entry records the kept die only — resolve advantage/disadvantage with physical dice first.");
    return {version:VERSION,kind:"initiative",mode:mode,unit:profile.unit||null,name:profile.name||null,roll:total,total:total,opaque:false,d20:d20.kept,d20Rolls:d20.rolls,d20KeptIndex:d20.keptIndex,advantage:d20.advantage,disadvantage:d20.disadvantage,advantageCancelled:d20.cancelled,advantageSources:clone(profile.advantageSources||[]),disadvantageSources:clone(profile.disadvantageSources||[]),staticSources:clone(profile.staticSources||[]),staticTotal:num(profile.staticTotal,0),dice:dice,warnings:warnings,effects:clone(profile.consumeEffects||[])};
  }
  function payload(evidence){
    evidence=clone(evidence||{});return {roll:num(evidence.total!=null?evidence.total:evidence.roll,0),initiative_evidence:evidence,effects:clone(evidence.effects||[])};
  }
  function componentText(e){
    if(!e)return "";if(e.mode==="manual-total")return "Manual total "+e.total;
    var parts=[];if(e.d20Rolls&&e.d20Rolls.length>1)parts.push("d20 ["+e.d20Rolls.join(", ")+"] → "+e.d20);else parts.push((e.mode==="physical-d20"?"Physical d20 ":"d20 ")+e.d20);
    (e.staticSources||[]).forEach(function(s){if(num(s.value)!==0)parts.push(label(s.label,s.key)+" "+(num(s.value)>=0?"+":"")+num(s.value));});
    (e.dice||[]).forEach(function(d){parts.push(label(d.label,d.key)+" "+d.die+" → "+d.roll);});parts.push("= "+e.total);return parts.join(" · ");
  }

  return Object.freeze({VERSION:VERSION,dieSides:dieSides,rollDie:rollDie,profile:profile,resolve:resolve,payload:payload,componentText:componentText,auraSources:auraSources,effectSources:effectSources});
});
