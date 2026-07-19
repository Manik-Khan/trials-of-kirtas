#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm");
const root=path.resolve(__dirname,"..");
const GF=require(path.join(root,"forge-generator-foundation.js"));
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const spec=fs.readFileSync(path.join(root,"FORGE_PARAMETER_RECORD_2.md"),"utf8");
let pass=0;
function ok(v,l){if(!v)throw new Error("FAIL: "+l);console.log("ok",++pass,"-",l);}
function throws(fn,part,l){let e=null;try{fn();}catch(x){e=x;}ok(e&&String(e.message||e).includes(part),l);}

ok(GF.PARAMETER_SCHEMA==="forge-map-parameters"&&GF.PARAMETER_VERSION===2,"parameter records retain an explicit schema and advance canonically to version 2");
ok(GF.SUPPORTED_PARAMETER_VERSIONS.join(",")==="1,2","version-1 recipes remain readable after stage ownership");
ok(GF.ARCHETYPE_DEFINITIONS.length===GF.ARCHETYPES.length&&GF.ARCHETYPES.includes("bridge-crossing"),"selector vocabulary and saved archetype keys share one canonical list");
ok(GF.ARCHETYPE_DEFINITIONS.filter(d=>d.status==="active").map(d=>d.key).join(",")==="legacy-dungeon","only the legacy room grammar claims to be implemented");
ok(spec.includes('Schema: `forge-map-parameters`')&&spec.includes('Version: `2`'),"companion document freezes the current schema identity");
ok(spec.includes('`mapSnapshot` remains the authoritative battlefield'),"parameter documentation preserves snapshot authority");
ok(spec.includes('archetype: "canyon"')&&spec.includes('generatorProfile: "stage-owned-legacy"'),"documentation distinguishes requested archetype from actual generator profile");
ok(spec.includes('version-1 records migrate in memory')&&spec.includes('legacy-dungeon'),"documentation freezes legacy recipe migration");

const legacy={seed:42,theme:"temple",archetype:"canyon",stageSeeds:{decor:1234},sliders:{
  roomCount:11,loopChance:.35,decorDensity:.55,heightMode:"tiered",verticality:5,party:3,foes:7,poolBlocks:true,waterBlocks:false,retries:31
}};
const record=GF.parameterRecord(legacy);
ok(record.schema===GF.PARAMETER_SCHEMA&&record.version===2&&record.archetype==="canyon","legacy-shaped authoring inputs normalize into the canonical record");
ok(record.generatorProfile===GF.GENERATOR_PROFILES.STAGED,"new authoring inputs opt into the staged legacy profile");
ok(GF.GENERATOR_VERSION==="2.1.0-temple.1","generator version names the first intentional archetype");
ok(GF.GENERATOR_PROFILES.INTENTIONAL==="intentional-archetype","foundation exports the intentional archetype profile");
const templeDef=GF.archetypeDefinition("temple-terraces");
ok(templeDef.status==="preview","Temple Terraces is honestly preview-ready rather than record-only or combat-ready");
const templeFresh=GF.parameterRecord({seed:81,theme:"temple",archetype:"temple-terraces"});
ok(templeFresh.generatorProfile===GF.GENERATOR_PROFILES.INTENTIONAL,"new Temple authoring selects the intentional profile");
const oldTemple=GF.parameterRecord({schema:GF.PARAMETER_SCHEMA,version:2,seed:81,theme:"temple",archetype:"temple-terraces",generatorProfile:GF.GENERATOR_PROFILES.STAGED,stages:templeFresh.stages,rules:templeFresh.rules,runtime:templeFresh.runtime});
ok(oldTemple.generatorProfile===GF.GENERATOR_PROFILES.STAGED,"an existing explicit Temple recipe keeps its historical staged-legacy grammar");
ok(record.stages.layout.roomCount===11&&record.stages.layout.loopChance===.35&&record.stages.decor.density===.55,"layout and decor knobs live in named stage records");
ok(record.stages.height.verticalityFt===5&&record.stages.foes.party===3&&record.stages.foes.count===7,"height and encounter counts live in named stage records");
ok(record.stageSeeds.decor===1234&&record.stageSeeds.layout===GF.stageSeeds(42).layout,"explicit stage overrides coexist with deterministic derived seeds");
ok(record.rules.poolBlocks===true&&record.rules.waterBlocks===false&&record.runtime.retries===31,"rules and runtime controls remain versioned instead of hiding in sliders");

const clamped=GF.parameterRecord({seed:1,sliders:{roomCount:999,loopChance:-4,decorDensity:8,verticality:0,party:0,foes:999,retries:0}});
ok(clamped.stages.layout.roomCount===64&&clamped.stages.layout.loopChance===0&&clamped.stages.decor.density===1,"numeric parameter records normalize to safe canonical bounds");
ok(clamped.stages.height.verticalityFt===.5&&clamped.stages.foes.party===1&&clamped.stages.foes.count===64&&clamped.runtime.retries===1,"height, roster, and retry bounds remain canonical");
throws(()=>GF.parameterRecord({schema:GF.PARAMETER_SCHEMA,version:3}),"unsupported parameter record version","future direct parameter versions stop loudly");
throws(()=>GF.parameterRecord({parameters:{schema:GF.PARAMETER_SCHEMA,version:3}}),"unsupported parameter record version","future nested parameter versions stop loudly");
throws(()=>GF.parameterRecord({archetype:"not-a-map"}),"unknown archetype","unknown archetypes are refused rather than silently mapped");

const old={schema:GF.PARAMETER_SCHEMA,version:1,seed:9,theme:"swamp",archetype:"ridge",stageSeeds:GF.stageSeeds(9),stages:record.stages,rules:record.rules,runtime:record.runtime};
const migrated=GF.parameterRecord(old);
ok(migrated.version===2&&migrated.seed===9&&migrated.archetype==="ridge","version-1 records migrate in memory to the canonical shape");
ok(migrated.generatorProfile===GF.GENERATOR_PROFILES.LEGACY,"version-1 snapshot-less recipes preserve monolithic regeneration by default");
const explicitOld=GF.parameterRecord({...old,generatorProfile:GF.GENERATOR_PROFILES.STAGED});
ok(explicitOld.generatorProfile===GF.GENERATOR_PROFILES.STAGED,"an explicit legacy-record profile is never overwritten");

const normalized=GF.normalizeParams(legacy);
ok(normalized.parameters.schema===GF.PARAMETER_SCHEMA&&normalized.parameters.version===2&&normalized.archetype==="canyon","normalized parameters carry both canonical and compatibility shapes");
ok(normalized.sliders.roomCount===11&&normalized.sliders.foes===7&&normalized.stageSeeds.decor===1234,"legacy slider consumers receive values projected from the canonical record");

const map={cols:2,rows:1,h:[0,5],wall:[false,false],occ:[0,0],coverShape:[null,null],spawns:[{c:0,r:0,side:"pc"},{c:1,r:0,side:"foe"}],props:[],meta:{}};
const envelope=GF.encounterEnvelope(map,normalized,null);
ok(envelope.parameterSchema===GF.PARAMETER_SCHEMA&&envelope.parameterVersion===2&&envelope.parameters.archetype==="canyon","session envelopes persist the complete current parameter record");
ok(envelope.seed===42&&envelope.theme==="temple"&&envelope.sliders.roomCount===11,"session envelopes retain the old top-level shape for existing readers");
const staleTop=JSON.parse(JSON.stringify(envelope));
staleTop.seed=999;staleTop.theme="grass";staleTop.archetype="basin";staleTop.sliders.roomCount=4;
const authoritativeRecipe=GF.recipeParams(staleTop);
ok(authoritativeRecipe.seed===42&&authoritativeRecipe.themeKey==="temple"&&authoritativeRecipe.archetype==="canyon"&&authoritativeRecipe.roomCount===11,"the versioned record, not stale compatibility fields, owns recipe reads");
const oldRecipe=GF.recipeParams({parameters:old});
ok(oldRecipe.parameters.version===2&&oldRecipe.generatorProfile===GF.GENERATOR_PROFILES.LEGACY,"old envelopes migrate without a database migration and retain legacy profile");
const attached=GF.attachMeta(map,{seed:3,archetype:"ring",sliders:{party:1,foes:1}},null);
ok(attached.meta.archetype==="ring"&&attached.meta.generatorProfile===GF.GENERATOR_PROFILES.STAGED&&attached.meta.parameterVersion===2,"map metadata records requested archetype and actual generator profile honestly");

ok(html.includes('id="archetype" aria-describedby="archetypeNote"'),"Forge panel exposes an archetype selector");
ok(html.includes("gf.ARCHETYPE_DEFINITIONS")&&html.includes("— recorded"),"selector comes from canonical definitions and labels unimplemented grammars honestly");
ok(html.includes("return gf&&typeof gf.normalizeParams==='function'?gf.normalizeParams(legacy):legacy"),"Forge saves normalized versioned parameters rather than hand-built metadata");
ok(html.includes("window.ForgeGeneratorFoundation.recipeParams(row.map||{})"),"legacy session recipe fallback reads the versioned record");
ok(html.includes("if(hasSavedSnapshot)")&&html.includes("future parameter version merely to repaint an already-saved map"),"saved snapshots load without requiring future recipe interpretation");
ok(html.includes("window.__forgeArchetype.paint(savedArchetype,true)"),"shared-session UI displays the archetype saved with the fight");
ok(html.includes('["archetype","rooms","loops","decor","foes","seed"'),"shared sessions lock the archetype with the rest of the map recipe");
ok(html.includes('w.querySelector("input,select")')&&html.includes('["archetype","rooms","loops","decor","foes"]'),"non-overseer devices hide the DM-only archetype control");
ok(html.includes("m.parameters && m.parameters.archetype")&&html.includes("adef.label"),"staged fights identify their saved archetype");
ok(/forge-generator-foundation\.js\?v=g2g1/.test(html)&&/forge-engine\.js\?v=fe10/.test(html),"current parameter and engine runtimes are cache-busted");

const scripts=[...html.matchAll(/<script(?:\s+type="([^"]+)")?[^>]*>([\s\S]*?)<\/script>/g)]
  .filter(m=>!m[0].includes('type="importmap"')&&m[2].trim());
ok(scripts.length===3,"production HTML still has three executable inline scripts");
scripts.forEach((m,i)=>{let code=m[2];if(m[1]==='module')code=code.replace(/^import .*;$/mg,'');new vm.Script(code,{filename:'inline-'+i+'.js'});});
ok(true,"all executable inline scripts parse after parameter-version migration");
console.log("\n"+pass+" Phase 2c archetype/parameter regression checks green");
