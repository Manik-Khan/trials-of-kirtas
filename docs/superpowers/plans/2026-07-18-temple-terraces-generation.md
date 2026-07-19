# Temple Terraces Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first intent-owned Forge archetype: deterministic Temple Terraces scenes with broad architectural tiers, purposeful stair routes, biome construction profiles, semantic validation, and no automatic combatant placement.

**Architecture:** Add a focused pure-data `ForgeTempleTerraces` module that produces a dungeon-shaped render document plus authoritative height, connector, ledge, intent, and construction records. `ForgeEngine` selects it only for the new `intentional-archetype` generator profile, validates the scene without inventing spawns, and preserves the established five-stage fingerprints. The canonical Forge surface renders the same records and exposes Temple as preview-only until the separate deployment-group plan supplies DM flags and unlocks encounter creation.

**Tech Stack:** Vanilla JavaScript, browser globals plus CommonJS dual exports, typed arrays, existing `ForgeGeneratorFoundation`, `MapBridge`, `ForgeEngine`, three.js r185, Node smoke harnesses.

## Global Constraints

- Keep the canonical product surface at `forge/index.html`; do not revive a historical mock as a second implementation.
- Preserve saved `mapSnapshot` authority and version-1/version-2 recipe compatibility.
- Use the existing 5-ft tactical grid and the established 0–15-ft generated elevation bound.
- Temple platform regions use 0/5/10/15-ft bands; stair-path cells may use finite intermediate elevations such as 2.5 or 7.5 ft.
- Temple generation produces `spawns: []`; generated suggestions are not combatant positions.
- Do not enable Roll Initiative or local combat for Temple until DM deployment groups are implemented.
- Legacy generated maps retain only connectivity-required steep stairs/ramps; remove decorative 5-ft samples and generic production bridges.
- Existing saved and explicitly authored bridge records remain valid and mechanically unchanged.
- Every runtime module changed or added receives a bumped `?v=` include in `forge/index.html`.
- Run `node --check` on every changed or created `.js` file.
- Run focused real-generator smokes plus the Forge regression battery before claiming completion.
- Do not modify `theme.css` variables.
- Do not commit or push unless M explicitly requests it; task-end commit commands below are handoff commands for M, not authorization for Codex to execute them.

---

## File structure

### Create

- `forge/forge-temple-terraces.js` — pure Temple layout, height, route, connector, style, validation, and local-repair authority; dual browser/Node export.
- `forge/tests/smoke-temple-terraces.js` — real known-answer tests for variants, intent, routes, stage isolation, snapshot survival, and absence of generated spawns.
- `forge/FORGE_TEMPLE_TERRACES_1.md` — runtime contract distilled from the approved design specification.

### Modify

- `forge/forge-generator-foundation.js` — activate the intentional profile vocabulary, mark Temple preview-ready, bump generator version, and preserve old explicit profiles.
- `forge/forge-engine.js` — load the Temple module, route intentional generation, validate scenes without spawns, publish fingerprints/meta, and stop generic decorative connector production.
- `forge/index.html` — load/cache-bust the module, render multi-segment stairs with saved construction profiles, display connector purpose, label Temple preview honestly, and block combat/session creation until deployment exists.
- `forge/tests/smoke-phase2c-archetype-params.js` — freeze intentional-profile selection and old recipe compatibility.
- `forge/tests/smoke-phase2d-stage-ownership.js` — freeze Temple stage isolation and keep nonimplemented archetypes on staged legacy.
- `forge/tests/smoke-phase2e-elevations-connectors.js` — accept the new generator version and prove legacy no longer emits decorative gentle connectors.
- `forge/tests/smoke-phase2f4-bridge-completion.js` — preserve synthetic bridge authority while changing the real-generator expectation to “no purposeless legacy bridge.”
- `forge/tests/smoke-snapshot-authority.js` — freeze Temple intent and style survival through the real snapshot path.
- `forge/tests/smoke-unified-forge-panel.js` — freeze honest preview labeling and encounter gating.
- `forge/README.md` — document the Temple module and preview boundary.
- `CONTEXT_Forge.md` — record the first intentional archetype and the deployment dependency.
- `docs/handoffs/forge/CONTEXT_Forge-update-2026-07-18.md` — create the next concise Forge authority and supersede the July 16c execution order without rewriting the historical file.

---

### Task 1: Versioned intentional-archetype profile

**Files:**
- Modify: `forge/forge-generator-foundation.js:19-43, 102-126, 418-490, 690-725`
- Modify: `forge/tests/smoke-phase2c-archetype-params.js`

**Interfaces:**
- Consumes: existing `parameterRecord(input)`, `assertGeneratorProfile(value)`, and `archetypeDefinition(key)`.
- Produces: `GENERATOR_PROFILES.INTENTIONAL === "intentional-archetype"`; generator version `2.1.0-temple.1`; Temple definition status `preview`; new unversioned Temple inputs select the intentional profile while saved records with an explicit old profile retain it.

- [ ] **Step 1: Add failing profile assertions**

Add these assertions to `smoke-phase2c-archetype-params.js` after the current profile checks:

```js
ok(GF.GENERATOR_VERSION==="2.1.0-temple.1","generator version names the first intentional archetype");
ok(GF.GENERATOR_PROFILES.INTENTIONAL==="intentional-archetype","foundation exports the intentional archetype profile");
const templeDef=GF.archetypeDefinition("temple-terraces");
ok(templeDef.status==="preview","Temple Terraces is honestly preview-ready rather than record-only or combat-ready");
const templeFresh=GF.parameterRecord({seed:81,theme:"temple",archetype:"temple-terraces"});
ok(templeFresh.generatorProfile===GF.GENERATOR_PROFILES.INTENTIONAL,"new Temple authoring selects the intentional profile");
const oldTemple=GF.parameterRecord({schema:GF.PARAMETER_SCHEMA,version:2,seed:81,theme:"temple",archetype:"temple-terraces",generatorProfile:GF.GENERATOR_PROFILES.STAGED,stages:templeFresh.stages,rules:templeFresh.rules,runtime:templeFresh.runtime});
ok(oldTemple.generatorProfile===GF.GENERATOR_PROFILES.STAGED,"an existing explicit Temple recipe keeps its historical staged-legacy grammar");
```

- [ ] **Step 2: Run the smoke and verify the red state**

Run:

```bash
node forge/tests/smoke-phase2c-archetype-params.js
```

Expected: FAIL because `INTENTIONAL` is undefined, Temple remains `record-only`, and the generator version is still `2.0.0-bridges.2`.

- [ ] **Step 3: Add the profile and version rules**

Make these exact changes in `forge-generator-foundation.js`:

```js
var GENERATOR_VERSION = "2.1.0-temple.1";
var GENERATOR_PROFILES = Object.freeze({
  LEGACY: "legacy-dungeon",
  STAGED: "stage-owned-legacy",
  INTENTIONAL: "intentional-archetype"
});
```

Change the Temple definition to:

```js
Object.freeze({
  key: "temple-terraces",
  label: "Temple terraces",
  status: "preview",
  summary: "Purpose-built tiered temple platforms with authored stair routes; deployment flags are required before combat."
})
```

Extend `assertGeneratorProfile` to accept all three exported profile values. In `parameterRecord`, calculate `archetype` before the default profile and use:

```js
var defaultProfile = archetype === "temple-terraces"
  ? GENERATOR_PROFILES.INTENTIONAL
  : GENERATOR_PROFILES.STAGED;
var profile = assertGeneratorProfile(
  source.generatorProfile != null ? source.generatorProfile :
    (input.generatorProfile != null ? input.generatorProfile :
      (sourceVersion === 1 ? GENERATOR_PROFILES.LEGACY : defaultProfile))
);
```

This preserves explicit old records and routes only fresh Temple authoring into the new grammar.

- [ ] **Step 4: Verify profile behavior and syntax**

Run:

```bash
node --check forge/forge-generator-foundation.js
node --check forge/tests/smoke-phase2c-archetype-params.js
node forge/tests/smoke-phase2c-archetype-params.js
```

Expected: all checks pass and the smoke ends with `Phase 2c archetype/parameter regression checks green`.

- [ ] **Step 5: Review checkpoint and named-file handoff**

Review:

```bash
git diff -- forge/forge-generator-foundation.js forge/tests/smoke-phase2c-archetype-params.js
```

If M requests a commit, stage only those two files and use:

```bash
git add forge/forge-generator-foundation.js forge/tests/smoke-phase2c-archetype-params.js
git commit -m "feat: add intentional Forge archetype profile"
```

---

### Task 2: Pure Temple layout, variants, and intent records

**Files:**
- Create: `forge/forge-temple-terraces.js`
- Create: `forge/tests/smoke-temple-terraces.js`

**Interfaces:**
- Consumes: `ForgeGeneratorFoundation.hash32`, `deriveSeed`, and clone semantics; `MapBridge.CELL` constants.
- Produces: `ForgeTempleTerraces.generate(options)` returning `{ dungeon, h, connectors, ledges, intent, constructionProfile }`; `constructionProfile(themeKey)`; `validateScene(scene)`; `_internals.layoutTemple`, `_internals.buildStair`, and `_internals.localRepair`.

The `options` record is:

```js
{
  layoutSeed: Number,
  heightSeed: Number,
  semanticsSeed: Number,
  decorSeed: Number,
  themeKey: "grass" | "druidic" | "tundra" | "swamp" | "temple" | "cavern" | "volcanic",
  roomCount: Number,
  decorDensity: Number
}
```

- [ ] **Step 1: Create the failing real-module smoke**

Create `forge/tests/smoke-temple-terraces.js` with a minimal harness that requires the real modules and fails before the Temple module exists:

```js
#!/usr/bin/env node
"use strict";
const path=require("path");
const root=path.resolve(__dirname,"..");
const GF=require(path.join(root,"forge-generator-foundation.js"));
const MB=require(path.join(root,"map-bridge.js"));
const TT=require(path.join(root,"forge-temple-terraces.js"));
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
console.log("\n"+pass+" Temple Terraces checks green");
```

- [ ] **Step 2: Run the smoke and verify module absence**

Run:

```bash
node forge/tests/smoke-temple-terraces.js
```

Expected: FAIL with `Cannot find module '../forge-temple-terraces.js'`.

- [ ] **Step 3: Create the dual-export module and deterministic profile map**

Start `forge-temple-terraces.js` with:

```js
(function(root,factory){
  var GF=typeof require!=="undefined"?require("./forge-generator-foundation.js"):root.ForgeGeneratorFoundation;
  var MB=typeof require!=="undefined"?require("./map-bridge.js"):root.MapBridge;
  var api=factory(GF,MB);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.ForgeTempleTerraces=api;
})(typeof self!=="undefined"?self:this,function(GF,MB){
  "use strict";
  var VERSION=1;
  var PROFILES=Object.freeze({
    temple:"temple-masonry",
    druidic:"druidic-overgrown-stone",
    tundra:"tundra-frost-stone",
    volcanic:"volcanic-basalt",
    cavern:"cavern-carved-rock",
    grass:"grassland-weathered-ruin",
    swamp:"swamp-sunken-stone"
  });
  function constructionProfile(themeKey){
    if(!Object.prototype.hasOwnProperty.call(PROFILES,themeKey))throw new Error("forge-temple-terraces: unknown theme \""+themeKey+"\"");
    return PROFILES[themeKey];
  }
  function clampInt(v,min,max){return Math.max(min,Math.min(max,Math.round(Number(v)||0)));}
  function idx(cols,c,r){return r*cols+c;}
  function key(c,r){return c+","+r;}
  return {VERSION:VERSION,PROFILES:PROFILES,constructionProfile:constructionProfile};
});
```

Steps 4–7 add the scene helpers and replace this temporary three-field export with the complete public API before the task's syntax and smoke gates run.

- [ ] **Step 4: Implement broad nested terraces and deterministic variants**

`layoutTemple(options)` must:

- choose `axial`, `switchback`, or `ring` from `layoutSeed % 3`;
- derive an even map size between 40 and 52 cells from `roomCount`;
- fill exterior cells with `VOID`;
- create one broad outer Temple footprint;
- create three nested platform regions separated by one-cell retaining-wall bands;
- leave an approach apron connected to the lower court;
- assign stable region IDs and room IDs;
- create empty `spawns`, `props`, and `torches` arrays.

Use this stable size rule:

```js
var size=40+2*Math.floor((clampInt(options.roomCount,4,16)-4)/2);
var W=size,H=size;
```

Use rectangular region bounds with a minimum four-cell inset between successive platform interiors. Store each region as `{id,role,elevationFt,cells}` and maintain a cell-to-region lookup. Variant changes stair-side choices and route paths; it must not replace broad regions with isolated raised cells.

Add smoke assertions that root seeds `5`, `1`, and `2` cover axial, switchback, and ring respectively under the `GF.stageSeeds(seed).layout % 3` rule, and that every region contains at least sixteen cells.

- [ ] **Step 5: Build route-owned stairs through retaining bands**

Implement:

```js
function buildStair(id,routeId,role,fromRegion,toRegion,path,profile){
  var first=path[0],last=path[path.length-1];
  return {
    id:id,
    kind:"stairs",
    from:Object.assign({},first),
    to:Object.assign({},last),
    path:path.map(function(p){return Object.assign({},p);}),
    widthFt:10,
    clearanceFt:null,
    movementCostFt:(path.length-1)*5,
    requires:{climb:false,jump:false,swim:false,fly:false},
    oneWay:false,
    blocksWhenClosed:false,
    state:"open",
    deltaFt:Math.abs(Number(last.elevationFt)-Number(first.elevationFt)),
    source:"archetype-intent",
    purpose:{routeId:routeId,role:role,fromRegionId:fromRegion,toRegionId:toRegion},
    render:{generated:true,constructionProfile:profile}
  };
}
```

Each retaining boundary gets a three-or-more-point stair path: low landing, one or more stair cells cut through the wall band, and high landing. Write each path point's `elevationFt` into `h[]` and mark its dungeon cell `FLOOR`, so rules and rendering share the same finite walk plane.

Create one required `primary-ascent` route through every tier. When the footprint is at least 44 cells, create one nonduplicate `secondary-route`; axial uses a side run, switchback alternates sides, and ring rotates stair sides around the summit.

Add smoke assertions that:

```js
const stairs=a.connectors.filter(c=>c.kind==="stairs");
ok("every Temple connector is purposeful",stairs.length>0&&stairs.every(c=>c.source==="archetype-intent"&&c.purpose&&c.purpose.routeId));
ok("stair paths are architectural runs",stairs.every(c=>c.path.length>=3));
ok("connector IDs are declared by routes",stairs.every(c=>a.intent.routes.some(r=>r.connectorIds.includes(c.id))));
ok("Temple does not generate bridges",!a.connectors.some(c=>c.kind==="bridge"));
```

- [ ] **Step 6: Implement semantic validation and bounded local repair**

`validateScene(scene)` returns `{ok:Boolean, errors:String[]}` and checks every approved invariant that is local to scene generation:

```js
function validateScene(scene){
  var errors=[],d=scene&&scene.dungeon,intent=scene&&scene.intent,connectors=scene&&scene.connectors||[];
  if(!d||!d.valid)errors.push("dungeon document is missing or invalid");
  if(!intent||intent.archetype!=="temple-terraces")errors.push("Temple intent is missing");
  var regionIds={};
  (intent&&intent.regions||[]).forEach(function(r){if(regionIds[r.id])errors.push("duplicate region "+r.id);regionIds[r.id]=r; if(!Array.isArray(r.cells)||r.cells.length<16)errors.push("region "+r.id+" has no usable platform");});
  var primary=(intent&&intent.routes||[]).filter(function(r){return r.role==="primary-ascent"&&r.required;});
  if(primary.length!==1)errors.push("Temple requires exactly one primary ascent");
  var purposes=intent&&intent.connectorPurposes||{};
  connectors.forEach(function(c){
    var p=purposes[c.id];
    if(!p||p.routeId!==(c.purpose&&c.purpose.routeId))errors.push("connector "+c.id+" lacks matching route purpose");
    if(!regionIds[p&&p.fromRegionId]||!regionIds[p&&p.toRegionId])errors.push("connector "+c.id+" names an unknown region");
  });
  return {ok:errors.length===0,errors:errors};
}
```

Extend it with cardinal path continuity, bounds, wall-gap, endpoint elevation, landing clearance, complete primary region order, decor exclusion, and reachability checks. `localRepair(scene)` may remove obstructing decor and widen only a failed landing cell; it returns a repaired clone or `null`. It must not add an undeclared connector or move a region.

- [ ] **Step 7: Complete `generate(options)` and verify the module**

`generate` constructs layout, heights, intent, routes, connector purposes, ledges, decor, profile, and dungeon metadata, then runs validation, one bounded local repair, and a final validation:

```js
function generate(options){
  var scene=layoutTemple(options||{});
  scene.constructionProfile=constructionProfile(options.themeKey);
  // buildRoutes mutates only scene route/connector/height records.
  buildRoutes(scene,options||{});
  applyTempleDecor(scene,options||{});
  var verdict=validateScene(scene);
  if(!verdict.ok){scene=localRepair(scene);verdict=scene?validateScene(scene):verdict;}
  if(!scene||!verdict.ok)throw new Error("forge-temple-terraces: invalid scene — "+verdict.errors.join("; "));
  scene.dungeon.spawns=[];
  return scene;
}
```

Run:

```bash
node --check forge/forge-temple-terraces.js
node --check forge/tests/smoke-temple-terraces.js
node forge/tests/smoke-temple-terraces.js
```

Expected: PASS and output ending `Temple Terraces checks green`.

- [ ] **Step 8: Review checkpoint and named-file handoff**

Review:

```bash
git diff -- forge/forge-temple-terraces.js forge/tests/smoke-temple-terraces.js
```

If M requests a commit:

```bash
git add forge/forge-temple-terraces.js forge/tests/smoke-temple-terraces.js
git commit -m "feat: generate intentional Temple Terraces"
```

---

### Task 3: Engine routing, scene verification, and stage ownership

**Files:**
- Modify: `forge/forge-engine.js:1-24, 213-247, 759-891`
- Modify: `forge/tests/smoke-temple-terraces.js`
- Modify: `forge/tests/smoke-phase2d-stage-ownership.js`

**Interfaces:**
- Consumes: `ForgeTempleTerraces.generate(options)` and `validateScene(scene)` from Task 2.
- Produces: `generateIntentionalDetailed(p)`; `verifyIntentionalScene(map)`; Temple `generateDetailed` results shaped exactly like existing `{map,dungeon,parameters,stageAttempts,stageFingerprints}` results.

- [ ] **Step 1: Add failing real-engine assertions**

Extend `smoke-temple-terraces.js`:

```js
const Engine=require(path.join(root,"forge-engine.js"));
const params=GF.normalizeParams({seed:81,theme:"temple",archetype:"temple-terraces",sliders:{roomCount:8,decorDensity:.7,party:4,foes:5}});
const detail=Engine.generateDetailed(params);
ok("engine routes Temple through intentional profile",detail.parameters.generatorProfile===GF.GENERATOR_PROFILES.INTENTIONAL);
ok("engine returns Temple intent",detail.map.meta.intent&&detail.map.meta.intent.archetype==="temple-terraces");
ok("intentional preview does not invent spawns",detail.map.spawns.length===0);
ok("engine publishes all five stage fingerprints",Object.keys(detail.stageFingerprints).sort().join(",")==="decor,foes,height,layout,semantics");
const unresolvedFoes=GF.hash32(JSON.stringify("deployment-unresolved")).toString(16).padStart(8,"0");
ok("foes fingerprint records unresolved deployment",detail.stageFingerprints.foes===unresolvedFoes);
```

- [ ] **Step 2: Run and verify the engine still uses staged legacy**

Run:

```bash
node forge/tests/smoke-temple-terraces.js
```

Expected: FAIL because `forge-engine.js` does not load the Temple module and routes all staged profiles through `generateStagedDetailed`.

- [ ] **Step 3: Add the Temple dependency and intentional route**

Extend the engine wrapper:

```js
var TT=(typeof require!=="undefined")?require("./forge-temple-terraces.js"):root.ForgeTempleTerraces;
var api=factory(FD,MB,GF,TT);
```

Add:

```js
function verifyIntentionalScene(map){
  var validation=MB.validate(map);
  if(!validation||!validation.ok)return false;
  if(!validateVerticalRecords(map))return false;
  var intent=map.meta&&map.meta.intent;
  return !!(intent&&intent.archetype==="temple-terraces"&&Array.isArray(map.spawns)&&map.spawns.length===0);
}
```

Implement `generateIntentionalDetailed(p)` by calling `TT.generate` with the five stage seeds, converting `scene.dungeon` through `MB.dungeonToMap`, applying `scene.h`, connectors, ledges, intent, construction profile, and decor, then attaching the standard meta/parameter record.

The foes fingerprint is explicitly unresolved:

```js
var fingerprints={
  layout:fp({grid:Array.from(d.grid),regions:scene.intent.regions.map(function(r){return{id:r.id,cells:r.cells};}),variant:scene.intent.variant}),
  height:fp({h:Array.from(map.h),connectors:map.connectors,ledges:map.ledges}),
  semantics:fp({routes:scene.intent.routes,connectorPurposes:scene.intent.connectorPurposes,suggestedDeploymentRegions:scene.intent.suggestedDeploymentRegions}),
  decor:fp(map.props||[]),
  foes:fp("deployment-unresolved")
};
```

Route in `generateDetailed`:

```js
if(p.generatorProfile===GF.GENERATOR_PROFILES.LEGACY)return generateLegacyDetailed(p);
if(p.generatorProfile===GF.GENERATOR_PROFILES.INTENTIONAL)return generateIntentionalDetailed(p);
return generateStagedDetailed(p);
```

- [ ] **Step 4: Prove stage isolation**

Add real-engine checks that changing only:

- `layout` changes variant/layout but not construction profile;
- `height` changes stair-side/tier details without changing layout bounds;
- `semantics` changes suggested region annotations without changing geometry;
- `decor` changes props only;
- `foes` changes no Temple scene fingerprint because deployment is unresolved.

Use `GF.parameterRecord` with exact stage-seed overrides and compare `detail.stageFingerprints`, following the existing `smoke-phase2d-stage-ownership.js` pattern.

- [ ] **Step 5: Verify the engine and stage smokes**

Run:

```bash
node --check forge/forge-engine.js
node forge/tests/smoke-temple-terraces.js
node forge/tests/smoke-phase2d-stage-ownership.js
```

Expected: both suites pass. The existing canyon assertion continues proving that nonimplemented archetypes use staged legacy rather than Temple grammar.

- [ ] **Step 6: Review checkpoint and named-file handoff**

If M requests a commit:

```bash
git add forge/forge-engine.js forge/tests/smoke-temple-terraces.js forge/tests/smoke-phase2d-stage-ownership.js
git commit -m "feat: route Temple scenes through Forge engine"
```

---

### Task 4: Remove purposeless generic connector generation

**Files:**
- Modify: `forge/forge-engine.js:583-709, 848-872`
- Modify: `forge/tests/smoke-phase2e-elevations-connectors.js`
- Modify: `forge/tests/smoke-phase2f4-bridge-completion.js`

**Interfaces:**
- Consumes: existing `verticalRecords`, `selectBridges`, and synthetic bridge authority.
- Produces: legacy height generation that emits only connectivity-required steep stairs/ramps; `findBridgeRecipe` returns `null` until a bridge-capable intentional archetype exists.

- [ ] **Step 1: Add failing no-decoration assertions**

In `smoke-phase2e-elevations-connectors.js`, replace the assertion requiring both stairs and ramps from a decorative sample with:

```js
const gentle=(built.map.connectors||[]).filter(c=>c.kind!=="bridge"&&Number(c.deltaFt)<=5);
ok(gentle.length===0,"legacy generation no longer samples ordinary 5-ft edges as decorative connectors");
ok((built.map.connectors||[]).filter(c=>c.kind!=="bridge").every(c=>Number(c.deltaFt)>5),"every remaining legacy stair or ramp repairs a movement-blocking rise");
```

In `smoke-phase2f4-bridge-completion.js`, preserve every synthetic movement/cover/replay assertion and replace only the real finder expectations with:

```js
const realDetail=RealEngine.generateDetailed(realParams);
ok("legacy staged generation does not invent structural bridges",!(realDetail.map.connectors||[]).some(c=>c&&c.kind==="bridge"));
const found=RealEngine.findBridgeRecipe(searchInput,{maxSeeds:48});
ok("bridge finder does not force a bridge into a non-bridge archetype",found===null);
```

- [ ] **Step 2: Run both smokes and verify the red state**

Run:

```bash
node forge/tests/smoke-phase2e-elevations-connectors.js
node forge/tests/smoke-phase2f4-bridge-completion.js
```

Expected: FAIL because legacy generation still samples gentle edges and still selects pool bridges.

- [ ] **Step 3: Remove only the purposeless production calls**

In `verticalRecords`:

- keep union-find selection of steep edges needed to connect ordinary movement components;
- delete the `gentle` array, `gentleCap`, and loop that adds ordinary 5-ft transitions;
- do not call `selectBridges` for staged legacy maps.

Do not delete `bridgeCandidates`, `selectBridges`, stable bridge identity, geometry, rendering, audit, replay, or synthetic tests. They remain the proven substrate for `bridge-crossing`.

Change `findBridgeRecipe` to return `null` unless a registered intentional bridge archetype exists. For this slice, no bridge archetype is active, so the function returns `null` without mutating inputs.

- [ ] **Step 4: Verify connector behavior and bridge authority**

Run:

```bash
node --check forge/forge-engine.js
node forge/tests/smoke-phase2e-elevations-connectors.js
node forge/tests/smoke-phase2f4-bridge-completion.js
node forge/tests/smoke-phase2f-bridges-damage.js
node forge/tests/smoke-tactics-geometry.mjs
node forge/tests/smoke-los-cover.js
```

Expected: all suites pass; bridge authority remains green on explicitly authored records while real legacy generation emits none.

- [ ] **Step 5: Review checkpoint and named-file handoff**

If M requests a commit:

```bash
git add forge/forge-engine.js forge/tests/smoke-phase2e-elevations-connectors.js forge/tests/smoke-phase2f4-bridge-completion.js
git commit -m "fix: remove purposeless generated connectors"
```

---

### Task 5: Canonical rendering, construction profiles, and purpose diagnostics

**Files:**
- Modify: `forge/index.html:24-30, 953-1030, 2020-2120, 2390-2520, 3025-3105, 6640-6670`
- Modify: `forge/tests/smoke-temple-terraces.js`
- Modify: `forge/tests/smoke-unified-forge-panel.js`

**Interfaces:**
- Consumes: Temple `intent`, connector `purpose`, connector `render.constructionProfile`, and multi-point stair paths.
- Produces: biome-consistent Temple stair meshes; purpose text in Vertical Geometry cards; honest `preview` selector status; cache-stamped Temple module load.

- [ ] **Step 1: Add failing production-surface assertions**

Append to `smoke-temple-terraces.js`:

```js
const fs=require("fs");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
ok("production loads the Temple module before the engine",html.indexOf("forge-temple-terraces.js?v=tt1")>=0&&html.indexOf("forge-temple-terraces.js?v=tt1")<html.indexOf("forge-engine.js?v=fe9"));
ok("stair renderer consumes the complete connector path",html.includes("function stairConnectorPath")&&html.includes("for(let segment=0;segment<path.length-1;segment++)"));
ok("connector rendering consumes saved construction profiles",html.includes("connectorConstructionMaterial")&&html.includes("constructionProfile"));
ok("Vertical Geometry reports route purpose",html.includes("purposeLabel")&&html.includes("primary ascent"));
ok("Temple selector labels preview honestly",html.includes("def.status==='preview'"));
```

- [ ] **Step 2: Run and verify the red state**

Run:

```bash
node forge/tests/smoke-temple-terraces.js
```

Expected: FAIL because the module is not loaded and the renderer still uses `from/to` plus hard-coded stone colors.

- [ ] **Step 3: Load/cache-bust the module**

Insert before `forge-engine.js`:

```html
<script src="forge-temple-terraces.js?v=tt1"></script>
<script src="forge-engine.js?v=fe9"></script>
```

Bump the foundation include to `forge-generator-foundation.js?v=g2g1`.

- [ ] **Step 4: Preserve Temple intent in the render field**

Extend `buildTiersField`'s returned record with detached copies:

```js
intent:stageMap.meta&&stageMap.meta.intent?JSON.parse(JSON.stringify(stageMap.meta.intent)):null,
constructionProfile:stageMap.meta&&stageMap.meta.constructionProfile||null
```

Extend `forgeSessionMap`/render snapshot metadata to preserve those records without recomputing them.

- [ ] **Step 5: Render every stair-path segment**

Replace the single `from/to` stair render assumption with:

```js
function stairConnectorPath(c){
  return Array.isArray(c.path)&&c.path.length>=2?c.path:[c.from,c.to].filter(Boolean);
}
function renderStairConnector(c){
  const path=stairConnectorPath(c),mat=connectorConstructionMaterial(c);
  for(let segment=0;segment<path.length-1;segment++){
    const from=path[segment],to=path[segment+1],a=connectorPoint(from),b=connectorPoint(to);
    const rise=Math.abs(Number(to.elevationFt)-Number(from.elevationFt));
    const steps=Math.max(2,Math.round(Math.max(rise,2.5)/1.25));
    const dx=(b.x-a.x)/steps,dz=(b.z-a.z)/steps;
    for(let i=0;i<steps;i++){
      const t=(i+.5)/steps,y=a.y+(b.y-a.y)*(i+1)/steps;
      const depth=Math.max(.18,Math.hypot(dx,dz)*1.08);
      const g=new THREE.BoxGeometry(Math.max(.55,Number(c.widthFt||5)/5*.78),.12,depth);
      const m=new THREE.Mesh(g,mat);
      m.position.set(a.x+(b.x-a.x)*t,y,a.z+(b.z-a.z)*t);
      m.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);
      m.castShadow=true;m.receiveShadow=true;connectorAdd(m,c,from);
    }
  }
}
```

The final implementation must retain the current shadow/discovery tagging and use the saved path-point elevations. It must not create a second rules path.

- [ ] **Step 6: Map construction profiles to renderer materials**

Add an exact profile table local to `forge/index.html`:

```js
const CONNECTOR_CONSTRUCTION={
  "temple-masonry":{stair:0x9b8767,trim:0xb9a27b},
  "druidic-overgrown-stone":{stair:0x596149,trim:0x748060},
  "tundra-frost-stone":{stair:0xaebccb,trim:0xd2e0ea},
  "volcanic-basalt":{stair:0x3d3835,trim:0x6a5143},
  "cavern-carved-rock":{stair:0x5a5048,trim:0x74685d},
  "grassland-weathered-ruin":{stair:0x8a8172,trim:0xa79b83},
  "swamp-sunken-stone":{stair:0x4a4a3a,trim:0x66705a}
};
function connectorConstructionMaterial(c){
  const key=c&&c.render&&c.render.constructionProfile;
  const profile=CONNECTOR_CONSTRUCTION[key]||CONNECTOR_CONSTRUCTION["temple-masonry"];
  return stoneMat(profile.stair);
}
```

Add trim variation only through deterministic connector data; do not call `Math.random()` while rendering saved structures.

- [ ] **Step 7: Paint preview status and purpose diagnostics**

Update the archetype selector to label statuses as `active`, `preview`, or `recorded`. For Temple preview, use:

```js
"Purpose-built Temple terrain is active in Workshop preview. Place deployment groups before opening a Table."
```

Add `purposeLabel(c)` and show route role plus source/destination region on stair cards or the existing Vertical Geometry status area. Unknown old connectors retain a neutral `mechanical connector` label rather than failing.

- [ ] **Step 8: Verify syntax and production-surface smokes**

Run:

```bash
node forge/tests/smoke-temple-terraces.js
node forge/tests/smoke-unified-forge-panel.js
node forge/tests/smoke-phase2c-archetype-params.js
```

Extract all inline scripts using the existing smoke harness and confirm parse success. `index.html` itself is not passed to `node --check`.

- [ ] **Step 9: Review checkpoint and named-file handoff**

If M requests a commit:

```bash
git add forge/index.html forge/tests/smoke-temple-terraces.js forge/tests/smoke-unified-forge-panel.js
git commit -m "feat: render purposeful Temple stair routes"
```

---

### Task 6: Preview safety gate and snapshot truth

**Files:**
- Modify: `forge/index.html:2938-2970, 4940-5000, 7360-7425`
- Modify: `forge/tests/smoke-snapshot-authority.js`
- Modify: `forge/tests/smoke-unified-forge-panel.js`
- Modify: `forge/tests/smoke-temple-terraces.js`

**Interfaces:**
- Consumes: `F.intent`, `map.meta.intent`, and Temple preview status.
- Produces: `templeDeploymentPending()`; narrated guards for local combat, shared Roll Initiative, and Save for later; exact snapshot round-trip for intent/style.

- [ ] **Step 1: Add failing safety and snapshot assertions**

Add production assertions:

```js
ok("Temple preview exposes a deployment guard",html.includes("function templeDeploymentPending"));
ok("local start refuses automatic Temple placement",html.includes("Temple Terraces needs DM deployment flags before combat can start."));
ok("shared table creation refuses unresolved Temple deployment",html.includes("Place deployment groups before opening or saving this Temple battlefield."));
```

Add a real snapshot round trip in `smoke-snapshot-authority.js` using `Engine.generateDetailed` for Temple and assert:

```js
const snap=GF.snapshotMap(temple.map);
const restored=GF.restoreMap(snap,GF.fingerprintSnapshot(snap));
ok(restored.meta.intent.variant===temple.map.meta.intent.variant,"Temple variant survives exact snapshot restore");
ok(restored.meta.constructionProfile===temple.map.meta.constructionProfile,"Temple construction profile survives exact snapshot restore");
ok(JSON.stringify(restored.meta.intent.connectorPurposes)===JSON.stringify(temple.map.meta.intent.connectorPurposes),"Temple connector purpose survives exact snapshot restore");
```

- [ ] **Step 2: Run and verify the guards are absent**

Run:

```bash
node forge/tests/smoke-unified-forge-panel.js
node forge/tests/smoke-snapshot-authority.js
```

Expected: safety assertions fail; snapshot assertions may pass automatically through cloned `meta`, which is acceptable evidence that no new snapshot schema machinery is needed.

- [ ] **Step 3: Add one authoritative preview predicate**

In `forge/index.html`:

```js
function templeDeploymentPending(){
  const intent=F&&F.intent;
  return !!(intent&&intent.archetype==="temple-terraces"&&!window.__forgeDeploymentReady);
}
```

Use this same predicate at all three doors:

- before `rebuild()` auto-calls `startCombat()` for a chosen local roster;
- at the start of `fbOpenTable.onclick`;
- at the start of `fbSaveLater.onclick`.

Narrate the exact strings asserted above. Do not disable the Forge preview or hide the Table controls; the controls must explain the dependency when used.

- [ ] **Step 4: Verify safety and compatibility**

Run:

```bash
node forge/tests/smoke-temple-terraces.js
node forge/tests/smoke-unified-forge-panel.js
node forge/tests/smoke-snapshot-authority.js
node forge/tests/smoke-forge-engine.js
```

Expected: all pass; legacy local/shared flows remain unchanged, while Temple can only preview.

- [ ] **Step 5: Review checkpoint and named-file handoff**

If M requests a commit:

```bash
git add forge/index.html forge/tests/smoke-snapshot-authority.js forge/tests/smoke-unified-forge-panel.js forge/tests/smoke-temple-terraces.js
git commit -m "fix: gate Temple combat on DM deployment"
```

---

### Task 7: Contract documentation and full verification

**Files:**
- Create: `forge/FORGE_TEMPLE_TERRACES_1.md`
- Modify: `forge/README.md`
- Modify: `CONTEXT_Forge.md`
- Create or modify: current dated Forge handoff under `docs/handoffs/forge/`
- Modify: all focused tests listed in this plan only where version/cache expectations require it.

**Interfaces:**
- Consumes: the completed Temple generator, engine route, renderer, diagnostics, and preview safety gate.
- Produces: canonical runtime contract, updated subsystem map, current handoff, and recorded validation counts.

- [ ] **Step 1: Write the runtime contract**

`forge/FORGE_TEMPLE_TERRACES_1.md` must freeze:

- generator/profile/version identities;
- the three variants and 0–15-ft platform bands;
- exact intent, route, connector-purpose, and construction-profile records;
- multi-point stair and landing rules;
- scene validation and local-repair boundaries;
- `spawns: []` and preview-only deployment dependency;
- snapshot authority and old-recipe compatibility;
- the absence of generic decorative connectors and production legacy bridges;
- the field checklist from the approved specification.

Do not describe deployment flags as implemented in this slice. State that the separate deployment plan is the promotion dependency.

- [ ] **Step 2: Update subsystem and handoff docs**

Add `forge-temple-terraces.js` to the README module map and record the exact preview boundary. Update `CONTEXT_Forge.md` and the current dated handoff so the next execution order is:

1. field-test Temple scene variants and purposeful stair rendering;
2. implement DM deployment groups and flags;
3. integrate exact deployment into save/session start;
4. promote Temple from preview to active;
5. build `bridge-crossing` on the same intent contract.

- [ ] **Step 3: Run syntax gates**

Run every touched or created JavaScript file individually:

```bash
node --check forge/forge-generator-foundation.js
node --check forge/forge-temple-terraces.js
node --check forge/forge-engine.js
node --check forge/tests/smoke-temple-terraces.js
node --check forge/tests/smoke-phase2c-archetype-params.js
node --check forge/tests/smoke-phase2d-stage-ownership.js
node --check forge/tests/smoke-phase2e-elevations-connectors.js
node --check forge/tests/smoke-phase2f4-bridge-completion.js
node --check forge/tests/smoke-snapshot-authority.js
node --check forge/tests/smoke-unified-forge-panel.js
```

Expected: every command exits 0 with no output.

- [ ] **Step 4: Run focused known-answer suites**

```bash
node forge/tests/smoke-temple-terraces.js
node forge/tests/smoke-phase2c-archetype-params.js
node forge/tests/smoke-phase2d-stage-ownership.js
node forge/tests/smoke-phase2e-elevations-connectors.js
node forge/tests/smoke-phase2f4-bridge-completion.js
node forge/tests/smoke-phase2f-bridges-damage.js
node forge/tests/smoke-snapshot-authority.js
node forge/tests/smoke-unified-forge-panel.js
node forge/tests/smoke-forge-engine.js
node forge/tests/smoke-map-bridge.mjs
node forge/tests/smoke-tactics-geometry.mjs
node forge/tests/smoke-los-cover.js
node forge/tests/smoke-placement.js
node forge/tests/smoke-flora.js
```

Expected: every suite exits 0 except the two inherited baseline reds verified before implementation:

- `smoke-forge-engine.js` remains exactly **13 passed, 1 failed**, with only `flat mode is level ground` red;
- `smoke-flora.js` remains the existing extracted-harness failure `Forge stage-owned engine did not load`.

Any additional failure, changed failure message, or lower pass count is a regression. Record every suite's exact result in the handoff.

- [ ] **Step 5: Run the whole Forge battery against the recorded baseline**

Run every executable Forge smoke with a 30-second per-suite timeout and a final status summary:

```bash
node -e 'const fs=require("fs"),path=require("path"),cp=require("child_process");const dir="forge/tests";const files=fs.readdirSync(dir).filter(f=>/^smoke-.*\.(?:js|mjs)$/.test(f)).sort();let pass=0,fail=0,timed=0;for(const file of files){const full=path.join(dir,file),r=cp.spawnSync(process.execPath,[full],{encoding:"utf8",timeout:30000});if(r.error&&r.error.code==="ETIMEDOUT"){timed++;console.log("TIMEOUT",file);}else if(r.status===0){pass++;console.log("PASS",file);}else{fail++;console.log("FAIL",file);process.stdout.write(r.stdout||"");process.stderr.write(r.stderr||"");}}console.log({pass,fail,timed,total:files.length});process.exitCode=fail?1:0;'
```

Compare the summary with the handoff baseline of 47 passing suites, 7 inherited failures, and 1 inherited timeout. Inspect every red suite by name; any new failure is a regression until explained and fixed.

- [ ] **Step 6: Conduct the real browser preview pass**

On the canonical `/forge/` surface:

1. select Temple Terraces and confirm it says `preview`;
2. load known axial, switchback, and ring seeds from the smoke fixtures;
3. confirm broad platforms, usable landings, and visible continuous stair runs;
4. inspect every stair and match its purpose to the visible regions;
5. compare at least Temple, Druidic, Tundra, and Volcanic construction profiles;
6. confirm no bridge appears;
7. confirm generic legacy seeds no longer receive decorative 5-ft stairs or bridges;
8. attempt local start, Roll Initiative, and Save for later, confirming each Temple path narrates the deployment dependency;
9. save/reload a legacy encounter and confirm its existing behavior is unchanged.

Browser observation is required; headless success alone is not promotion evidence.

- [ ] **Step 7: Final diff and named-file handoff**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Review only the files named in this plan. Leave unrelated untracked documents untouched.

If M explicitly requests one final commit after reviewing the complete slice:

```bash
git add forge/forge-generator-foundation.js forge/forge-temple-terraces.js forge/forge-engine.js forge/index.html forge/tests/smoke-temple-terraces.js forge/tests/smoke-phase2c-archetype-params.js forge/tests/smoke-phase2d-stage-ownership.js forge/tests/smoke-phase2e-elevations-connectors.js forge/tests/smoke-phase2f4-bridge-completion.js forge/tests/smoke-snapshot-authority.js forge/tests/smoke-unified-forge-panel.js forge/FORGE_TEMPLE_TERRACES_1.md forge/README.md CONTEXT_Forge.md docs/handoffs/forge/CONTEXT_Forge-update-2026-07-18.md
git commit -m "feat: add intentional Temple Terraces preview"
```

M performs `git push origin main` after reviewing the validated files. Codex never pushes.

---

## Deferred plans

After this plan is complete and field-approved, write two separate implementation plans from the approved design specification:

1. **DM deployment groups and flags** — pure formation planner, Workshop group editor, multiple Party/Ally/Enemy groups, capacity narration, manual overrides, and structural invalidation.
2. **Encounter integration and Temple promotion** — snapshot draft authority, session roster positions, reconnect/replay reconstruction, Roll Initiative gate replacement, old staged-encounter compatibility, and promotion from `preview` to `active`.

Only after those plans are green should `bridge-crossing` begin.
