/* forge-death-saves.js — pure 2014 5e death-saving-throw authority.
   The acting client rolls the physical d20 result; this module turns that
   carried fact into replay-safe counters. Browser + Node dual export. */
(function(root,factory){
  var api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.ForgeDeathSaves=api;
})(typeof self!=="undefined"?self:this,function(){
  "use strict";
  var VERSION="1.0.0";
  function clamp(v){return Math.max(0,Math.min(3,Math.floor(Number(v)||0)));}
  function normalize(state){state=state||{};return {successes:clamp(state.successes),failures:clamp(state.failures),stable:!!state.stable,dead:!!state.dead};}
  function resolve(state,roll){
    var next=normalize(state),d20=Math.max(1,Math.min(20,Math.floor(Number(roll)||1))),outcome="failure";
    if(next.dead||next.stable)return Object.assign(next,{roll:d20,outcome:next.dead?"dead":"stable",reviveHp:0});
    if(d20===20)return {successes:0,failures:0,stable:false,dead:false,roll:d20,outcome:"critical-success",reviveHp:1};
    if(d20===1){next.failures=clamp(next.failures+2);outcome="critical-failure";}
    else if(d20>=10){next.successes=clamp(next.successes+1);outcome="success";}
    else next.failures=clamp(next.failures+1);
    next.stable=next.successes>=3;next.dead=next.failures>=3;
    if(next.dead)outcome="dead";else if(next.stable)outcome="stable";
    return Object.assign(next,{roll:d20,outcome:outcome,reviveHp:0});
  }
  function required(unit){var d=normalize(unit&&unit.deathSaves);return !!(unit&&unit.side==="pc"&&unit.alive===false&&!d.stable&&!d.dead);}
  return Object.freeze({VERSION:VERSION,normalize:normalize,resolve:resolve,required:required});
});
