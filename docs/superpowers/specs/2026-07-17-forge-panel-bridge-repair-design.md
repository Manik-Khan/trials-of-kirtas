# Unified Forge Panel and Real Bridge Generation

**Date:** 2026-07-17  
**Status:** Design approved by M  
**Scope:** Canonical `/forge/` surface only (`forge/index.html`) plus the staged generator and focused Forge smokes.

## Goal

Remove the competing top-left Forge interfaces and make structural bridges available from the real staged generator, so Workshop authoring flows directly into a trustworthy Table test.

## Confirmed failures

1. The fixed Workshop panel can rise to `top:20px` while the seed bar sits at `top:60px`. Both use the same stacking layer, and the later panel paints over the seed controls.
2. The black combat Forge menu and the pale Workshop panel are separate interfaces. The menu contains a “Forge controls” indirection that reveals the second panel underneath it, producing overlapping controls.
3. The bridge buttons are wired, but the staged generator produces no usable bridge recipe. A 7,000-map sweep across all seven supported biomes produced zero bridges.
4. The existing Phase 2f.4 bridge smoke uses a hand-built pool gap. It validates bridge authority but does not prove production generation.

## Product behavior

### One Forge shell

The canonical surface has one fixed top-left Forge shell:

- The existing black **Forge** control becomes the permanent shell header.
- Workshop opens the shell expanded.
- Starting or joining combat collapses the shell to its header.
- Clicking the header expands or collapses the same panel in either mode.
- No second panel or flyout appears beneath the shell.
- The shell body owns one viewport-bounded scroll region below its header.

The separate top-left product label and independent seed bar no longer compete with the panel. The dungeon name may remain outside the shell as map identity, provided it does not occupy the shell's top-left space.

### Unified contents

The expanded shell contains the existing settings, regrouped without changing their authority:

1. Seed and **Forge battlefield** authoring controls.
2. **Active / Planned** tabs.
3. Biome and dungeon authoring controls.
4. Table creation and staged fights.
5. Bestiary selection.
6. **Table Settings**: presentation mode, flanking rule, cover audit, connector overlay/inspection, and selected-condition control where currently supported.
7. Local camera, token-art, and grid presentation controls.
8. Vertical geometry and bridge controls.

The old “Forge controls” menu item is removed because the shell header itself owns expansion.

### Authority and narration

- Workshop authoring controls are active before a session.
- During a Table, map recipe controls are locked and explain that the battlefield belongs to the fight.
- Existing staff-only controls remain absent for players; they are not merely greyed out.
- Local presentation controls remain available where current authority allows them.
- Disabled bridge controls narrate why they cannot run.

## Bridge-generation correction

### Root contract

Pool/hazard cells keep their true hazard-floor elevation from the height stage. `wallSupportHeight()` applies only to actual dungeon wall/void support cells, not to blocked pool/hazard cells.

This preserves one truthful geometry contract:

- `wall[]` may block movement through a hazard;
- `h[]` remains the physical floor below the proposed deck;
- an open bridge supplies the walk surface at its authored elevation;
- Closed/Broken removes that surface and rail authority together;
- bridge clearance, validation, rendering, movement, and cover all read compatible elevations.

The repair must not add bridge-only exceptions that make candidate math disagree with the saved map.

### Deterministic recipe finder

**Find bridge seed** becomes a deterministic bridge-recipe finder:

1. Normalize a fresh parameter record for every candidate.
2. Search nearby seeds in the current biome first.
3. If the current biome cannot produce a bridge within the bounded search, continue through supported bridge-capable biomes in a fixed order.
4. Do not mutate the visible recipe or battlefield until a valid generated bridge is found.
5. When found, apply both seed and biome, rebuild once, and narrate the loaded recipe and bridge count.
6. If the bounded search fails, retain the current battlefield and narrate the failure.

The finder is an authoring/test shortcut only. It remains disabled after combat or session authority begins.

## Workshop-to-Table testing flow

Workshop supports:

- finding and generating a real bridge recipe;
- connector overlay and inspection;
- Open/Closed/Broken visual state controls;
- bridge audit.

**Roll Initiative** begins the authoritative play test using the real party and Table systems:

- traversal in both directions;
- rail cover through real attacks;
- Closed/Broken movement refusal;
- usable land bridgeheads;
- interior-span occupancy refusal;
- endpoint allowance;
- refresh/reconnect reconstruction;
- rewind/correction restoration.

No temporary Workshop test-token mode is added.

## State ownership

A single `setForgePanelOpen(open)` path owns the shell state. Callers use it rather than manipulating panel visibility independently:

- Workshop entry: open.
- Return to party selection: close or hide with the existing party overlay.
- Local combat start: close.
- Shared Table boot/join: close.
- Forge header click: toggle.

The existing `combat-mode`, Staff/Player View, and session-authority classes may continue to control presentation, but none may create a second Forge settings surface.

## Failure behavior

- Bridge search failure is visible in the System/Table narration and does not change the current map.
- A bridge audit with no bridge remains unavailable and the panel states why.
- Live bridge edits retain overseer, occupancy, animation, and path-signature guards.
- Player devices never receive staff-only bridge state controls.
- A stale connector identity continues to restore the snapshot baseline rather than applying to a different bridge.

## Test design

### Red-first production regressions

1. A focused real-generator smoke must fail on the current code by proving that a known staged recipe with pool cells produces at least one structural bridge.
2. A real finder smoke must fail on the current code by proving that the production finder returns a generated bridge recipe, not a synthetic map.
3. A panel-structure smoke must fail on the current code by proving that one Forge shell owns the header, seed controls, panel body, and expansion path, with no “Forge controls” indirection.

### Focused verification

- `node --check` on every touched or created `.js` file.
- Real staged-generator bridge regression.
- Bridge finder regression.
- Phase 2f.1 field-audit smoke.
- Phase 2f.4 bridge-completion smoke.
- Forge engine, generator foundation, tactics geometry, replay, and promotion/visibility smokes affected by the change.
- Canonical geometry inline-sync smoke if `forge/index.html` changes around the inlined authority boundary.

### Browser verification

On the canonical `/forge/` route:

- Workshop opens the unified shell expanded.
- Seed controls and the shell header remain reachable at desktop and narrow viewport sizes.
- Starting combat collapses the shell.
- Expanding during combat reveals the same panel and its Table Settings section.
- The panel does not cover its header or create a second top-left layer.
- A real bridge recipe can be found, inspected, audited, and carried into Roll Initiative.

The focused two-browser Phase 2f.4 field checklist remains the final authority for refresh, reconnect, occupancy, rail cover, and rewind behavior.

## Baseline and stop conditions

Compare the full Forge battery against the recorded Phase 2f.4 baseline:

- 47 passing suites;
- 7 inherited failures;
- 1 inherited timeout.

Stop rather than continue forward if:

- a new suite regresses beyond that baseline;
- bridge identity differs across generation, snapshot, or replay;
- rendering disagrees with movement or cover;
- the unified shell hides required player-local settings;
- the panel again overlaps its own header or seed controls;
- rewind fails to restore the snapshot bridge state.

## Non-goals

- Doors or later connector types.
- A new Workshop test-token mode.
- New bridge art or visual polish.
- Locks, keys, traps, secret doors, or destructible-bridge combat.
- Unrelated Forge panel refactoring.
