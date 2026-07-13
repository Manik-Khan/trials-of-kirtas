# CONTEXT_Forge update · 2026-07-13a (sixth session — visual direction ratified; storybook sky/horizon live; camera, fog-of-war, and graph-generator plan settled)

Supersedes `CONTEXT_Forge-update-2026-07-12g.md` as the **current handoff**. The 12g record remains authoritative for the shipped ledge-firing, database-character-authority, and ranged-weapon fixes; do not delete it merely because this handoff is newer.

## What shipped in this session

### The visual pass moved the topography surface from prototype lighting to an authored battlefield

The current `topography-test-mock.html` visual branch now includes:

- authored biome fog ranges instead of one generic distance formula;
- scale-correct flora (`VIS_HEIGHT = PROP_FT × STEP/5 × scale`) so the picture agrees with `occ[]`;
- a lighter three-band toon ramp, reduced ambient darkening, thinner prop outlines, biome cliff strata and cap accents;
- scale-safe ground decals, motivated magical light sources, additive glow cards, and bounded modern-three `PointLight`s (`?fxlights=0` disables them);
- combat-presentation mode: Forge chrome can fade away and return through the Forge toggle;
- the feel layer that older context still marked missing: target/verdict badges, hit flash, camera shake, idle bob, floating damage/healing/miss/down text, token nameplates, and sight lines drawn with `depthTest:false`.

The first browser screenshots confirmed the surface reads substantially better.

### Art packs and browser-upload bundles produced

1. `trials-of-kirtas-topography-visual-pass-2026-07-13a.zip`
   - first integrated terrain/material/light pass;
   - updated `forge/topography-test-mock.html` plus `forge/assets/topography-art/`.

2. `battle-forge-build-A-visual-pack-2026-07-13.zip`
   - six painterly biome horizon plates;
   - six simple matching sky gradients.

3. `battle-forge-build-B-generator-roadmap-2026-07-13.zip`
   - graph-generator roadmap, diagrams, data-shape examples, semantics, overlays, and test plan.

4. `battle-forge-build-A-v2-parallax-pack-2026-07-13.zip`
   - six stronger storybook skies;
   - three extracted parallax cards per biome;
   - two extracted landmark cards per biome;
   - source atlases retained for recropping.

5. `battle-forge-build-A-v3-integration-patch-2026-07-13.zip`
   - wired sky, horizon, parallax, and landmark cards into the mock;
   - comparison flags: `?storybook=0`, `?parallax=0`, `?landmarks=0`.

### The browser eyeball ratified the useful subset and exposed the bad subset

M tested the integration in real browsers and supplied two screenshots:

- with all v3 layers enabled, the extracted parallax/landmark cards displayed white/checkerboard masking blocks. The generated source sheets had a matte/checkerboard baked into RGB rather than trustworthy alpha; the extraction was not production-safe.
- with `?parallax=0&landmarks=0`, the storybook sky + painted horizon looked strong, clear, and appropriate behind the tactical board.

**Current art ruling:** storybook sky + painted horizon is the default direction. Parallax and landmark cards are **off until rebuilt with real alpha**; the next cleanup should invert their URL semantics so `?parallax=1` / `?landmarks=1` are opt-in experiments rather than requiring opt-out flags.

The non-background v2 cards were intentionally authored as distant scenery, but M reasonably expected them to be battlefield assets. The categories are now split:

- **background scenery:** sky, horizon, distant parallax, decorative landmark — no collision, footprint, or cover;
- **tactical battlefield props:** separate future pack with footprint, rotation/view art, movement effect, and `occFt`, emitted into `props` / `occ[]` so the picture and rules remain identical.

## Camera and discovery decisions (planned, not built)

The current camera already owns `cam.tgt`, `placeCam()`, and `focusUnit()`, but `frameField()` resets the target to the map center and chooses a distance large enough to show almost the whole field. Pointer drag changes orbit angles only; there is no terrain pan.

The next camera build should provide four modes:

1. **Follow active unit** — combat opens on the active/first PC; the focus smoothly follows movement.
2. **Focus selected unit** — token or initiative click moves `cam.tgt` to that unit.
3. **Frame attacker + target** — target selection frames the pair, holds briefly through the attack, then returns to the actor.
4. **Free camera** — terrain pan, wheel/pinch zoom, orbit, recenter, and an overseer-only full-map Overview.

Manual panning temporarily breaks follow; selecting/recentering re-engages it. Preserve camera azimuth when changing focus. Player zoom and pan are bounded to the playable map.

The apparent map “spin” is currently camera orbit around `cam.tgt`, not world-root rotation. Keep that architecture. Sky may stay camera-relative; a later horizon upgrade can use a cylindrical/world-aligned panorama so the world direction remains coherent while orbiting.

## Fog-of-war decision (planned, not built)

Camera limits improve presentation but are not fog-of-war authority. Fog must live in world/map space.

Start with **party-shared vision** and three states:

- **unexplored:** terrain, cliff faces, props, tokens, highlights, hover, and targeting hidden;
- **explored but not visible now:** remembered static terrain darkened/desaturated; enemies and live changes hidden;
- **visible now:** normal rendering and interaction.

Recompute after friendly movement from party token positions + sight radius + `h[]` + `wall[]` + `occ[]` + the canonical line-of-sight geometry. Union living PCs into `visibleNow`; accumulate into `explored`. Gate enemy sprites, hover, badges, and targeting through the existing `foeVisible()` seam.

A first renderer may use per-tile/column fog volumes; the stronger destination is per-instance visibility on caps, cliffs, props, and overlays. Fog rotates with the world because it is keyed to cells, not painted on the screen.

## Phase 2 generator direction (planned, not built)

Borrow the structural pipeline from `majidmanzarpour/threejs-procedural-dungeon`, but emit Battle Forge’s heightfield map document rather than a flat room-and-corridor dungeon:

1. choose a **map archetype** (valley, canyon, central hill, ring, split plateau, bridge crossing, island chain, courtyard, cavern chambers, temple terraces, ridge, basin);
2. scatter room/plateau seeds;
3. separate overlaps;
4. build a Delaunay candidate graph;
5. reduce to MST for guaranteed connectivity and restore tunable loops;
6. assign room semantics from BFS depth and critical path;
7. assign elevations under tactical constraints;
8. carve plateaus, cliffs, ramps, stairs, bridges, doors, tunnels, ledges, and fords;
9. place semantic spawns/objectives;
10. validate, repair/retry, then decorate visual-only and rules-relevant props separately;
11. emit `{cols,rows,h,wall,occ,spawns,props,meta}`.

Additional requirements ratified in this session:

- `generatorVersion` on every generated/saved encounter;
- save both seed/params **and** an exact `mapSnapshot`;
- independent deterministic sub-seeds (`layout`, `height`, `semantics`, `decor`, `foes`) so adding a flower cannot change the boss room;
- mandatory normal-creature route, bounded tiers, connector/access rules, and no unavoidable low-ground spawn trap;
- quality metrics for connectivity, spawn distance, immediate LoS, cover within one move, route count, elevation advantage, choke width, sightline lengths, melee access to ranged positions, and objective access;
- debug overlays: graph, critical path, semantics, height bands, cover density, spawn influence, reachable connectors;
- author controls: Forge all, Lock topology, Reroll heights/connectors/decor/foes, then paint/edit manually.

## Current next-session order

1. **Art cleanup:** make sky + horizon the normal default; parallax/landmarks opt-in or remove them from production until regenerated with real alpha.
2. **Camera/discovery mock → approve → build:** active-unit follow, selected/pair framing, terrain pan, recenter, overview, bounds/zoom.
3. **Party-shared fog of war:** three-state world visibility and `foeVisible()` interaction gates.
4. **Generator foundation:** versioning, snapshots, sub-seeds, archetypes, graph metadata, overlays.
5. **Generator terrain:** Delaunay → MST + loops → semantics → elevations/connectors → spawn/objective placement → validate/repair.
6. **Tactical prop pack:** map-space assets with footprint + `occFt` + rotations; visual decoration only after rules-relevant placement.
7. Carry forward the pre-existing rules backlog after the camera/discovery bite: mid-fight sheet sync, thrown/ranged mode, reach weapons, flanking, opportunity attacks, Ready.

## Working/deploy rule unchanged

M uploads/commits/pushes through GitHub’s browser. Claude prepares validated replacement files and ZIPs with folder structure intact; Claude does not push. Diff any newly uploaded live mock against this handoff before editing — the repo, this doc, and an old ZIP can each be stale independently.
