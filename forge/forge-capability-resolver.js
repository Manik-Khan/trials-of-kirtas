/* forge-capability-resolver.js — pure shared capability consumers.
   Executable capability tags and active effects resolve typed damage; the same
   module owns teleport destination legality so local and shared play cannot
   disagree about where a feature may land. */
(function(root,factory){
  var api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.ForgeCapabilityResolver=api;
})(typeof self!=="undefined"?self:this,function(){
  "use strict";
  var VERSION="1.1.0";
  var DAMAGE_TYPES=["acid","bludgeoning","cold","fire","force","lightning","necrotic","piercing","poison","psychic","radiant","slashing","thunder"];

  function n(v,d){v=Number(v);return Number.isFinite(v)?v:d;}
  function type(v){var s=String(v||"").toLowerCase().trim();return DAMAGE_TYPES.indexOf(s)>=0?s:"";}
  function tagsFor(target,effects){
    var tags=[];
    (target&&target.capabilities||[]).forEach(function(cap){
      if(!cap||cap.status!=="executable")return;
      (cap.tags||[]).forEach(function(tag){if(tags.indexOf(tag)<0)tags.push(tag);});
    });
    (effects||[]).forEach(function(effect){
      if(effect&&effect.kind==="raven-resistance"&&tags.indexOf("resistance:all")<0)tags.push("resistance:all");
      if(effect&&effect.kind==="rage")["bludgeoning","piercing","slashing"].forEach(function(t){var tag="resistance:"+t;if(tags.indexOf(tag)<0)tags.push(tag);});
    });
    return tags;
  }
  function defenseFor(damageType,tags){
    var t=type(damageType);if(!t)return {type:"",resistant:false,immune:false,vulnerable:false,multiplier:1};
    function has(prefix){return tags.indexOf(prefix+":all")>=0||tags.indexOf(prefix+":"+t)>=0;}
    var immune=has("immunity"),resistant=has("resistance"),vulnerable=has("vulnerability"),multiplier=1;
    if(immune)multiplier=0;
    else if(resistant!==vulnerable)multiplier=resistant?0.5:2;
    return {type:t,resistant:resistant,immune:immune,vulnerable:vulnerable,multiplier:multiplier};
  }
  function resolveDamage(target,damage,opts){
    opts=opts||{};damage=damage||{};
    var rawParts=Array.isArray(damage.parts)&&damage.parts.length?damage.parts:[{dice:"0",rolls:[],bonus:0,type:opts.type||damage.type||"",total:n(damage.total,0)}];
    var tags=tagsFor(target,opts.effects),groups=Object.create(null),parts=rawParts.map(function(part,index){
      var raw=Math.max(0,n(part&&part.total,0)),t=type(part&&part.type),key=t||("__untyped_"+index);
      if(!groups[key])groups[key]={type:t,raw:0,indices:[]};groups[key].raw+=raw;groups[key].indices.push(index);
      return Object.assign({},part,{rawTotal:raw,total:raw,damageType:t||null,defense:null});
    });
    var evidence=[];
    Object.keys(groups).forEach(function(key){
      var group=groups[key],defense=defenseFor(group.type,tags),final=defense.multiplier===0.5?Math.floor(group.raw/2):group.raw*defense.multiplier;
      var left=final;
      group.indices.forEach(function(index,i){
        var part=parts[index],share=i===group.indices.length-1?left:Math.min(left,Math.floor(part.rawTotal*defense.multiplier));
        part.total=share;left-=share;
        if(defense.multiplier!==1)part.defense=defense.immune?"immune":defense.resistant&&!defense.vulnerable?"resistant":defense.vulnerable&&!defense.resistant?"vulnerable":null;
      });
      if(defense.multiplier!==1)evidence.push({type:group.type,raw:group.raw,total:final,rule:defense.immune?"immunity":defense.resistant&&!defense.vulnerable?"resistance":"vulnerability"});
    });
    return {rawTotal:parts.reduce(function(sum,p){return sum+p.rawTotal;},0),total:parts.reduce(function(sum,p){return sum+p.total;},0),parts:parts,formula:damage.formula||null,evidence:evidence,tags:tags};
  }
  function teleportCells(opts){
    opts=opts||{};var map=opts.map||{},from=opts.from||{},range=Math.max(0,n(opts.range,6)),occupied=opts.occupied||new Set(),visible=opts.visible||function(){return true;},out=[];
    for(var r=0;r<n(map.rows,0);r++)for(var c=0;c<n(map.cols,0);c++){
      var key=c+","+r,dx=c-n(from.c,0),dy=r-n(from.r,0),distance=Math.max(Math.abs(dx),Math.abs(dy));
      if(!distance||distance>range)continue;
      if(map.wall&&map.wall[r*map.cols+c])continue;
      if(occupied.has&&occupied.has(key))continue;
      if(!visible({c:c,r:r}))continue;
      out.push({c:c,r:r,distance:distance,key:key});
    }
    return out;
  }
  function teleportEffect(unit,to,source){
    return {unit:unit,teleport:{to:{c:n(to&&to.c,0),r:n(to&&to.r,0)},source:source||"teleport"}};
  }

  return Object.freeze({VERSION:VERSION,DAMAGE_TYPES:DAMAGE_TYPES.slice(),tagsFor:tagsFor,defenseFor:defenseFor,resolveDamage:resolveDamage,teleportCells:teleportCells,teleportEffect:teleportEffect});
});
