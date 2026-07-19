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

  var VERSION="1.0.0";
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
  function score(entry){
    var ro=entry.reach||{},action=entry.action||{},target=entry.target||{};
    var damage=avgFormula(action.dmg),cover=Number(ro.cover)||0,moveCost=Number(entry.origin&&entry.origin.cost)||0;
    var wounded=target.hpMax?Math.max(0,1-Number(target.hp)/Number(target.hpMax)):0;
    return damage*12-cover*2.2-(ro.dis?11:0)-moveCost*.18+wounded*4+(moveCost===0?2:0);
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
    if(legal.length){var best=legal[0],dist=Number(best.reach.distanceFt),noun=(Number(best.action.rng)||1)>1?"shot":"attack";return Object.assign(best,{kind:best.origin.cost?"move-attack":"attack",why:(best.action.label||"Attack")+" has a legal "+(best.reach.dis?"long-range ":"")+noun+(Number.isFinite(dist)?" at "+Math.round(dist)+" ft":"")+(best.reach.coverName&&best.reach.coverName!=="none"?" through "+best.reach.coverName+" cover":"")+"."});}
    var approach=null;
    origins.forEach(function(origin){targets.forEach(function(target){var d=typeof input.distance==="function"?input.distance(origin,target):Infinity;if(!Number.isFinite(d))return;var candidate={kind:"move",origin:origin,target:target,action:actions[0]||null,distanceFt:d,score:-d-Number(origin.cost||0)*.05};if(!approach||candidate.score>approach.score)approach=candidate;});});
    if(approach)approach.why="No attack is legal this turn; move toward "+(approach.target.name||"the nearest target")+".";
    return approach||{kind:"stand",origin:origins[0]||null,action:null,target:null,why:"No legal target or movement remains."};
  }

  return Object.freeze({VERSION:VERSION,avgFormula:avgFormula,actionRangeFt:actionRangeFt,score:score,planTurn:planTurn});
});
