#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm");
const root=path.resolve(__dirname,"..");
const GF=require(path.join(root,"forge-generator-foundation.js"));
const engineSource=fs.readFileSync(path.join(root,"forge-engine.js"),"utf8");
const html=fs.readFileSync(path.join(root,"topography-test-mock.html"),"utf8");
const spec=fs.readFileSync(path.join(root,"FORGE_PARAMETER_RECORD_1.md"),"utf8");
let pass=0;
function ok(v,l){if(!v)throw new Error("FAIL: "+l);console.log("ok",++pass,"-",l);}
function throws(fn,part,l){let e=null;try{fn();}catch(x){e=x;}ok(e&&String(e.message||e).includes(part),l);}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}

ok(GF.GENERATOR_VERSION==="2.0.0-params.1","generator version marks the parameter-record slice");
ok(GF.PARAMETER_SCHEMA==="forge-map-parameters"&&GF.PARAMETER_VERSION===1,"parameter records have an explicit schema and version");
ok(GF.ARCHETYPE_DEFINITIONS.length===GF.ARCHETYPES.length&&GF.ARCHETYPES.includes("bridge-crossing"),"selector vocabulary and saved archetype keys share one canonical list");
ok(GF.ARCHETYPE_DEFINITIONS.filter(d=>d.status==="active").map(d=>d.key).join(",")==="legacy-dungeon","only the legacy grammar claims to be active in this slice");
ok(spec.includes('Schema: `forge-map-parameters`')&&spec.includes('Version: `1`'),"companion document freezes the schema identity");
ok(spec.includes('mapSnapshot` is the authoritative battlefield'),"parameter documentation preserves snapshot authority");
ok(spec.includes('archetype: "canyon"')&&spec.includes('generatorProfile: "legacy-dungeon"'),"documentation distinguishes requested archetype from actual grammar");
ok(spec.includes('Phase 2d makes `layout`, `height`, `semantics`, `decor`, and `foes` consume their named stage seeds'),"documentation pins the next stage-ownership migration");

const legacy={seed:42,theme:"temple",archetype:"canyon",stageSeeds:{decor:1234},sliders:{
  roomCount:11,loopChance:.35,decorDensity:.55,heightMode:"tiered",verticality:5,party:3,foes:7,poolBlocks:true,waterBlocks:false,retries:31
}};
const record=GF.parameterRecord(legacy);
ok(record.schema===GF.PARAMETER_SCHEMA&&record.version===1&&record.archetype==="canyon","legacy UI inputs normalize into a versioned archetype record");
ok(record.generatorProfile==="legacy-dungeon","record distinguishes requested archetype from the currently active grammar");
ok(record.stages.layout.roomCount===11&&record.stages.layout.loopChance===.35&&record.stages.decor.density===.55,"layout and decor knobs live in named stage records");
ok(record.stages.height.verticalityFt===5&&record.stages.foes.party===3&&record.stages.foes.count===7,"height and encounter counts live in named stage records");
ok(record.stageSeeds.decor===1234&&record.stageSeeds.layout===GF.stageSeeds(42).layout,"explicit stage overrides coexist with deterministic derived seeds");
ok(record.rules.poolBlocks===true&&record.rules.waterBlocks===false&&record.runtime.retries===31,"rules and runtime controls are versioned instead of hiding in sliders");

const clamped=GF.parameterRecord({seed:1,sliders:{roomCount:999,loopChance:-4,decorDensity:8,verticality:0,party:0,foes:999,retries:0}});
ok(clamped.stages.layout.roomCount===64&&clamped.stages.layout.loopChance===0&&clamped.stages.decor.density===1,"numeric parameter records normalize to safe canonical bounds");
ok(clamped.stages.height.verticalityFt===.5&&clamped.stages.foes.party===1&&clamped.stages.foes.count===64&&clamped.runtime.retries===1,"height, roster, and retry bounds are canonical");
throws(()=>GF.parameterRecord({schema:GF.PARAMETER_SCHEMA,version:2}),"unsupported parameter record version","future direct parameter versions stop loudly");
throws(()=>GF.parameterRecord({parameters:{schema:GF.PARAMETER_SCHEMA,version:2}}),"unsupported parameter record version","future nested parameter versions stop loudly");
throws(()=>GF.parameterRecord({archetype:"not-a-map"}),"unknown archetype","unknown archetypes are refused rather than silently mapped");

const normalized=GF.normalizeParams(legacy);
ok(normalized.parameters.schema===GF.PARAMETER_SCHEMA&&normalized.archetype==="canyon","normalized parameters carry both the canonical record and compatibility fields");
ok(normalized.sliders.roomCount===11&&normalized.sliders.foes===7&&normalized.stageSeeds.decor===1234,"legacy slider consumers receive values projected from the canonical record");

const map={cols:2,rows:1,h:[0,5],wall:[false,false],occ:[0,0],coverShape:[null,null],spawns:[{c:0,r:0,side:"pc"},{c:1,r:0,side:"foe"}],props:[],meta:{}};
const envelope=GF.encounterEnvelope(map,normalized,null);
ok(envelope.parameterSchema===GF.PARAMETER_SCHEMA&&envelope.parameterVersion===1&&envelope.parameters.archetype==="canyon","session envelopes persist the complete parameter record");
ok(envelope.seed===42&&envelope.theme==="temple"&&envelope.sliders.roomCount===11,"session envelopes retain the old top-level shape for existing readers");
const staleTop=JSON.parse(JSON.stringify(envelope));
staleTop.seed=999;staleTop.theme="grass";staleTop.archetype="basin";staleTop.sliders.roomCount=4;
const authoritativeRecipe=GF.recipeParams(staleTop);
ok(authoritativeRecipe.seed===42&&authoritativeRecipe.themeKey==="temple"&&authoritativeRecipe.archetype==="canyon"&&authoritativeRecipe.roomCount===11,"the versioned record, not stale compatibility fields, owns recipe reads");
const migrated=GF.recipeParams({seed:9,theme:"swamp",archetype:"ridge",sliders:{roomCount:6,foes:2}});
ok(migrated.parameters.version===1&&migrated.seed===9&&migrated.archetype==="ridge"&&migrated.roomCount===6,"old envelopes migrate in memory without a database migration");
const attached=GF.attachMeta(map,{seed:3,archetype:"ring",sliders:{party:1,foes:1}},null);
ok(attached.meta.archetype==="ring"&&attached.meta.generatorProfile==="legacy-dungeon"&&attached.meta.parameterVersion===1,"map metadata records requested archetype and actual generator profile honestly");

let calls=[];
const FD={THEME_KEYS:["grass","temple"],generateDungeon(opts){calls.push({...opts});return {valid:true,seed:opts.seed,name:"Stub",W:3,H:1,maxDepth:1,
  grid:[1,1,1],roomId:[0,-1,1],rooms:[{id:0,type:"entrance",cx:0,cy:0,depth:0},{id:1,type:"boss",cx:2,cy:0,depth:1}],
  edges:[{a:0,b:1,isCritical:true}],spawns:[{x:2,y:0,roomId:1,tier:0}],boss:1,props:[]};}};
const MB={CELL:{FLOOR:1,POOL:2,WALL:3,VOID:0},dungeonToMap(){return {cols:3,rows:1,h:[0,0,0],wall:[false,false,false],occ:[0,0,0],props:[],spawns:[],meta:{}};},
  validate(m){return {ok:!!m&&m.h.length===m.cols*m.rows&&m.wall.length===m.cols*m.rows};}};
const sandbox={module:{exports:{}},exports:{},require(id){if(id==="./forge-dungeon.js")return FD;if(id==="./map-bridge.js")return MB;if(id==="./forge-generator-foundation.js")return GF;throw new Error(id);},
  console,Math,Set,Float32Array,Number,Object,Array,Error};
vm.runInNewContext(engineSource,sandbox,{filename:"forge-engine.js"});
const Engine=sandbox.module.exports;
const direct=GF.parameterRecord({seed:77,theme:"temple",archetype:"bridge-crossing",sliders:{roomCount:10,loopChance:.4,decorDensity:.25,party:1,foes:1,retries:1}});
const built=Engine.generate(direct);
ok(calls[0].seed===77&&calls[0].themeKey==="temple"&&calls[0].roomCount===10&&calls[0].loopChance===.4,"engine accepts a parameter record directly and projects current generator inputs");
ok(built.meta.archetype==="bridge-crossing"&&built.meta.generatorProfile==="legacy-dungeon"&&built.meta.parameterVersion===1,"engine output preserves requested archetype without claiming the grammar implemented it");
const legacyBuilt=Engine.generate(GF.parameterRecord({seed:77,theme:"temple",archetype:"legacy-dungeon",sliders:{roomCount:10,loopChance:.4,decorDensity:.25,party:1,foes:1,retries:1}}));
ok(same(built.h,legacyBuilt.h)&&same(built.wall,legacyBuilt.wall)&&same(built.spawns,legacyBuilt.spawns),"record-only archetypes do not secretly change geometry before stage ownership");

ok(html.includes('id="archetype" aria-describedby="archetypeNote"'),"Forge panel exposes an archetype selector");
ok(html.includes("gf.ARCHETYPE_DEFINITIONS")&&html.includes("— recorded"),"selector is generated from the canonical definitions and labels inactive grammars honestly");
ok(html.includes("return gf&&typeof gf.normalizeParams==='function'?gf.normalizeParams(legacy):legacy"),"Forge saves normalized versioned parameters rather than hand-built metadata");
ok(html.includes("window.ForgeGeneratorFoundation.recipeParams(row.map||{})"),"legacy session recipe fallback reads the versioned record");
ok(html.includes("if(hasSavedSnapshot)")&&html.includes("future parameter version merely to repaint an already-saved map"),"saved snapshots load without requiring recipe interpretation");
ok(html.includes("window.__forgeArchetype.paint(savedArchetype,true)"),"shared-session UI displays the archetype saved with the fight");
ok(html.includes('["archetype","rooms","loops","decor","foes","seed"'),"shared sessions lock the archetype with the rest of the map recipe");
ok(html.includes('w.querySelector("input,select")')&&html.includes('["archetype","rooms","loops","decor","foes"]'),"non-overseer devices hide the DM-only archetype control");
ok(html.includes("m.parameters && m.parameters.archetype")&&html.includes("adef.label"),"staged fights identify their saved archetype");
ok(html.includes("forge-generator-foundation.js?v=g2p1")&&html.includes("forge-engine.js?v=fe3"),"parameter runtime modules are cache-busted");

const scripts=[...html.matchAll(/<script(?:\s+type="([^"]+)")?[^>]*>([\s\S]*?)<\/script>/g)]
  .filter(m=>!m[0].includes('type="importmap"')&&m[2].trim());
ok(scripts.length===3,"production HTML still has three executable inline scripts");
scripts.forEach((m,i)=>{let code=m[2];if(m[1]==='module')code=code.replace(/^import .*;$/mg,'');new vm.Script(code,{filename:'inline-'+i+'.js'});});
ok(true,"all executable inline scripts parse after the selector integration");

console.log("\n"+pass+" Phase 2c archetype/parameter checks green");
