# Battle Forge — Phase 1.5f discovery + direct-fire preview

This bundle advances the exact Phase 1.5e production surface into the final discovery/tactical-guidance bite before active Phase 2 terrain generation.

## What this bite adds

### Party-shared world-space discovery

Player View now has three battlefield states:

- **Unexplored** — covered by opaque world-space fog; enemies and interaction are hidden.
- **Explored memory** — static battlefield remains visible through a darkened/desaturated fog layer; enemies and current activity remain hidden.
- **Visible now** — normal rendering and interaction.

Current visibility is the union of every living PC's sight. Sight uses each unit's explicit vision/darkvision value when present and otherwise defaults to 60 ft. Every candidate cell is checked through the canonical `TacticsGeo.losVerdict()` geometry.

Exploration is reconstructed from the shared event log:

- roster starting positions;
- every resolved PC movement path;
- PC position edits/reinforcements;
- restore snapshots.

A refreshed or newly joined player therefore derives the same explored battlefield after catch-up. Rewinds deliberately do **not** erase player memory: if the table saw an area on an abandoned branch, it remains explored.

Staff View and the local sandbox remain omniscient.

### Hidden-foe disclosure gates

In Player View, a hidden foe is absent from:

- 3D standees and top-down tokens;
- initiative order;
- hover/cell targeting and the fallback standee-column picker;
- target pools, sight lines, badges and effect markers;
- camera follow, focus and attacker/target framing.

If a hidden foe changes a visible PC's HP, the authoritative result still appears without revealing identity or a bespoke action name: the feed uses **Unseen foe / Unseen attack**. Staff View continues to receive the complete fact.

### Direct ranged firing-position preview

For one direct ranged attack and one selected hostile target, every reachable firing origin is classified using the existing movement, range, elevation and cover rules:

- **Green** — clear shot, no cover.
- **Yellow** — half cover, +2.
- **Orange** — three-quarters cover, +5.
- **Dark charcoal** — total cover, no line, or outside range.

Long-range disadvantage keeps the cover color and is stated in the readout. Hovering a colored origin reports movement cost and the resulting shot.

The preview:

- uses `CB.seen` / canonical movement reach rather than arbitrary map cells;
- calls the existing `reachOK()` and `TacticsGeo.losVerdict()` rules in a silent preview mode;
- works for a PC targeting a visible foe and for staff inspecting a foe targeting a PC;
- never outlines an unexplored origin in Player View;
- is informational only — it does not commit a move or attack;
- is limited to direct attacks. AoE templates will receive a separate vocabulary later.

Cover Contest remains available as **Contest next shot** when the table wants the DM to replace the grid ruling.

## Upload through GitHub's browser

Upload these files with repository paths intact.

### Replace

- `forge/topography-test-mock.html`
- `forge/forge-table-correctness.js`

### Add

- `forge/forge-discovery.js`
- `forge/tests/smoke-forge-discovery.js`
- `forge/tests/smoke-phase15f-contract.js`

The bundle also carries the latest retained Phase 1.5c–e runtime files and regression tests for continuity. They do not need to be re-uploaded when the corresponding previous bundles are already live and byte-identical.

## Browser field checks

1. Join one browser as staff/overseer and another as a real player.
2. On the staff browser, use **Forge → Presentation → Player View**:
   - fog should match the real player browser;
   - switching back to Staff View should reveal the full battlefield immediately;
   - authority and DM controls should remain intact.
3. Move two different PCs on either device:
   - their visible areas should union party-wide;
   - previously seen terrain should remain as dark explored memory;
   - refresh and late-join should reconstruct the same explored area.
4. Put a foe outside party sight:
   - no token/standee, initiative chip, badge, hover target or nameplate should appear;
   - its hidden turn should not move the Player View camera;
   - if it damages a PC, the player feed should say **Unseen foe**, while Staff View keeps the real identity.
5. Test fog in both **3D** and **Top-down** camera views.
6. On a PC turn, select a visible foe and arm a direct ranged attack:
   - reachable origins should become green/yellow/orange/dark;
   - hovering them should show movement cost, cover and long-range disadvantage;
   - black/unexplored cells should never receive a preview tile.
7. Switch to Staff View on a foe turn, select a PC target, and confirm the same preview works from the foe's weapon.
8. Arm **Contest next shot** from a covered origin and verify the existing pre-roll DM ruling still overrides the preview/grid verdict.
9. Refresh both devices mid-turn and repeat a movement plus ranged preview.
10. Watch performance on the largest current map in both camera views; this first renderer uses two instanced fog meshes, not one mesh per cell.

## Deliberate boundaries

- The first fog renderer uses per-cell world-space volumes. The stronger destination is per-instance cap/cliff/prop visibility after the behavior is field-approved.
- The default sight radius is 60 ft when a sheet/monster does not provide one.
- Hidden foes still occupy their real grid cells. A later hidden-contact rule can narrate an attempted move into an occupied unseen square; this bite prevents disclosure and targeting but does not invent that adjudication.
- Explored memory is derived from the append-only log rather than stored as a new protocol fact or database column.
- Firing-position preview does not queue **move → attack**.
- AoE, cones, lines and burst templates are not represented by the direct-attack colors.
- No active generator archetype/elevation behavior changes in this bite.

After field approval, the next build is **Phase 2 terrain**: activate archetypes, assign constrained elevations and connectors, place semantic spawns/objectives, then validate and repair generated maps.

No commit or push is performed by this bundle.
