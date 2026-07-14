/* ════════════════════════════════════════════════════════════════════
   tactics-geometry.js — pure map-geometry rules over the MAP DOCUMENT.
   No three.js, no DOM. Same source runs in the browser (window.TacticsGeo)
   and headless in node (require / import default), so every verdict is
   smoke-testable — the WebGL-can't-be-tested-headless gap doesn't touch it.

   MAP DOCUMENT (the shared contract the generator will emit):
     { cols, rows,
       h:    Int[rows*cols]   terrain height in FEET (0,5,10,15…),
       wall: bool[rows*cols]  full-height opaque sight+move blocker }

   Everything here is ENFORCE-layer (deterministic, one right answer).
   The ADJUDICATE layer (which OAs trigger, soft/narrative cover, the DM's
   rule-of-cool override) lives above this in the mock UI, not here.
   ════════════════════════════════════════════════════════════════════ */
;(function (global) {
"use strict";

/* ── tunables (5e grid) ──────────────────────────────────────────── */
var SQUARE_FT = 5;   // one square
var STEP_FT   = 5;   // max height delta you can walk up/down in one step;
                     // anything taller is a CLIFF → needs climb or fly
var EYE_FT    = 5;   // a Medium creature's eye, above the ground it stands on
var FOOT_FT   = 0.5; // and the lowest sliver of it that still counts as visible

/* ── map helpers ─────────────────────────────────────────────────── */
function makeMap(cols, rows) {
  return { cols: cols, rows: rows,
           h: new Array(cols * rows).fill(0),
           wall: new Array(cols * rows).fill(false) };
}
function idx(map, c, r) { return r * map.cols + c; }
function inBounds(map, c, r) { return c >= 0 && c < map.cols && r >= 0 && r < map.rows; }
function heightAt(map, c, r) { return inBounds(map, c, r) ? map.h[idx(map, c, r)] : 0; }
function isWall(map, c, r) { return inBounds(map, c, r) && !!map.wall[idx(map, c, r)]; }
/* The top of whatever stands in this cell, in feet. Off-map is opaque.
   With no occ[], a wall is infinitely tall — v1 behaviour, unchanged. */
function occTop(map, c, r) {
  if (!inBounds(map, c, r)) return Infinity;
  var i = idx(map, c, r);
  if (map.occ && map.occ[i] != null) return map.h[i] + map.occ[i];
  return map.wall[i] ? Infinity : map.h[i];
}
function chebyshev(a, b) { return Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r)); }

/* ── MOVEMENT — height-gated BFS ─────────────────────────────────────
   Walls block. Occupied tiles block. A step to an adjacent tile is barred
   when the height delta exceeds STEP_FT — UNLESS the token can climb or fly.
   (Climb cost = still 1 square here; real 5e 2×-cost climb is a later refinement.)
   `occupied` is a Set of "c,r" strings for other creatures.               */
var DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
function stepAllowed(map, token, fromC, fromR, toC, toR) {
  if (!inBounds(map, toC, toR)) return false;
  if (isWall(map, toC, toR)) return false;
  var dh = Math.abs(heightAt(map, toC, toR) - heightAt(map, fromC, fromR));
  if (token.fly || token.climb) return true;      // wings / climb kit ignore the cliff
  return dh <= STEP_FT;                            // otherwise a cliff is a hard no
}
function movementReach(map, token, occupied, budgetSquares) {
  occupied = occupied || new Set();
  var budget = (budgetSquares != null) ? budgetSquares : Math.floor(token.speed / SQUARE_FT);
  var start = token.c + "," + token.r;
  var seen = {}; seen[start] = { d: 0, from: null };
  var q = [{ c: token.c, r: token.r, d: 0 }];
  while (q.length) {
    var n = q.shift();
    if (n.d >= budget) continue;
    for (var i = 0; i < DIRS.length; i++) {
      var c = n.c + DIRS[i][0], r = n.r + DIRS[i][1], k = c + "," + r;
      if (seen[k] !== undefined) continue;
      if (occupied.has(k)) continue;
      if (!stepAllowed(map, token, n.c, n.r, c, r)) continue;
      seen[k] = { d: n.d + 1, from: n.c + "," + n.r };
      q.push({ c: c, r: r, d: n.d + 1 });
    }
  }
  delete seen[start];
  return seen;
}
function pathTo(seen, token, c, r) {
  var path = [], k = c + "," + r, home = token.c + "," + token.r;
  while (k && k !== home) {
    var p = k.split(",").map(Number);
    path.unshift({ c: p[0], r: p[1] });
    k = seen[k] ? seen[k].from : null;
  }
  return path;
}

/* ── MELEE REACH — horizontal AND vertical ───────────────────────────
   You can't swing a longsword at someone one square away but 15 ft up.
   reachFt is 5 for most, 10 for reach weapons.                            */
function canReachMelee(map, a, b, reachFt) {
  reachFt = reachFt || SQUARE_FT;
  var horizOk = chebyshev(a, b) <= Math.floor(reachFt / SQUARE_FT);
  var dv = Math.abs(heightAt(map, a.c, a.r) - heightAt(map, b.c, b.r));
  return horizOk && dv <= reachFt;
}

/* ── RANGED — true 3D distance in feet ───────────────────────────────
   Horizontal on the grid (chebyshev×5) combined with the vertical drop.  */
function range3d(map, a, b) {
  var horiz = chebyshev(a, b) * SQUARE_FT;
  var vert = Math.abs(heightAt(map, a.c, a.r) - heightAt(map, b.c, b.r));
  return Math.hypot(horiz, vert);
}
function inRange(map, a, b, rangeFt) { return range3d(map, a, b) <= rangeFt + 1e-6; }

/* ── LINE-OF-SIGHT + COVER — 5e body coverage in three dimensions ──
   Visibility and cover are related but no longer the same question.

   TOTAL COVER / line of sight:
     all target-body samples are blocked somewhere along the shot.

   COVER GRADE:
     only target-side blockers count toward the target's cover, preserving the
     table ruling that shooter-side clutter is a vantage problem rather than
     bonus AC. Twelve target samples (four inset horizontal corners across
     lower-body, torso, and head bands) approximate the 5e body-percentage rule:
       0–5 target-side samples blocked  → no cover
       6–8                              → half cover (+2)
       9–11                             → three-quarters (+5)
       12 blocked anywhere              → total cover

   This avoids the old eight-ray failure where a shin-high lip blocked all four
   foot rays and automatically granted half cover despite leaving most of the
   creature visible. Optional coverShape[] entries let narrow trunks/columns
   occupy only part of a cell; optional creatures[] provide intervening-creature
   cover without turning every occupied square into a five-foot solid cube. */
var BODY_LEVELS = [0.75, 2.75, 4.75];
var SAMPLE_INSET = 0.08;
var BODY_CORNERS = [
  [SAMPLE_INSET,SAMPLE_INSET],[1-SAMPLE_INSET,SAMPLE_INSET],
  [SAMPLE_INSET,1-SAMPLE_INSET],[1-SAMPLE_INSET,1-SAMPLE_INSET]
];
var BODY_SAMPLES = BODY_LEVELS.length * BODY_CORNERS.length;

function coverShapeAt(map,c,r){
  if(!inBounds(map,c,r)||!map.coverShape)return null;
  return map.coverShape[idx(map,c,r)]||null;
}
function pointInCoverShape(shape,lx,ly){
  if(!shape||shape.kind==='full')return true;
  var cx=shape.cx==null?0.5:Number(shape.cx),cy=shape.cy==null?0.5:Number(shape.cy);
  if(shape.kind==='circle'){
    var rad=shape.radius==null?0.28:Number(shape.radius),dx=lx-cx,dy=ly-cy;
    return dx*dx+dy*dy<=rad*rad+1e-9;
  }
  if(shape.kind==='box'){
    var hx=shape.halfX==null?0.35:Number(shape.halfX),hy=shape.halfY==null?hx:Number(shape.halfY);
    return Math.abs(lx-cx)<=hx+1e-9&&Math.abs(ly-cy)<=hy+1e-9;
  }
  return true;
}
function addedBlocker(map,c,r,x,y,z,ignoreCell){
  if(!inBounds(map,c,r))return {c:c,r:r,type:'off-map'};
  var i=idx(map,c,r),ground=heightAt(map,c,r);
  if(ground>z+1e-9)return {c:c,r:r,type:'terrain'};
  if(ignoreCell&&c===ignoreCell.c&&r===ignoreCell.r)return null;
  var occ;
  if(map.occ&&map.occ[i]!=null)occ=Number(map.occ[i])||0;
  else occ=map.wall[i]?Infinity:0;
  if(!(ground+occ>z+1e-9))return null;
  var shape=coverShapeAt(map,c,r);
  if(shape&&!pointInCoverShape(shape,x-c,y-r))return null;
  return {c:c,r:r,type:(shape&&shape.source)||((map.wall&&map.wall[i])?'wall':'occluder')};
}
function creatureBlocker(map,c,r,x,y,z,opts){
  if(opts&&opts.ignoreCreatures)return null;
  var list=map&&map.creatures;
  if(!Array.isArray(list))return null;
  for(var i=0;i<list.length;i++){
    var u=list[i];if(!u||u.alive===false||u.c!==c||u.r!==r)continue;
    var ground=heightAt(map,c,r),height=Number(u.heightFt)||5;
    if(!(ground+height>z+1e-9))continue;
    var rad=Number(u.radius);if(!Number.isFinite(rad))rad=0.28;
    var cx=c+(u.cx==null?0.5:Number(u.cx)),cy=r+(u.cy==null?0.5:Number(u.cy));
    var dx=x-cx,dy=y-cy;if(dx*dx+dy*dy<=rad*rad+1e-9)
      return {c:c,r:r,type:'creature',unit:u.unit||u.key||u.id||null};
  }
  return null;
}
function blockerAtPoint(map,c,r,x,y,z,ignoreCell,opts){
  return addedBlocker(map,c,r,x,y,z,ignoreCell)||creatureBlocker(map,c,r,x,y,z,opts);
}
function segBlocker(map,x0,y0,z0,x1,y1,z1,aC,aR,bC,bR,ignoreCell,opts){
  var steps=240;
  for(var s=1;s<steps;s++){
    var t=s/steps,x=x0+(x1-x0)*t,y=y0+(y1-y0)*t,z=z0+(z1-z0)*t;
    var c=Math.floor(x),r=Math.floor(y);
    if((c===aC&&r===aR)||(c===bC&&r===bR))continue;
    var hit=blockerAtPoint(map,c,r,x,y,z,ignoreCell,opts);if(hit)return hit;
  }
  return null;
}
function segOccluded(map,x0,y0,z0,x1,y1,z1,aC,aR,bC,bR,ignoreCell,opts){
  return segBlocker(map,x0,y0,z0,x1,y1,z1,aC,aR,bC,bR,ignoreCell,opts)!==null;
}
function traceTop(map,c,r,ignoreCell){
  if(ignoreCell&&c===ignoreCell.c&&r===ignoreCell.r)return heightAt(map,c,r);
  return occTop(map,c,r);
}
function segAttrib(map,x0,y0,z0,x1,y1,z1,a,b,ignoreCell,opts){
  var steps=240,blocked=false,graded=false,first=null,types={};
  for(var s=1;s<steps;s++){
    var t=s/steps,x=x0+(x1-x0)*t,y=y0+(y1-y0)*t,z=z0+(z1-z0)*t;
    var c=Math.floor(x),r=Math.floor(y);
    if((c===a.c&&r===a.r)||(c===b.c&&r===b.r))continue;
    var hit=blockerAtPoint(map,c,r,x,y,z,ignoreCell,opts);if(!hit)continue;
    blocked=true;if(!first)first=hit;types[hit.type]=(types[hit.type]||0)+1;
    var cell={c:c,r:r};
    if(chebyshev(cell,b)<=chebyshev(cell,a)){graded=true;break;}
  }
  return {blocked:blocked,graded:graded,first:first,types:types};
}
function segHitsWall(map,x0,y0,x1,y1,aC,aR,bC,bR){
  var z=heightAt(map,aC,aR)+EYE_FT;
  return segOccluded(map,x0,y0,z,x1,y1,z,aC,aR,bC,bR,null,null);
}
var CORNERS=[[0,0],[1,0],[0,1],[1,1]];
function lipCorners(map,c,r){
  var floor=heightAt(map,c,r),out=[];
  for(var k=0;k<CORNERS.length;k++){
    var dx=CORNERS[k][0]?1:-1,dy=CORNERS[k][1]?1:-1;
    if(occTop(map,c+dx,r)<floor-1e-9||occTop(map,c,r+dy)<floor-1e-9||occTop(map,c+dx,r+dy)<floor-1e-9)
      out.push([c+CORNERS[k][0],r+CORNERS[k][1]]);
  }
  return out;
}
function targetFacingEdges(a,b){
  var dx=(b.c+0.5)-(a.c+0.5),dy=(b.r+0.5)-(a.r+0.5),ax=Math.abs(dx),ay=Math.abs(dy),out=[];
  if(ax<1e-12&&ay<1e-12)return out;
  if(ax>=ay-1e-12&&ax>1e-12){var sx=dx>0?1:-1;out.push({c:a.c+sx,r:a.r,x:a.c+(sx>0?1:0),y:a.r+0.5,edge:'x'});}
  if(ay>=ax-1e-12&&ay>1e-12){var sy=dy>0?1:-1;out.push({c:a.c,r:a.r+sy,x:a.c+0.5,y:a.r+(sy>0?1:0),edge:'y'});}
  return out;
}
function lowWallPeeks(map,a,b){
  var edges=targetFacingEdges(a,b),z=heightAt(map,a.c,a.r)+EYE_FT,out=[],hasFacingWall=false;
  for(var i=0;i<edges.length;i++){
    var e=edges[i];if(!inBounds(map,e.c,e.r)||(e.c===b.c&&e.r===b.r)||!isWall(map,e.c,e.r))continue;
    hasFacingWall=true;if(occTop(map,e.c,e.r)<z-1e-9)
      out.push({x:e.x,y:e.y,z:z,peek:true,stepOut:true,ignore:{c:e.c,r:e.r},edge:e.edge});
  }
  return {eyes:out,hasFacingWall:hasFacingWall};
}
function targetFacingLipCorners(map,a,b){
  var lips=lipCorners(map,a.c,a.r);if(!lips.length)return lips;
  var dx=(b.c+0.5)-(a.c+0.5),dy=(b.r+0.5)-(a.r+0.5),best=-Infinity,scores=[];
  for(var i=0;i<lips.length;i++){var sx=lips[i][0]-(a.c+0.5),sy=lips[i][1]-(a.r+0.5),score=sx*dx+sy*dy;scores.push(score);if(score>best)best=score;}
  return lips.filter(function(_,i){return scores[i]>=best-1e-9;});
}
function cornerOutsideBlocked(map,a,corner,z){
  var sx=corner[0]<0.5?-1:1,sy=corner[1]<0.5?-1:1;
  var cells=[{c:a.c+sx,r:a.r},{c:a.c,r:a.r+sy}];
  for(var i=0;i<cells.length;i++){
    var q=cells[i];if(inBounds(map,q.c,q.r)&&isWall(map,q.c,q.r)&&occTop(map,q.c,q.r)>=z-1e-9)return true;
  }
  return false;
}
function targetFacingCornerEyes(map,a,b){
  var z=heightAt(map,a.c,a.r)+EYE_FT,dx=(b.c+0.5)-(a.c+0.5),dy=(b.r+0.5)-(a.r+0.5);
  var best=-Infinity,scored=[];
  for(var i=0;i<BODY_CORNERS.length;i++){
    var q=BODY_CORNERS[i],score=(q[0]-0.5)*dx+(q[1]-0.5)*dy;scored.push({q:q,score:score});if(score>best)best=score;
  }
  return scored.filter(function(s){return s.score>=best-1e-9&&!cornerOutsideBlocked(map,a,s.q,z);})
    .map(function(s){return {x:a.c+s.q[0],y:a.r+s.q[1],z:z,peek:false,stepOut:false,ignore:null,edge:'corner'};});
}
function firingPoints(map,a,b){
  var z=heightAt(map,a.c,a.r)+EYE_FT,wall=lowWallPeeks(map,a,b);if(wall.hasFacingWall)return wall.eyes;
  var out=[],seen={};
  targetFacingLipCorners(map,a,b).forEach(function(q){var eye={x:q[0],y:q[1],z:z,peek:true,stepOut:false,ignore:null,edge:'lip'},k=eye.x+','+eye.y;if(!seen[k]){seen[k]=1;out.push(eye);}});
  targetFacingCornerEyes(map,a,b).forEach(function(eye){var k=eye.x+','+eye.y;if(!seen[k]){seen[k]=1;out.push(eye);}});
  return out;
}
function mergeTypes(dst,src){Object.keys(src||{}).forEach(function(k){dst[k]=(dst[k]||0)+src[k];});}
function verdictFromEye(map,ax,ay,az,a,b,ignoreCell,opts){
  var bh=heightAt(map,b.c,b.r),blocked=0,graded=0,types={},first=null;
  for(var zc=0;zc<BODY_LEVELS.length;zc++)for(var tc=0;tc<BODY_CORNERS.length;tc++){
    var q=BODY_CORNERS[tc],line=segAttrib(map,ax,ay,az,b.c+q[0],b.r+q[1],bh+BODY_LEVELS[zc],a,b,ignoreCell,opts);
    if(line.blocked){blocked++;if(!first)first=line.first;if(line.graded)graded++;mergeTypes(types,line.types);}
  }
  var cover,acBonus;
  if(blocked>=BODY_SAMPLES){cover='total';acBonus=Infinity;}
  else if(graded<6){cover='none';acBonus=0;}
  else if(graded<9){cover='half';acBonus=2;}
  else{cover='three-quarters';acBonus=5;}
  return {cover:cover,acBonus:acBonus,blocked:blocked,graded:graded,samples:BODY_SAMPLES,
    canTarget:cover!=='total',culprits:types,firstBlocker:first};
}
function losVerdict(map,a,b,opts){
  opts=opts||{};var az=heightAt(map,a.c,a.r)+EYE_FT;
  var v=verdictFromEye(map,a.c+0.5,a.r+0.5,az,a,b,null,opts);
  v.eye={x:a.c+0.5,y:a.r+0.5,z:az,peek:false,stepOut:false,ignore:null,edge:null};
  if(v.acBonus===0)return v;
  var eyes=firingPoints(map,a,b);
  for(var e=0;e<eyes.length;e++){
    var eye=eyes[e],probe=eye.ignore?losRay(map,a,b,eye,opts):null;
    if(probe&&probe.blocked&&probe.at&&probe.at.c===eye.ignore.c&&probe.at.r===eye.ignore.r)continue;
    var w=verdictFromEye(map,eye.x,eye.y,eye.z,a,b,eye.ignore||null,opts);
    if(w.acBonus<v.acBonus||(w.acBonus===v.acBonus&&w.blocked<v.blocked)){w.eye=eye;v=w;}
    if(v.acBonus===0)break;
  }
  return v;
}
function losRay(map,a,b,eye,opts){
  var x0=(eye&&eye.x!=null)?eye.x:a.c+0.5,y0=(eye&&eye.y!=null)?eye.y:a.r+0.5;
  var z0=(eye&&eye.z!=null)?eye.z:heightAt(map,a.c,a.r)+EYE_FT;
  var x1=b.c+0.5,y1=b.r+0.5,z1=heightAt(map,b.c,b.r)+EYE_FT,ignoreCell=eye&&eye.ignore,steps=240;
  for(var s=1;s<steps;s++){
    var t=s/steps,x=x0+(x1-x0)*t,y=y0+(y1-y0)*t,z=z0+(z1-z0)*t,c=Math.floor(x),r=Math.floor(y);
    if((c===a.c&&r===a.r)||(c===b.c&&r===b.r))continue;
    var hit=blockerAtPoint(map,c,r,x,y,z,ignoreCell,opts);if(hit)return {blocked:true,at:hit};
  }
  return {blocked:false,at:null};
}
function coverAudit(map,pairs,opts){
  var counts={none:0,half:0,'three-quarters':0,total:0},culprits={},total=0;
  (pairs||[]).forEach(function(pair){if(!pair||!pair.a||!pair.b)return;var v=losVerdict(map,pair.a,pair.b,opts);counts[v.cover]++;total++;mergeTypes(culprits,v.culprits);});
  var pct={};Object.keys(counts).forEach(function(k){pct[k]=total?Math.round(counts[k]*1000/total)/10:0;});
  return {total:total,counts:counts,percent:pct,culprits:culprits};
}
var API={
  SQUARE_FT:SQUARE_FT,STEP_FT:STEP_FT,EYE_FT:EYE_FT,FOOT_FT:FOOT_FT,DIRS:DIRS,
  BODY_LEVELS:BODY_LEVELS,BODY_SAMPLES:BODY_SAMPLES,
  makeMap:makeMap,idx:idx,inBounds:inBounds,heightAt:heightAt,isWall:isWall,occTop:occTop,chebyshev:chebyshev,
  stepAllowed:stepAllowed,movementReach:movementReach,pathTo:pathTo,canReachMelee:canReachMelee,range3d:range3d,inRange:inRange,
  coverShapeAt:coverShapeAt,pointInCoverShape:pointInCoverShape,losVerdict:losVerdict,losRay:losRay,
  lipCorners:lipCorners,targetFacingEdges:targetFacingEdges,lowWallPeeks:lowWallPeeks,firingPoints:firingPoints,coverAudit:coverAudit
};
if(typeof module!=="undefined"&&module.exports)module.exports=API;
global.TacticsGeo=API;

})(typeof window !== "undefined" ? window : globalThis);
