/* ── forge-bridge-authority.js ─────────────────────────────────────────
   Pure structural-bridge identity, live-state application, and audit helpers.

   Browser: window.ForgeBridgeAuthority. Node: module.exports.
   The map snapshot remains immutable authority. Live open/closed/broken
   overrides are applied to runtime connector copies and can always fall back
   to the captured snapshot baseline after rewind/correction.
   ─────────────────────────────────────────────────────────────────────── */
(function(root,factory){
  var api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.ForgeBridgeAuthority=api;
})(typeof self!=="undefined"?self:this,function(){
  "use strict";
  var VERSION="1.0.0";
  var STATES=["open","closed","broken"];

  function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
  function hash32(value){
    var s=String(value==null?"":value),h=0x811c9dc5;
    for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}
    h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;
    return h>>>0;
  }
  function path(connector){
    if(!connector)return[];
    if(Array.isArray(connector.path)&&connector.path.length>=2)return connector.path;
    return connector.from&&connector.to?[connector.from,connector.to]:[];
  }
  function pointKey(q){
    var h=Number(q&&q.elevationFt);if(!Number.isFinite(h))h=0;
    return Number(q&&q.c)+","+Number(q&&q.r)+"@"+String(Math.round(h*1000)/1000);
  }
  function pathSignature(connectorOrPath){
    var p=Array.isArray(connectorOrPath)?connectorOrPath:path(connectorOrPath);
    return p.map(pointKey).join(">");
  }
  function stableId(connectorOrPath){
    var sig=pathSignature(connectorOrPath);
    return "height-bridge-"+hash32("bridge:"+sig).toString(36).padStart(7,"0");
  }
  function isBridge(c){return !!(c&&c.kind==="bridge");}
  function bridgeList(connectors){return (connectors||[]).filter(isBridge);}
  function mapSignature(connectors){
    return bridgeList(connectors).map(function(c){return String(c.id||"")+":"+pathSignature(c);}).sort().join("|");
  }
  function captureBaselines(connectors,existing){
    var out=Object.assign({},existing||{});
    bridgeList(connectors).forEach(function(c){if(!Object.prototype.hasOwnProperty.call(out,c.id))out[c.id]=STATES.indexOf(String(c.state||"open").toLowerCase())>=0?String(c.state||"open").toLowerCase():"open";});
    return out;
  }
  function stateValue(v){v=String(v||"").toLowerCase();return STATES.indexOf(v)>=0?v:null;}
  function applyStates(connectors,overrides,baselines,proofs){
    overrides=overrides||{};proofs=proofs||{};baselines=captureBaselines(connectors,baselines);
    var result={changed:[],unknown:[],mismatched:[],baselines:baselines};
    var known={};
    bridgeList(connectors).forEach(function(c){
      known[c.id]=true;
      var proof=proofs[c.id],sig=pathSignature(c),has=Object.prototype.hasOwnProperty.call(overrides,c.id),next=has?stateValue(overrides[c.id]):stateValue(baselines[c.id]);
      if(proof&&proof!==sig){result.mismatched.push({id:c.id,expected:proof,actual:sig});next=stateValue(baselines[c.id]);}
      if(!next)next="open";
      if(String(c.state||"open").toLowerCase()!==next){c.state=next;result.changed.push(c.id);}
    });
    Object.keys(overrides).forEach(function(id){if(!known[id])result.unknown.push(id);});
    return result;
  }
  function interiorPath(connector){var p=path(connector);return p.length>2?p.slice(1,-1):[];}
  function occupiesInterior(connector,units){
    var cells={};interiorPath(connector).forEach(function(q){cells[q.c+","+q.r]=true;});
    return (units||[]).some(function(u){return !!(u&&cells[u.c+","+u.r]);});
  }
  function contiguous(connector){
    var p=path(connector);if(p.length<3)return false;
    for(var i=1;i<p.length;i++)if(Math.abs(p[i].c-p[i-1].c)+Math.abs(p[i].r-p[i-1].r)!==1)return false;
    return true;
  }
  function withState(connector,state,fn){var old=connector.state;connector.state=state;try{return fn();}finally{connector.state=old;}}
  function movementAudit(map,connector,tg){
    if(!tg||typeof tg.stepAllowed!=="function")return{open:false,closed:false,broken:false};
    var p=path(connector),token={speed:30};
    var open=withState(connector,"open",function(){for(var i=1;i<p.length;i++){if(!tg.stepAllowed(map,token,p[i-1].c,p[i-1].r,p[i].c,p[i].r))return false;if(!connector.oneWay&&!tg.stepAllowed(map,token,p[i].c,p[i].r,p[i-1].c,p[i-1].r))return false;}return true;});
    function unavailable(state){return withState(connector,state,function(){
      for(var i=1;i<p.length-1;i++){
        if(tg.stepAllowed(map,token,p[i-1].c,p[i-1].r,p[i].c,p[i].r))return false;
        if(tg.stepAllowed(map,token,p[i].c,p[i].r,p[i+1].c,p[i+1].r))return false;
      }
      /* The authored land endpoints remain ordinary terrain when the span is unavailable. */
      if(p.length>=3){
        var f=p[0],s=p[1],l=p[p.length-1],b=p[p.length-2];
        var fdc={c:f.c+(f.c-s.c),r:f.r+(f.r-s.r)},ldc={c:l.c+(l.c-b.c),r:l.r+(l.r-b.r)};
        function endpointPreserved(outside,end){
          if(!tg.inBounds(map,outside.c,outside.r)||map.wall[tg.idx(map,outside.c,outside.r)])return true;
          var unavailable=tg.stepAllowed(map,token,outside.c,outside.r,end.c,end.r);
          var ordinary=withState(connector,"open",function(){return tg.stepAllowed(map,token,outside.c,outside.r,end.c,end.r);});
          return unavailable===ordinary;
        }
        if(!endpointPreserved(fdc,f)||!endpointPreserved(ldc,l))return false;
      }
      return true;
    });}
    return{open:open,closed:unavailable("closed"),broken:unavailable("broken")};
  }
  function railAudit(map,connector,tg){
    var rails=connector&&connector.rails||{};
    if(!tg||typeof tg.losVerdict!=="function"||typeof tg.bridgeBlockerAtPoint!=="function"||!(Number(rails.heightFt)>0)||(rails.left===false&&rails.right===false))return{active:false,cover:false,probes:[]};
    var p=path(connector),probes=[];
    if(p.length<3)return{active:true,cover:false,probes:probes};
    return withState(connector,"open",function(){
      for(var i=1;i<p.length-1;i++){
        var q=p[i],prev=p[i-1],next=p[i+1],dx=next.c-prev.c,dy=next.r-prev.r,len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;
        var half=Math.min(0.49,Math.max(0.05,(Number(connector.widthFt)||5)/10)),sides=[
          {enabled:rails.left!==false,px:-dy,py:dx,side:"left"},{enabled:rails.right!==false,px:dy,py:-dx,side:"right"}
        ];
        sides.forEach(function(s){
          if(!s.enabled)return;
          var x=q.c+0.5+s.px*half,y=q.r+0.5+s.py*half,z=Number(q.elevationFt||0)+Math.min(1,Number(rails.heightFt||0)*0.5);
          var footprint=tg.bridgeBlockerAtPoint(map,q.c,q.r,x,y,z),dc=Math.round(s.px),dr=Math.round(s.py),a={c:q.c+dc,r:q.r+dr},b={c:q.c,r:q.r},cover="none",culprits={};
          if(tg.inBounds(map,a.c,a.r)){
            /* Use a same-level synthetic firing ledge for the audit only. The
               real map may have water/void beside every rail, but the rail's
               cover contract must still be testable and deterministic. */
            var probe=Object.assign({},map,{h:(map.h||[]).slice(),wall:(map.wall||[]).slice(),occ:(map.occ||[]).slice(),coverShape:(map.coverShape||[]).slice(),connectors:map.connectors});
            var ai=tg.idx(probe,a.c,a.r);probe.h[ai]=Number(q.elevationFt||0);probe.wall[ai]=false;if(probe.occ)probe.occ[ai]=0;if(probe.coverShape)probe.coverShape[ai]=null;
            var v=tg.losVerdict(probe,a,b);cover=v.cover;culprits=clone(v.culprits||{});
          }
          probes.push({side:s.side,footprint:!!(footprint&&footprint.type==="bridge-rail"),from:a,to:b,cover:cover,culprits:culprits});
        });
      }
      return{active:true,cover:probes.length>0&&probes.every(function(p){return p.footprint&&(p.cover==="half"||p.cover==="three-quarters"||p.cover==="total");}),probes:probes};
    });
  }
  function auditBridge(map,connector,tg){
    var p=path(connector),move=movementAudit(map,connector,tg),rail=railAudit(map,connector,tg),sig=pathSignature(connector);
    return{
      id:connector&&connector.id||"",signature:sig,stableId:stableId(connector),identityStable:!!(connector&&connector.id===stableId(connector)),
      contiguous:contiguous(connector),pathPoints:p.length,spanFt:Math.max(0,p.length-1)*5,
      clearanceFt:Number(connector&&connector.clearanceFt)||0,state:stateValue(connector&&connector.state)||"open",
      movement:move,rails:rail,
      ok:contiguous(connector)&&move.open&&move.closed&&move.broken&&(!rail.active||rail.cover)
    };
  }
  function auditMap(map,tg){var audits=bridgeList(map&&map.connectors).map(function(c){return auditBridge(map,c,tg);});return{bridges:audits,ok:audits.every(function(a){return a.ok;}),signature:mapSignature(map&&map.connectors)};}

  return{VERSION:VERSION,STATES:STATES.slice(),hash32:hash32,path:path,pathSignature:pathSignature,stableId:stableId,mapSignature:mapSignature,
    captureBaselines:captureBaselines,applyStates:applyStates,interiorPath:interiorPath,occupiesInterior:occupiesInterior,
    movementAudit:movementAudit,railAudit:railAudit,auditBridge:auditBridge,auditMap:auditMap};
});
