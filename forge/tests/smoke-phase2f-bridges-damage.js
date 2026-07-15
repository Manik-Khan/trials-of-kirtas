#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm"),os=require("os");
const root=path.resolve(__dirname,"..");
const GF=require(path.join(root,"forge-generator-foundation.js"));
const TG=require(path.join(root,"tactics-geometry.js"));
const DE=require(path.join(root,"forge-damage-evidence.js"));
const patcher=require(path.join(root,"patch-phase2f-geometry-sync.js"));
let pass=0;function ok(v,l){if(!v)throw new Error("FAIL: "+l);console.log("ok",++pass,"-",l);}function eq(a,b,l){var ja=JSON.stringify(a),jb=JSON.stringify(b),detail=(ja.length+jb.length<240)?" ("+ja+" vs "+jb+")":"";ok(ja===jb,l+detail);}
function loadEngine(){
  const FD={THEME_KEYS:["grass"],generateDungeon(){throw new Error("not used")}};
  const MB={CELL:{VOID:0,FLOOR:1,WALL:2,POOL:3},validate(){return{ok:true}},dungeonToMap(){throw new Error("not used")}};
  const context={self:{ForgeDungeon:FD,MapBridge:MB,ForgeGeneratorFoundation:GF},console,Set,Map,Math,JSON,Array,Float32Array,Uint8Array,Number,Object,String,Infinity};
  vm.runInNewContext(fs.readFileSync(path.join(root,"forge-engine.js"),"utf8"),context,{filename:"forge-engine.js"});
  return {E:context.self.ForgeEngine,MB};
}
const {E,MB}=loadEngine();
const cols=7,rows=3,n=cols*rows,idx=(c,r)=>r*cols+c;
const map={cols,rows,h:new Array(n).fill(0),wall:new Array(n).fill(true),occ:new Array(n).fill(0),coverShape:new Array(n).fill(null),connectors:[],ledges:[],spawns:[],props:[],meta:{}};
const grid=new Array(n).fill(MB.CELL.WALL);
[[1,1],[5,1],[3,0]].forEach(([c,r])=>{map.wall[idx(c,r)]=false;map.h[idx(c,r)]=10;grid[idx(c,r)]=MB.CELL.FLOOR;});
[[2,1],[3,1],[4,1]].forEach(([c,r])=>{grid[idx(c,r)]=MB.CELL.POOL;map.wall[idx(c,r)]=true;map.h[idx(c,r)]=0;});
const dungeon={W:cols,H:rows,grid};
const vertical=E._internals.verticalRecords(map,12345,dungeon);map.connectors=vertical.connectors;map.ledges=vertical.ledges;
const bridges=map.connectors.filter(c=>c.kind==="bridge");
ok(bridges.length===1,"height stage emits one deterministic structural bridge");
const bridge=bridges[0];
eq(bridge.path.map(p=>[p.c,p.r]),[[1,1],[2,1],[3,1],[4,1],[5,1]],"bridge path owns every consecutive deck cell");
ok(bridge.clearanceFt===9.5,"bridge records under-clearance beneath its half-foot deck");
ok(bridge.rails&&bridge.rails.heightFt===2.5,"bridge records two-and-a-half-foot rails");
ok(E._internals.validateVerticalRecords(map),"engine validates multi-cell bridge structure");
ok(E._internals.ordinaryStepAllowed(map,1,1,2,1),"ordinary creature enters bridge at authored endpoint");
ok(E._internals.ordinaryStepAllowed(map,2,1,3,1),"ordinary creature walks consecutive bridge deck cells");
ok(!E._internals.ordinaryStepAllowed(map,3,0,3,1),"side entry into bridge middle is refused");

ok(TG.heightAt(map,3,1)===10,"geometry reports bridge deck as standing elevation");
ok(!TG.isWall(map,3,1),"open bridge surface overrides blocked pool for occupancy");
ok(TG.stepAllowed(map,{speed:30},1,1,2,1),"canonical movement enters bridge path");
ok(!TG.stepAllowed(map,{speed:30},3,0,3,1),"canonical movement refuses diagonal/side bridge entry");
let hit=TG.bridgeBlockerAtPoint(map,3,1,3.5,1.5,9.75);
ok(hit&&hit.type==="bridge-deck","bridge deck blocks a ray through its slab");
ok(TG.bridgeBlockerAtPoint(map,3,1,3.5,1.5,5)===null,"under-clearance remains open below the deck");
hit=TG.bridgeBlockerAtPoint(map,3,1,3.5,1.98,11);
ok(hit&&hit.type==="bridge-rail","bridge rail is a real sight/cover blocker");
bridge.state="broken";
ok(TG.isWall(map,3,1),"broken bridge removes the walk surface");
bridge.state="open";

const snap=GF.snapshotMap(map),fingerprint=GF.fingerprintSnapshot(snap),restored=GF.restoreMap(snap,fingerprint);
ok(restored.connectors[0].deckThicknessFt===0.5,"snapshot preserves bridge deck thickness");
ok(restored.connectors[0].rails.heightFt===2.5,"snapshot preserves bridge rails");
ok(restored.connectors[0].path.length===5,"snapshot preserves complete bridge path");
ok(GF.fingerprintSnapshot(GF.snapshotMap(restored))===fingerprint,"bridge snapshot round-trip is fingerprint stable");

const part={dice:"1d8",rolls:[3],bonus:6,type:"Slashing",total:9};
ok(DE.arithmetic(part)==="[3] +6 = 9 Slashing","damage evidence spells the exact rolled arithmetic");
ok(DE.formula(part)==="1d8 + 6 Slashing","damage evidence spells the source formula");
const fact=DE.attachPayload({dmg:9},{dmg:9,dmgParts:[part],dmgFormula:"1d8+6 Slashing"});
ok(fact.dmgParts[0].bonus===6,"resolved payload retains the damage modifier");
ok(/\[3\] \+6 = 9 Slashing/.test(DE.html(fact.dmgParts,fact.dmg)),"visible damage HTML contains the full breakdown");
const fakeLine={inserted:"",querySelector(){return null;},insertAdjacentHTML(_where,value){this.inserted+=value;},setAttribute(){}};
const fakeDetail={setAttribute(k,v){this[k]=v;}};
const fakeRow={querySelector(sel){if(sel==='[data-damage-evidence="1"]')return null;if(sel==='.ffr-dmg-detail')return fakeDetail;return null;},querySelectorAll(sel){return sel==='.ffr-dmg-line'?[fakeLine]:[];}};
ok(DE.decorateRow(fakeRow,fact)&&/1d8 \+ 6 Slashing/.test(fakeLine.inserted),"legacy total rows receive the visible source formula before their rolled arithmetic");

const html=fs.readFileSync(path.join(root,"topography-test-mock.html"),"utf8");
ok(html.includes('if(weapon||cantrip)a.dmgBonus=(Number(a.dmgBonus)||0)+2'),"Dueling modifies normal weapons and bound weapon-cantrips on the shared damage-bonus property");
ok(!html.includes('if(cantrip)a.dmgMod='),"Dueling is not misapplied to the spell-attack cantrip modifier branch");
const rollStart=html.indexOf('function parseDmg(s){'),rollEnd=html.indexOf('function rangeFt(a){',rollStart);
ok(rollStart>=0&&rollEnd>rollStart,"production damage roller is extractable for a known-answer gate");
const rollCtx={d(){return 3;},Number,String,Array,Math};vm.createContext(rollCtx);vm.runInContext(html.slice(rollStart,rollEnd),rollCtx);
const vesDamage=rollCtx.rollActionDamage({dmgStack:[{dice:"1d8",bonus:6,type:"Slashing"}]},false,[]);
ok(vesDamage.total===9&&vesDamage.parts[0].bonus===6&&vesDamage.parts[0].rolls[0]===3,"Vesperian known-answer damage keeps DEX plus Dueling as +6");
ok(DE.text(vesDamage.parts,vesDamage.total)==="[3] +6 = 9 Slashing","the exact Vesperian known-answer arithmetic reaches the feed evidence layer");
const critDamage=rollCtx.rollActionDamage({dmgStack:[{dice:"1d8",bonus:6,type:"Slashing"}]},true,[]);
ok(critDamage.total===12&&critDamage.parts[0].rolls.length===2&&critDamage.parts[0].bonus===6,"critical damage doubles the die but not the +6 modifier");
ok(html.includes('dmgFormula:damage?damage.formula:null'),"shared attack facts publish a human-readable damage formula");
ok(html.includes('D.decorateNewestRow(document,fact)'),"feed independently enforces visible damage evidence");
ok(html.includes('function renderBridgeConnector(c)'),"production renderer draws first-class bridges");
ok(html.includes("c.kind==='bridge'?0x68b7d1"),"height overlay distinguishes bridge paths");

const canon=fs.readFileSync(path.join(root,"tactics-geometry.js"),"utf8").trim();
const start=html.indexOf('/* ════════════════════════════════════════════════════════════════════');
const end=html.indexOf('</script>\n<style>',start);
ok(start>=0&&end>start,"production inline geometry boundaries exist");
eq(html.slice(start,end).trim(),canon,"production inline geometry is byte-identical to canonical");

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"forge-phase2f-")),forgeDir=path.join(tmp,"forge");fs.mkdirSync(forgeDir);
const oldGeo=fs.readFileSync(path.join(root,"tests","fixtures","tactics-geometry-phase2e.js"),"utf8");
fs.writeFileSync(path.join(forgeDir,"tactics-geometry.js"),canon+"\n");
fs.writeFileSync(path.join(forgeDir,"topography-test-mock.html"),html);
fs.writeFileSync(path.join(forgeDir,"battle-tactics-geo-mock.html"),"<script>"+oldGeo+"</script>");
const patched=patcher.patchFiles({forgeDir});
ok(patched.changed.length===1,"guarded Phase 2f patcher updates the Phase 2e reference geometry only");
eq(patcher.inlineGeometry(fs.readFileSync(path.join(forgeDir,"battle-tactics-geo-mock.html"),"utf8")).source.trim(),canon,"patcher synchronizes bridge-aware geometry exactly");
fs.writeFileSync(path.join(forgeDir,"battle-tactics-geo-mock.html"),"<script>"+oldGeo.replace("var STEP_FT   = 5","var STEP_FT   = 6")+"</script>");
let patchError=null;try{patcher.patchFiles({forgeDir});}catch(e){patchError=e;}
ok(patchError&&/unknown geometry copy/.test(patchError.message),"patcher refuses an unknown edited geometry copy");
console.log("\n"+pass+" Phase 2f bridge/damage checks green");
