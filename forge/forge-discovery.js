/* ── forge-discovery.js ───────────────────────────────────────────────
   Battle Forge Phase 1.5f — party-shared discovery + direct-fire preview.

   Pure data only. This module never touches three.js, the DOM, Supabase, or
   combat authority. The production surface decides how states are rendered;
   this layer answers only:
     - which cells are visible from party sight sources through canonical LoS;
     - how visible-now and explored-memory combine into three map states;
     - which historical PC cells should contribute to party exploration;
     - how reachable firing origins classify against one direct ranged target.

   Browser: window.ForgeDiscovery. Node: module.exports.
   ───────────────────────────────────────────────────────────────────── */
(function(root,factory){
  var api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.ForgeDiscovery=api;
})(typeof self!=="undefined"?self:this,function(){
  "use strict";

  var VERSION="1.2.0";
  var UNEXPLORED=0, EXPLORED=1, VISIBLE=2;
  var DEFAULT_SIGHT_FT=60;

  function dims(map){
    return {cols:Number(map&&((map.cols!=null)?map.cols:map.W))||0,
      rows:Number(map&&((map.rows!=null)?map.rows:map.H))||0};
  }
  function idx(map,c,r){var d=dims(map);return r*d.cols+c;}
  function inBounds(map,c,r){var d=dims(map);return c>=0&&r>=0&&c<d.cols&&r<d.rows;}
  function uniqueCells(list){
    var seen=Object.create(null),out=[];
    (list||[]).forEach(function(p){
      if(!p||!Number.isFinite(Number(p.c))||!Number.isFinite(Number(p.r)))return;
      var c=Number(p.c),r=Number(p.r),k=c+","+r;
      if(seen[k])return;seen[k]=true;out.push(Object.assign({},p,{unit:p.unit||null,c:c,r:r}));
    });
    return out;
  }
  function sightRadiusFt(unit,fallback){
    fallback=Number(fallback)||DEFAULT_SIGHT_FT;unit=unit||{};
    var candidates=[unit.sightFt,unit.visionFt,unit.darkvision,unit.darkvisionFt,
      unit.senses&&unit.senses.darkvision,unit.statblock&&unit.statblock.senses&&unit.statblock.senses.darkvision];
    for(var i=0;i<candidates.length;i++){
      var v=candidates[i];
      if(typeof v==="string"){var m=v.match(/(\d+)/);if(m)v=Number(m[1]);}
      v=Number(v);if(Number.isFinite(v)&&v>0)return v;
    }
    return fallback;
  }
  function horizontalFt(a,b){return Math.max(Math.abs(a.c-b.c),Math.abs(a.r-b.r))*5;}
  function heightAt(map,c,r){
    var d=dims(map),h=map&&((map.h!=null)?map.h:map.height),i=r*d.cols+c;
    return h&&h[i]!=null?Number(h[i])||0:0;
  }
  function rangeFt(map,a,b,geometry){
    if(geometry&&typeof geometry.range3d==="function")return geometry.range3d(map,a,b);
    var hz=horizontalFt(a,b),vz=Math.abs(heightAt(map,a.c,a.r)-heightAt(map,b.c,b.r));
    return Math.hypot(hz,vz);
  }
  /* Discovery uses strict eye-to-eye sight, not attack targeting. Attack LoS
     may lean around lips/low walls to find a legal firing point; perception
     should not reveal a room until the creature's actual eye has a clear ray.
     The target cell itself remains visible because losRay ignores endpoints,
     while high intervening walls cast truthful sight shadows. */
  function lineVisible(map,origin,target,geometry){
    if(!origin||!target)return false;
    if(origin.c===target.c&&origin.r===target.r)return true;
    if(geometry&&typeof geometry.losRay==="function"){
      var eyeFt=Number(geometry.EYE_FT)||5;
      var eye={x:origin.c+0.5,y:origin.r+0.5,z:heightAt(map,origin.c,origin.r)+eyeFt,peek:false,stepOut:false,ignore:null};
      var ray=geometry.losRay(map,origin,target,eye,{ignoreCreatures:true});
      return !(ray&&ray.blocked);
    }
    var verdict=geometry&&typeof geometry.losVerdict==="function"?geometry.losVerdict(map,origin,target,{ignoreCreatures:true}):{canTarget:true};
    return !!(verdict&&verdict.canTarget);
  }
  function visibleFrom(map,origin,geometry,opts){
    opts=opts||{};var d=dims(map),n=d.cols*d.rows,out=new Uint8Array(n);
    if(!d.cols||!d.rows||!origin||!inBounds(map,origin.c,origin.r))return out;
    var radius=Number(opts.radiusFt)||sightRadiusFt(origin,opts.defaultSightFt||DEFAULT_SIGHT_FT);
    var cells=Math.ceil(radius/5)+1;
    for(var r=Math.max(0,origin.r-cells);r<=Math.min(d.rows-1,origin.r+cells);r++){
      for(var c=Math.max(0,origin.c-cells);c<=Math.min(d.cols-1,origin.c+cells);c++){
        var target={c:c,r:r};
        if(rangeFt(map,origin,target,geometry)>radius+1e-6)continue;
        if(c===origin.c&&r===origin.r){out[idx(map,c,r)]=1;continue;}
        if(lineVisible(map,origin,target,geometry))out[idx(map,c,r)]=1;
      }
    }
    return out;
  }
  function unionMasks(masks,n){
    var out=new Uint8Array(n||0);
    (masks||[]).forEach(function(mask){if(!mask)return;for(var i=0;i<out.length&&i<mask.length;i++)if(mask[i])out[i]=1;});
    return out;
  }
  function partyVisible(map,units,geometry,opts){
    opts=opts||{};var d=dims(map),masks=[];
    (units||[]).forEach(function(u){
      if(!u||u.side!=="pc"||u.alive===false)return;
      masks.push(visibleFrom(map,u,geometry,{radiusFt:sightRadiusFt(u,opts.defaultSightFt),defaultSightFt:opts.defaultSightFt}));
    });
    return unionMasks(masks,d.cols*d.rows);
  }
  function mergeExplored(previous,visible){
    var n=Math.max(previous&&previous.length||0,visible&&visible.length||0),out=new Uint8Array(n);
    for(var i=0;i<n;i++)out[i]=(previous&&previous[i])||(visible&&visible[i])?1:0;
    return out;
  }
  function composeStates(explored,visible){
    var n=Math.max(explored&&explored.length||0,visible&&visible.length||0),out=new Uint8Array(n);
    for(var i=0;i<n;i++)out[i]=(visible&&visible[i])?VISIBLE:((explored&&explored[i])?EXPLORED:UNEXPLORED);
    return out;
  }
  function cellState(states,map,c,r){return inBounds(map,c,r)&&states?states[idx(map,c,r)]:UNEXPLORED;}
  function cellVisible(states,map,c,r){return cellState(states,map,c,r)===VISIBLE;}

  /* Reconstruct the party's explored-source cells from the shared event log.
     Rewinds/corrections do not erase player memory: if a party member actually
     saw a space on any logged branch, it remains explored. This also means a
     late joiner derives the same explored union after catch-up. */
  function historySources(roster,events,sideByUnit){
    sideByUnit=Object.assign({},sideByUnit||{});var out=[],pending=Object.create(null);
    function side(unit){return sideByUnit[unit]||null;}
    function add(unit,p){if(side(unit)!=="pc"||!p)return;out.push({unit:unit,c:Number(p.c),r:Number(p.r)});}
    (roster||[]).forEach(function(r){
      var unit=r&&(r.unit||r.key||r.id);if(!unit)return;
      var rawSide=String(r.side||r.kind||"pc").toLowerCase();
      sideByUnit[unit]=/(foe|enemy|monster|npc-hostile)/.test(rawSide)?"foe":"pc";
      add(unit,r.pos||((r.c!=null&&r.r!=null)?{c:r.c,r:r.r}:null));
    });
    (events||[]).forEach(function(row){
      if(!row)return;var p=row.payload||{},unit=row.unit;
      if(row.kind==="move_declared"){pending[unit]=Array.isArray(p.path)?p.path.slice():[];return;}
      if(row.kind==="move_resolved"){
        var path=Array.isArray(p.path)?p.path:pending[unit];
        (path||[]).forEach(function(cell){add(unit,cell);});
        add(unit,p.interrupted_at||p.final_cell);delete pending[unit];return;
      }
      if(row.kind==="edit"){
        (p.changes||[]).forEach(function(ch){
          if(ch.add_unit){var a=ch.add_unit;sideByUnit[a.unit]=a.side||"foe";add(a.unit,a.pos);}
          else add(ch.unit,ch.pos);
        });return;
      }
      if(row.kind==="restore"&&p.snapshot&&p.snapshot.units){
        Object.keys(p.snapshot.units).forEach(function(k){var u=p.snapshot.units[k];sideByUnit[k]=u.side||sideByUnit[k];add(k,u.pos);});
      }
    });
    return uniqueCells(out);
  }

  function classifyReachResult(ro){
    ro=ro||{};
    if(!ro.ok||ro.cover===Infinity||ro.coverName==="total")return {state:"blocked",reason:ro.why||"no shot",long:!!ro.dis};
    if(ro.cover===5||ro.coverName==="three-quarters")return {state:"three-quarters",cover:5,long:!!ro.dis};
    if(ro.cover===2||ro.coverName==="half")return {state:"half",cover:2,long:!!ro.dis};
    return {state:"clear",cover:0,long:!!ro.dis};
  }
  function classifyOrigins(origins,evaluate){
    var out=[],summary={clear:0,half:0,"three-quarters":0,blocked:0};
    uniqueCells(origins).forEach(function(origin){
      var ro=typeof evaluate==="function"?evaluate(origin):{ok:false,why:"no evaluator"};
      var cls=classifyReachResult(ro);summary[cls.state]++;
      out.push({c:origin.c,r:origin.r,key:origin.c+","+origin.r,cost:origin.cost||0,state:cls.state,
        cover:cls.cover,reason:cls.reason||null,long:cls.long,verdict:ro&&ro.verdict||null});
    });
    return {cells:out,summary:summary};
  }
  function stateColor(state){
    return state==="clear"?0x2da84f:state==="half"?0xe0bf44:state==="three-quarters"?0xd67a2f:0x252a27;
  }

  return Object.freeze({VERSION:VERSION,UNEXPLORED:UNEXPLORED,EXPLORED:EXPLORED,VISIBLE:VISIBLE,
    DEFAULT_SIGHT_FT:DEFAULT_SIGHT_FT,dims:dims,idx:idx,inBounds:inBounds,uniqueCells:uniqueCells,
    sightRadiusFt:sightRadiusFt,rangeFt:rangeFt,lineVisible:lineVisible,visibleFrom:visibleFrom,unionMasks:unionMasks,
    partyVisible:partyVisible,mergeExplored:mergeExplored,composeStates:composeStates,
    cellState:cellState,cellVisible:cellVisible,historySources:historySources,
    classifyReachResult:classifyReachResult,classifyOrigins:classifyOrigins,stateColor:stateColor});
});
