# Unified Forge Panel and Real Bridge Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Do not dispatch subagents unless M explicitly requests them.

**Goal:** Replace the competing Forge interfaces with one collapsible top-left shell and make the real staged generator produce bridge recipes that the Workshop can find and carry into a Table.

**Architecture:** Correct pool elevation at the staged-map source so bridge clearance, snapshots, rendering, movement, and cover share one map contract. Export one deterministic engine-level recipe finder, then make the canonical surface consume it. Consolidate the existing header, seed bar, panel, and combat menu into one shell governed by `setForgePanelOpen(open)`.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, three.js r185, dual-export Forge modules, Node known-answer smokes.

## Global Constraints

- Canonical surface only: `forge/index.html`; do not restore or edit the redirected topography mock.
- Surgical edits only; no unrelated panel refactor and no theme-variable changes.
- Preserve existing staff/player and session authority.
- Cache-bump `forge-engine.js` from `?v=fe7` to `?v=fe8` everywhere it is loaded.
- Run `node --check` on every touched or created `.js` file.
- Do not commit or push unless M explicitly requests it.
- Compare the full Forge battery with the recorded 47-pass / 7-fail / 1-timeout baseline.

---

### Task 1: Real staged bridges and deterministic recipe finder

**Files:**
- Modify: `forge/tests/smoke-phase2f4-bridge-completion.js`
- Modify: `forge/forge-engine.js`

**Interfaces:**
- Consumes: `ForgeGeneratorFoundation.normalizeParams(input)` and `ForgeEngine.generateDetailed(params)`.
- Produces: `ForgeEngine.findBridgeRecipe(params, options)` returning `null` or `{ seed, themeKey, parameters, detail }`.

- [ ] **Step 1: Add failing real-generator assertions**

Extend `smoke-phase2f4-bridge-completion.js` after the existing synthetic bridge construction:

```js
const RealEngine=require(path.join(root,"forge-engine.js"));
const realParams=GF.normalizeParams({
  seed:1,theme:"swamp",archetype:"legacy-dungeon",
  sliders:{roomCount:8,loopChance:.2,decorDensity:.7,heightMode:"tiered",verticality:5,party:4,foes:5}
});
const realDetail=RealEngine.generateDetailed(realParams);
const realBridges=(realDetail.map.connectors||[]).filter(c=>c&&c.kind==="bridge");
ok("real staged generation emits a structural bridge",realBridges.length>0);

const searchInput=GF.normalizeParams({
  seed:7,theme:"grass",archetype:"legacy-dungeon",
  sliders:{roomCount:8,loopChance:.2,decorDensity:.7,heightMode:"tiered",verticality:5,party:4,foes:5}
});
const hasFinder=typeof RealEngine.findBridgeRecipe==="function";
ok("bridge finder is exported",hasFinder);
const found=hasFinder?RealEngine.findBridgeRecipe(searchInput,{maxSeeds:48,themeKeys:["grass","swamp"]}):null;
ok("bridge finder returns a real generated recipe",!!found&&(found.detail.map.connectors||[]).some(c=>c.kind==="bridge"));
ok("bridge finder does not mutate its input",searchInput.seed===7&&searchInput.theme==="grass");
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node forge/tests/smoke-phase2f4-bridge-completion.js`

Expected: the real staged-generation assertion fails because production currently yields zero bridges; the finder assertion cannot pass until `findBridgeRecipe` exists.

- [ ] **Step 3: Preserve physical pool elevation**

In `generateStagedDetailed`, replace the map-height assignment with cell-type-aware support:

```js
for (var i = 0; i < heightPlan.h.length; i++) {
  var cell = d.grid[i];
  var supportedWall = cell === MB.CELL.WALL || cell === MB.CELL.VOID;
  map.h[i] = supportedWall ? wallSupportHeight(map, heightPlan.h, i) : heightPlan.h[i];
}
```

Blocked pools remain `wall:true` for movement, but retain the hazard-floor height used for bridge clearance.

- [ ] **Step 4: Add the deterministic engine finder**

Add beside `generateDetailed`:

```js
function findBridgeRecipe(params, options) {
  var base = generationParams(params), opts = options || {};
  var maxSeeds = Math.max(1, Math.min(512, Number(opts.maxSeeds) || 48));
  var currentTheme = chooseTheme(base);
  var requestedThemes = Array.isArray(opts.themeKeys) ? opts.themeKeys : FD.THEME_KEYS;
  var themes = [currentTheme];
  requestedThemes.forEach(function (theme) {
    if (FD.THEME_KEYS.indexOf(theme) >= 0 && themes.indexOf(theme) < 0) themes.push(theme);
  });
  for (var ti = 0; ti < themes.length; ti++) {
    for (var step = 1; step <= maxSeeds; step++) {
      var seed = (base.seed + step) >>> 0;
      var candidate = Object.assign({}, base, { seed: seed, themeKey: themes[ti], stageSeeds: null });
      var detail = generateDetailed(candidate);
      if ((detail.map.connectors || []).some(function (c) { return c && c.kind === "bridge"; })) {
        return { seed: seed, themeKey: themes[ti], parameters: detail.parameters, detail: detail };
      }
    }
  }
  return null;
}
```

Export `findBridgeRecipe` in the public API object.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `node forge/tests/smoke-phase2f4-bridge-completion.js`

Expected: **37 passed, 0 failed** after adding the four new assertions.

- [ ] **Step 6: Check engine syntax**

Run: `node --check forge/forge-engine.js && node --check forge/tests/smoke-phase2f4-bridge-completion.js`

Expected: both exit 0 with no output.

- [ ] **Step 7: Review the Task 1 diff without committing**

Run: `git diff -- forge/forge-engine.js forge/tests/smoke-phase2f4-bridge-completion.js`

Confirm the diff changes only pool-height ownership, the finder export, and the focused regression.

---

### Task 2: One unified Forge shell

**Files:**
- Create: `forge/tests/smoke-unified-forge-panel.js`
- Modify: `forge/index.html`

**Interfaces:**
- Consumes: existing IDs `seedGroup`, `forgePanel`, `sceneModeToggle`, `sceneViewerMode`, `sceneFlankingRule`, `sceneCoverAudit`, `sceneVerticalOverlay`, and `sceneProneToggle`.
- Produces: `setForgePanelOpen(open)` and a single `#forgeShell` containing the header and settings body.

- [ ] **Step 1: Write the failing panel-structure smoke**

Create `smoke-unified-forge-panel.js` that loads `forge/index.html` and asserts:

```js
has('id="forgeShell"',"one top-left Forge shell exists");
has('function setForgePanelOpen(open)',"one function owns expanded state");
has('setForgePanelOpen(true);',"Workshop entry expands the shell");
has('setForgePanelOpen(false);',"combat or party transitions collapse the shell");
has('id="forgeTableSettings"',"combat settings live inside the unified panel");
notHas('id="sceneModeMenu"',"the competing black flyout is removed");
notHas('id="sceneForgeControls"',"the Forge-controls indirection is removed");
notHas('forge-peek',"the second-panel reveal state is retired");

const shellStart=html.indexOf('id="forgeShell"');
const shellEnd=html.indexOf('</div><!-- /forgeShell -->',shellStart);
const shell=html.slice(shellStart,shellEnd);
ok(shell.includes('id="sceneModeToggle"')&&shell.includes('id="seedGroup"')&&shell.includes('id="forgePanel"'),
  "header, seed, and settings share one shell");
```

Use a small `ok/has/notHas` harness and print the pass/fail count.

- [ ] **Step 2: Run the new smoke and verify RED**

Run: `node forge/tests/smoke-unified-forge-panel.js`

Expected: failure on missing `forgeShell` and `setForgePanelOpen`.

- [ ] **Step 3: Consolidate the markup**

In `forge/index.html`:

```html
<div id="forgeShell">
  <button id="sceneModeToggle" type="button" aria-controls="forgePanel" aria-expanded="true">⚒ <span>Forge</span> <b>▴</b></button>
  <div class="panel" id="forgePanel">
    <div class="forgebar"><div id="seedGroup">…existing seed controls…</div></div>
    …existing Active / Planned panel content…
    <div id="forgeTableSettings">
      <div class="divider"></div>
      <div class="eyebrow">TABLE SETTINGS</div>
      …existing presentation, flanking, cover-audit, connector, and prone buttons…
      <div class="sceneMenuNote" id="sceneViewerNote">…existing note…</div>
    </div>
  </div>
</div><!-- /forgeShell -->
```

Remove `#sceneModeMenuWrap`, `#sceneModeMenu`, and `#sceneForgeControls`. Keep existing setting IDs so their authority and handlers remain surgical.

- [ ] **Step 4: Replace the competing fixed layouts with one shell**

Use page-local CSS:

```css
#forgeShell{position:fixed;left:20px;top:18px;z-index:130;width:262px;display:none;pointer-events:auto}
body.forge-author-preview #forgeShell,body.combat-mode #forgeShell{display:block}
#forgeShell #sceneModeToggle{position:static;display:flex;width:auto}
body.forge-panel-open #forgeShell #sceneModeToggle{width:100%;justify-content:space-between}
#forgeShell #forgePanel{position:static;display:none;width:262px;max-height:calc(100dvh - 66px);overflow-y:auto;transform:none}
body.forge-panel-open #forgeShell #forgePanel{display:block}
#forgeShell .forgebar{position:static;display:block;padding:10px 14px 0}
```

Retire the old `.forge-peek`, fixed `.forgebar`, fixed `.panel`, and black flyout rules. Preserve the existing narrow-screen width rule by scoping it to `#forgeShell` and `#forgePanel`.

- [ ] **Step 5: Add the single panel-state owner**

Replace the flyout logic with:

```js
function setForgePanelOpen(open){
  document.body.classList.toggle('forge-panel-open',!!open);
  if(sceneModeToggle){
    sceneModeToggle.setAttribute('aria-expanded',open?'true':'false');
    var mark=sceneModeToggle.querySelector('b');if(mark)mark.textContent=open?'▴':'▾';
  }
}
if(sceneModeToggle)sceneModeToggle.addEventListener('click',function(e){
  e.stopPropagation();setForgePanelOpen(!document.body.classList.contains('forge-panel-open'));
});
```

Call `setForgePanelOpen(true)` from `previewMap()`, `setForgePanelOpen(false)` from `returnToParty()`, and collapse from `setSceneMode(true)` when combat starts. Remove all `sceneModeMenu.hidden` and `forge-peek` mutations.

- [ ] **Step 6: Keep existing Table-setting handlers in place**

Retain `sceneViewerMode`, `sceneFlankingRule`, `sceneCoverAudit`, `sceneVerticalOverlay`, and `sceneProneToggle` handlers, removing only statements that close the deleted flyout. `refreshSceneMenu()` may retain its name, but it must update the buttons inside `#forgeTableSettings` and call `refreshVerticalGeometryPanel()`.

- [ ] **Step 7: Use the engine recipe finder from Workshop**

Replace the loop inside `findNearbyBridgeSeed()` with:

```js
var found=window.ForgeEngine.findBridgeRecipe(base,{maxSeeds:48});
if(!found){systemClog('<i>Bridge diagnostics: no structural bridge recipe was found; the current battlefield is unchanged.</i>');return;}
seedEl.value=found.seed;BIOME=found.themeKey;
paintBiomeControl(BIOME);
mode='tiers';setActiveChip('tiers');document.getElementById('seedGroup').style.opacity='1';setImgOnly(false);rebuild();
systemClog('<i>Bridge diagnostics: loaded '+escapeHtml(BIOME)+' seed '+found.seed+' with '+verticalGeometryCounts().bridges+' structural bridge(s).</i>');
```

Use the existing biome-chip painting path or extract its current class-toggle lines into `paintBiomeControl(key)` so a fallback biome change is visible. Do not rebuild until a recipe is found.

- [ ] **Step 8: Update the engine cache stamp**

Change the canonical include to:

```html
<script src="forge-engine.js?v=fe8"></script>
```

- [ ] **Step 9: Run the panel smoke and verify GREEN**

Run: `node forge/tests/smoke-unified-forge-panel.js`

Expected: all assertions pass with zero failures.

- [ ] **Step 10: Check the new test syntax**

Run: `node --check forge/tests/smoke-unified-forge-panel.js`

Expected: exit 0 with no output.

- [ ] **Step 11: Review the Task 2 diff without committing**

Run: `git diff -- forge/index.html forge/tests/smoke-unified-forge-panel.js`

Confirm there is one top-left shell and no unrelated combat-HUD or geometry change.

---

### Task 3: Cache-stamp expectations and focused regression battery

**Files:**
- Modify: `forge/tests/smoke-phase2c-archetype-params.js`
- Modify: `forge/tests/smoke-phase2d-stage-ownership.js`
- Modify: `forge/tests/smoke-phase2e-elevations-connectors.js`
- Modify: `forge/tests/smoke-snapshot-authority.js`

**Interfaces:**
- Consumes: canonical `forge-engine.js?v=fe8` include.
- Produces: updated cache-stamp assertions accepting `fe8`.

- [ ] **Step 1: Update exact cache-stamp expectations**

In all four tests, change:

```js
/forge-engine\.js\?v=fe(?:5|6|7)/
```

to:

```js
/forge-engine\.js\?v=fe(?:5|6|7|8)/
```

- [ ] **Step 2: Check every touched JavaScript file**

Run:

```sh
node --check forge/forge-engine.js
node --check forge/tests/smoke-phase2f4-bridge-completion.js
node --check forge/tests/smoke-unified-forge-panel.js
node --check forge/tests/smoke-phase2c-archetype-params.js
node --check forge/tests/smoke-phase2d-stage-ownership.js
node --check forge/tests/smoke-phase2e-elevations-connectors.js
node --check forge/tests/smoke-snapshot-authority.js
```

Expected: every command exits 0 with no output.

- [ ] **Step 3: Run focused smokes**

Run each command and require zero new failures:

```sh
node forge/tests/smoke-phase2f4-bridge-completion.js
node forge/tests/smoke-unified-forge-panel.js
node forge/tests/smoke-phase2f1-field-audit.js
node forge/tests/smoke-phase2f-bridges-damage.js
node forge/tests/smoke-tactics-geometry.mjs
node forge/tests/smoke-geometry-sync.js
node forge/tests/smoke-replay.js
node forge/tests/smoke-phase2c-archetype-params.js
node forge/tests/smoke-phase2d-stage-ownership.js
node forge/tests/smoke-phase2e-elevations-connectors.js
node forge/tests/smoke-snapshot-authority.js
```

- [ ] **Step 4: Run the Forge engine smoke and record inherited status**

Run: `node forge/tests/smoke-forge-engine.js`

Expected baseline: 13 passed and the inherited flat-mode assertion remains the only failure unless this change legitimately corrects it.

- [ ] **Step 5: Run the repository Forge battery**

Use the repository's current Forge smoke runner if present; otherwise enumerate the current `forge/tests/smoke-*` files and run them with the same bounded timeout policy used by the recorded baseline. Compare exact results with 47 passing suites / 7 inherited failures / 1 inherited timeout.

- [ ] **Step 6: Check the final diff**

Run: `git diff --check` and `git status --short`.

Confirm only the planned Forge runtime/tests plus the approved spec and this plan are new or modified. Preserve all unrelated pre-existing untracked files.

---

### Task 4: Real-browser field verification

**Files:**
- No additional production files unless the browser demonstrates a blocker.

**Interfaces:**
- Consumes: canonical local `/forge/` route and the approved Workshop→Table flow.
- Produces: browser evidence for layout, bridge generation, and state transition behavior.

- [ ] **Step 1: Open the canonical route at desktop size**

Verify Workshop entry shows the black Forge header with the same pale panel expanded beneath it. Confirm seed controls are inside the panel and clickable.

- [ ] **Step 2: Verify a real generated bridge**

Click **Find bridge seed**. Confirm the seed/biome update is visible, the status reports at least one bridge, bridge cards appear, Inspect works, and Audit Bridges passes.

- [ ] **Step 3: Verify the unified combat transition**

Select a real combat-ready character and begin the local fight. Confirm the panel collapses to the black Forge header, then expands the same panel with Table Settings and no second flyout.

- [ ] **Step 4: Verify desktop overlap boundaries**

At approximately 1280×720, inspect bounding boxes and hit-testing: the shell header must remain above the scroll body; seed controls must remain inside the body; neither may be covered by the combat HUD.

- [ ] **Step 5: Verify the narrow layout**

At the existing `max-width:660px` breakpoint, confirm the shell fits the viewport, retains an internal scroll area, and its header remains reachable.

- [ ] **Step 6: Record the remaining two-browser field gate honestly**

If authenticated two-device Supabase testing is unavailable locally, report that refresh/reconnect, live occupancy, rail-cover attacks, and rewind remain M's deployment field checklist rather than claiming them browser-verified.

- [ ] **Step 7: Do not commit or push**

Return validated files, focused/full pass counts, inherited failures, the browser result, and a one-line deploy note. M commits and pushes.
