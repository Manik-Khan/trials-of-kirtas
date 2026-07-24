/* ── forge-reaction-choices.js ────────────────────────────────────────
   Pure choice helpers for approved reaction/rider UX. No DOM, dice, or
   protocol writes: production asks this module what may be offered and what
   straight forced-movement path is legal, then records the chosen fact.     */
(function(root,factory){var api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.ForgeReactionChoices=api;})(typeof self!=="undefined"?self:this,function(){
  "use strict";
  var VERSION="1.0.0";
  function norm(value){return String(value||"").toLowerCase().replace(/\u2019/g,"'").trim();}
  function isAtWillAttackCantrip(action){
    if(!action||!action.spell||action.kind!=="attack"||action.bonus||action.free)return false;
    if(action.cost&&Object.keys(action.cost).length)return false;
    return action.level==null||Number(action.level)===0;
  }
  function warCasterChoices(unit,weapon){
    var out=[],seen={};
    function add(action,kind){if(!action)return;var key=norm(action.label);if(!key||seen[key])return;seen[key]=1;out.push({kind:kind,label:action.label,action:action});}
    add(weapon,"weapon");
    if(!(unit&&unit.featureFlags&&unit.featureFlags.warCaster))return out;
    (unit.actions||[]).forEach(function(action){if(isAtWillAttackCantrip(action))add(action,"cantrip");});
    return out;
  }
  function sign(value){return value<0?-1:value>0?1:0;}
  function repellingPath(input){
    input=input||{};var map=input.map,geo=input.geometry,caster=input.caster,target=input.target,max=Math.max(0,Math.min(2,Number(input.maxSquares)||2)),occupied=input.occupied||new Set(),path=[];
    if(!map||!geo||!caster||!target||!max)return path;
    var dc=sign(Number(target.c)-Number(caster.c)),dr=sign(Number(target.r)-Number(caster.r));
    if(!dc&&!dr)return path;
    var from={c:Number(target.c),r:Number(target.r)};
    for(var i=0;i<max;i++){
      var to={c:from.c+dc,r:from.r+dr},key=to.c+","+to.r;
      if(occupied.has(key))break;
      if(geo.diagonalSqueezeBlocked&&geo.diagonalSqueezeBlocked(map,occupied,from.c,from.r,to.c,to.r))break;
      if(!geo.stepAllowed(map,target,from.c,from.r,to.c,to.r))break;
      path.push(to);from=to;
    }
    return path;
  }
  return Object.freeze({VERSION:VERSION,isAtWillAttackCantrip:isAtWillAttackCantrip,warCasterChoices:warCasterChoices,repellingPath:repellingPath});
});
