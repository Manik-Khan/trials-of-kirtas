/* ── forge-foe-ai.js ──────────────────────────────────────────────────
   Pure enemy-turn planner. It never rolls, mutates combat, or reads the DOM;
   production supplies canonical reach/cover verdicts for every candidate
   origin, target, and parsed stat-block attack. */
(function(root,factory){
  var api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.ForgeFoeAI=api;
})(typeof self!=="undefined"?self:this,function(){
  "use strict";

  var VERSION="1.1.0";
  function avgFormula(formula){
    var total=0,ok=false;
    String(formula||"").replace(/(\d+)d(\d+)|([+-]?\d+)/gi,function(_,n,f,flat){
      if(n&&f){total+=Number(n)*(Number(f)+1)/2;ok=true;}
      else if(flat){total+=Number(flat);ok=true;}
      return _;
    });
    return ok?Math.max(0,total):0;
  }
  function actionRangeFt(action){
    action=action||{};return Math.max(5,(Number(action.long)||Number(action.rng)||1)*5);
  }
  function rangedAction(action){return Number(action&&action.rng)>1;}
  function clamp(n,lo,hi){return Math.max(lo,Math.min(hi,n));}
  function score(entry){
    var ro=entry.reach||{},action=entry.action||{},target=entry.target||{};
    var damage=avgFormula(action.dmg),cover=Number(ro.cover)||0,moveCost=Number(entry.origin&&entry.origin.cost)||0;
    var wounded=target.hpMax?Math.max(0,1-Number(target.hp)/Number(target.hpMax)):0;
    var total=damage*12-cover*3.5-(ro.dis?16:0)-moveCost*.35+wounded*4+(moveCost===0?3:0);
    var elevation=(Number(ro.originElevationFt)||0)-(Number(ro.targetElevationFt)||0);
    if(rangedAction(action)){
      var distance=Number(ro.distanceFt)||0,normal=Math.max(10,Number(action.rng)*5),threats=Number(ro.threatCount)||0;
      var preferredMin=Math.min(40,Math.max(15,normal*.3));
      total+=8-threats*24+clamp(elevation/5,-3,3)*2;
      if(distance>=preferredMin&&!ro.dis)total+=8;
      else if(distance<preferredMin)total-=(preferredMin-distance)*.45;
    }else total+=clamp(elevation/5,-2,2);
    return total;
  }
  function tacticalReasons(entry){
    var ro=entry.reach||{},action=entry.action||{},reasons=[];
    if(rangedAction(action)){
      if(!Number(ro.threatCount)&&Number(ro.distanceFt)>=Math.min(40,Math.max(15,Number(action.rng||1)*5*.3)))reasons.push("keeps a safe firing distance");
      if((Number(ro.originElevationFt)||0)>(Number(ro.targetElevationFt)||0))reasons.push("holds the high ground");
      if(Number(entry.origin&&entry.origin.cost)===0)reasons.push("already has the shot");
    }
    return reasons;
  }
  function planTurn(input){
    input=input||{};var actions=(input.actions||[]).filter(function(a){return a&&a.kind==="attack"&&a.dmg;}),targets=(input.targets||[]).filter(function(t){return t&&t.alive!==false;}),origins=input.origins||[],evaluate=input.evaluate;
    var legal=[];
    origins.forEach(function(origin){actions.forEach(function(action){targets.forEach(function(target){
      var ro=typeof evaluate==="function"?evaluate(origin,action,target):{ok:false};
      if(ro&&ro.ok)legal.push({origin:origin,action:action,target:target,reach:ro});
    });});});
    legal.forEach(function(entry){entry.score=score(entry);});
    legal.sort(function(a,b){return b.score-a.score||Number(a.origin.cost||0)-Number(b.origin.cost||0)||String(a.action.label||"").localeCompare(String(b.action.label||""));});
    if(legal.length){var best=legal[0],dist=Number(best.reach.distanceFt),noun=rangedAction(best.action)?"shot":"attack",reasons=tacticalReasons(best);return Object.assign(best,{kind:best.origin.cost?"move-attack":"attack",why:(best.action.label||"Attack")+" has a legal "+(best.reach.dis?"long-range ":"")+noun+(Number.isFinite(dist)?" at "+Math.round(dist)+" ft":"")+(best.reach.coverName&&best.reach.coverName!=="none"?" through "+best.reach.coverName+" cover":"")+(reasons.length?"; "+reasons.join(" and "):"")+"."});}
    var approach=null;
    origins.forEach(function(origin){targets.forEach(function(target){var d=typeof input.distance==="function"?input.distance(origin,target):Infinity;if(!Number.isFinite(d))return;var candidate={kind:"move",origin:origin,target:target,action:actions[0]||null,distanceFt:d,score:-d-Number(origin.cost||0)*.05};if(!approach||candidate.score>approach.score)approach=candidate;});});
    if(approach)approach.why="No attack is legal this turn; move toward "+(approach.target.name||"the nearest target")+".";
    return approach||{kind:"stand",origin:origins[0]||null,action:null,target:null,why:"No legal target or movement remains."};
  }

  return Object.freeze({VERSION:VERSION,avgFormula:avgFormula,actionRangeFt:actionRangeFt,rangedAction:rangedAction,score:score,planTurn:planTurn});
});
