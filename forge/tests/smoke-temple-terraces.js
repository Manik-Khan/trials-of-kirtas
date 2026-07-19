#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const GF=require(path.join(root,"forge-generator-foundation.js"));
const MB=require(path.join(root,"map-bridge.js"));
const TT=require(path.join(root,"forge-temple-terraces.js"));
const Engine=require(path.join(root,"forge-engine.js"));
let pass=0;
function ok(name,value){if(!value)throw new Error("FAIL: "+name);pass++;console.log("ok",pass,"-",name);}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function options(seed,theme){const s=GF.stageSeeds(seed);return{layoutSeed:s.layout,heightSeed:s.height,semanticsSeed:s.semantics,decorSeed:s.decor,themeKey:theme||"temple",roomCount:8,decorDensity:.7};}

ok("Temple module is dual-exported",typeof TT.generate==="function"&&typeof TT.validateScene==="function");
const a=TT.generate(options(81,"temple"));
const replay=TT.generate(options(81,"temple"));
ok("Temple scene is deterministic",same(a,replay));
ok("Temple scene has no generated combatant positions",Array.isArray(a.dungeon.spawns)&&a.dungeon.spawns.length===0);
ok("Temple intent names the archetype",a.intent&&a.intent.version===1&&a.intent.archetype==="temple-terraces");
ok("Temple variant is canonical",["axial","switchback","ring"].includes(a.intent.variant));
ok("Temple has approach and summit regions",a.intent.regions.some(r=>r.id==="approach")&&a.intent.regions.some(r=>r.id==="summit-sanctuary"));
ok("Temple has a required primary ascent",a.intent.routes.some(r=>r.role==="primary-ascent"&&r.required));
ok("Temple publishes a canonical construction profile",a.constructionProfile==="temple-masonry");
ok("Temple validator accepts the real scene",TT.validateScene(a).ok);

const variants=[5,1,2].map(seed=>TT.generate(options(seed,"temple")).intent.variant);
ok("known roots cover all Temple variants",variants.join(",")==="axial,switchback,ring");
ok("every Temple region is a broad usable platform",a.intent.regions.every(r=>r.cells.length>=16));
ok("Temple platform bands stay within the established grid",a.intent.regions.map(r=>r.elevationFt).join(",")==="0,5,10,15"&&Math.max(...a.h)<=15);
const stairs=a.connectors.filter(c=>c.kind==="stairs");
ok("every Temple connector is purposeful",stairs.length>0&&stairs.every(c=>c.source==="archetype-intent"&&c.purpose&&c.purpose.routeId));
ok("stair paths are architectural runs",stairs.every(c=>c.path.length>=3));
ok("connector IDs are declared by routes",stairs.every(c=>a.intent.routes.some(r=>r.connectorIds.includes(c.id))));
ok("Temple does not generate bridges",!a.connectors.some(c=>c.kind==="bridge"));
ok("construction follows the selected environment",TT.constructionProfile("volcanic")==="volcanic-basalt"&&TT.constructionProfile("druidic")==="druidic-overgrown-stone");

function detail(overrides){
  const seeds=Object.assign(GF.stageSeeds(81),overrides||{});
  const params=GF.normalizeParams({seed:81,theme:"temple",archetype:"temple-terraces",stageSeeds:seeds,sliders:{roomCount:8,decorDensity:.7,party:4,foes:5}});
  return Engine.generateDetailed(params);
}
const engineScene=detail();
ok("engine routes Temple through intentional profile",engineScene.parameters.generatorProfile===GF.GENERATOR_PROFILES.INTENTIONAL);
ok("engine returns Temple intent",engineScene.map.meta.intent&&engineScene.map.meta.intent.archetype==="temple-terraces");
ok("intentional preview does not invent spawns",engineScene.map.spawns.length===0);
ok("engine publishes all five stage fingerprints",Object.keys(engineScene.stageFingerprints).sort().join(",")==="decor,foes,height,layout,semantics");
const unresolvedFoes=GF.hash32(JSON.stringify("deployment-unresolved")).toString(16).padStart(8,"0");
ok("foes fingerprint records unresolved deployment",engineScene.stageFingerprints.foes===unresolvedFoes);

const baseSeeds=GF.stageSeeds(81);
const layoutScene=detail({layout:baseSeeds.layout+1});
ok("layout seed owns Temple variant without changing construction",layoutScene.stageFingerprints.layout!==engineScene.stageFingerprints.layout&&layoutScene.map.meta.constructionProfile===engineScene.map.meta.constructionProfile);
const heightScene=detail({height:baseSeeds.height+1});
ok("height seed changes only Temple height records",heightScene.stageFingerprints.height!==engineScene.stageFingerprints.height&&heightScene.stageFingerprints.layout===engineScene.stageFingerprints.layout&&heightScene.stageFingerprints.semantics===engineScene.stageFingerprints.semantics&&heightScene.stageFingerprints.decor===engineScene.stageFingerprints.decor&&heightScene.stageFingerprints.foes===engineScene.stageFingerprints.foes);
const semanticsScene=detail({semantics:baseSeeds.semantics+1});
ok("semantics seed changes annotations without geometry",semanticsScene.stageFingerprints.semantics!==engineScene.stageFingerprints.semantics&&semanticsScene.stageFingerprints.layout===engineScene.stageFingerprints.layout&&semanticsScene.stageFingerprints.height===engineScene.stageFingerprints.height&&semanticsScene.stageFingerprints.decor===engineScene.stageFingerprints.decor);
const decorScene=detail({decor:baseSeeds.decor+1});
ok("decor seed changes props only",decorScene.stageFingerprints.decor!==engineScene.stageFingerprints.decor&&decorScene.stageFingerprints.layout===engineScene.stageFingerprints.layout&&decorScene.stageFingerprints.height===engineScene.stageFingerprints.height&&decorScene.stageFingerprints.semantics===engineScene.stageFingerprints.semantics);
const foesScene=detail({foes:baseSeeds.foes+1});
ok("foes seed cannot place units before deployment",same(foesScene.stageFingerprints,engineScene.stageFingerprints)&&foesScene.map.spawns.length===0);
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
ok("production loads the Temple module before the engine",html.indexOf("forge-temple-terraces.js?v=tt1")>=0&&html.indexOf("forge-temple-terraces.js?v=tt1")<html.indexOf("forge-engine.js?v=fe9"));
ok("stair renderer consumes the complete connector path",html.includes("function stairConnectorPath")&&html.includes("for(let segment=0;segment<path.length-1;segment++)"));
ok("connector rendering consumes saved construction profiles",html.includes("connectorConstructionMaterial")&&html.includes("constructionProfile"));
ok("Vertical Geometry reports route purpose",html.includes("purposeLabel")&&html.includes("primary ascent"));
ok("Temple selector labels preview honestly",html.includes("def.status==='preview'"));
ok("Temple preview exposes a deployment guard",html.includes("function templeDeploymentPending"));
ok("local start refuses automatic Temple placement",html.includes("Temple Terraces needs DM deployment flags before combat can start."));
ok("shared table creation refuses unresolved Temple deployment",html.includes("Place deployment groups before opening or saving this Temple battlefield."));
console.log("\n"+pass+" Temple Terraces checks green");
